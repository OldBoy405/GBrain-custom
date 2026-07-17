# 「新建采集」功能技术方案

> 状态：设计稿（未动代码）
> 范围：`admin/` Brain 面板 · Inbox 页面
> 决策基线：**分阶段实现 —— Phase 1 严格 fork-safe（只碰 `admin/`）；Phase 2 后端可选，明确标注脱离 fork-safe**
> 首版来源：**文本 / Markdown 粘贴**；其他文件格式走 gbrain 既有的 **content-type processor skillpack** 机制（不自研解析器）

---

## 0. TL;DR（先读这一段）

当前 Inbox 页面只能**处理已入库**的 `inbox/*` 条目（触发 enrichment / 丢弃），**无法新建内容**。

本方案在 Inbox 页面右上角新增「**+ 新建采集**」按钮，打开一个采集弹窗。核心结论：

- **文本 / Markdown 粘贴** 可以**完全在 `admin/` 内、零后端改动、可立即合并 upstream** 地实现 —— 复用已经暴露给 SPA 的 `put_page` 操作（`scope: write`、非 `localOnly`）。这是 **Phase 1** 的全部内容。
- 关键技巧：前端在写入前**自己拼接 inbox frontmatter**（`inbox_status` / `raw_content` / `source_kind` / `captured_at`），使新建条目与 CLI `gbrain capture`、webhook `POST /ingest` 走 `prepareInboxCaptureContent` 产出的形状**完全一致**，从而无缝进入现有 enrichment 4 步流水线。
- **URL 抓取、PDF/Word 抽取** 后端目前**完全不存在**，且无法在 `admin/` 内实现（详见 §1.3）。按决策，它们进入 **Phase 2**，以**独立后端 PR** 形式落地，并复用 gbrain 既有的 processor-skillpack 架构，而非自研爬虫 / 解析器。

---

## 1. 现状分析：Inbox 页面的功能局限

### 1.1 当前能做什么

`admin/src/pages/brain/Inbox.tsx` 是一个双栏工作台，数据流如下：

| 动作 | Hook / 调用 | MCP 操作 | 说明 |
|---|---|---|---|
| 列表 + 统计 | `useInbox()` | `list_inbox` `{ limit: 100 }` | 服务端投影 `inbox/*` 页面 + 聚合计数；有 `merging` 条目时每 2.5s 轮询 |
| 详情懒加载 | `useInboxDetail(slug)` | `get_inbox_item` `{ slug }` | 选中时取 raw / enriched / typed-links |
| 触发富化 | `handleTriggerEnrichment` | `trigger_inbox_enrichment` `{ slugs }` | 批量入队 enrichment job |
| 丢弃 | `handleDiscardConfirm` | `discard_inbox_items` `{ slugs, mode }` | 软删除（72h 可恢复）/ 硬删除 |
| 合并进度 | `useInboxJobProgress` | job 进度流 | `merging` 态显示 4 步流水线进度 |

**四个操作全部是「针对已存在条目」的动作。** 页面没有任何「产生新条目」的入口。

### 1.2 内容当前是怎么进 inbox 的（面板之外）

Inbox 里的条目来自面板**之外**的三条摄入路径，SPA 用户看不到也用不到：

1. **CLI**：`gbrain capture "..."` / `--file` / `--stdin`（`src/commands/capture.ts`）→ `put_page`，默认 slug `inbox/YYYY-MM-DD-<hash8>`。
2. **Webhook**：`POST /ingest`（`src/commands/serve-http.ts:1879`）→ 入队 `ingest_capture` job → `prepareInboxCaptureContent` → `importFromContent`。需 OAuth `write` scope。
3. **Daemon sources**：file-watcher / inbox-folder（`src/core/ingestion/sources/`）→ 同样走 `ingest_capture`。

> 换言之，**「往 inbox 里放东西」这件事从来不是 UI 能做的**。用户必须切到终端或配置外部集成。这正是本功能要补的缺口。

### 1.3 为什么 URL / PDF / Word 无法在 `admin/` 内实现（Phase 1 约束）

`admin/CLAUDE.md`：**默认 fork-safe** —— admin 功能优先只动 `admin/`，以便 `git merge upstream/master` 零冲突。动 upstream 树（`src/`、`scripts/`、`test/`、根 `package.json` 等）属于 **非 fork-safe**，须**人工确认**且独立 PR。本节在 **Phase 1 / 未获确认改后端** 前提下，逐条核对能力：

| 能力 | 后端现状 | 能否在 `admin/` 内实现？ |
|---|---|---|
| 文本 / Markdown 写入 | `put_page`（`write` scope，**非 localOnly**）已暴露给 `/admin/api/op` cookie 代理 | ✅ **能**，零后端改动 |
| 二进制文件上传 | `file_upload` 是 **`localOnly: true`** —— `/admin/api/op` 代理明确过滤掉 localOnly（`serve-http.ts:1373 mcpOperations = operations.filter(op => !op.localOnly)`） | ❌ SPA 根本调不到 |
| 文件→文本抽取 | `ingest_capture` handler 对二进制 content-type **直接抛错**，要求「install a content-type processor skillpack」（`ingest-capture.ts:98`）；无内置 PDF/Word 解析 | ❌ 后端没有这个能力 |
| URL 抓取 | **无任何 URL-fetch source / 操作**。`ingestion/types.ts` 仅在注释里把 "future URL fetcher sources" 列为未来项 | ❌ 后端没有；浏览器端 `fetch` 任意站点被 CORS 拦截，不可行 |

**结论**：文本/Markdown 是 fork-safe 的、可立即交付的；URL 与文件抽取本质上是**后端能力缺口**，只能作为独立后端 PR，且按决策走 processor-skillpack 路线。

### 1.4 SPA 的数据通道与信任模型（约束设计）

- SPA 只有两条通道：**Tier1 REST**（`/admin/api/*`，cookie）与 **Tier3 MCP**（`callMcp` → `/mcp` bearer 或回落到 `/admin/api/op` cookie 代理）。
- `/admin/api/op` 代理里 admin 身份 `scopes: ['admin']`，`hasScope` 对 `write` 放行 → **`put_page` 可调**。
- `put_page` 经此代理时 `ctx.remote = true`：provenance 被服务端强制盖为 `mcp:put_page`（客户端传的 `source_kind` 被忽略），且按 untrusted 处理（跳过 gate-owned frontmatter marker）。**这对 inbox 采集无害** —— 我们的 provenance 走 frontmatter 里的 `source_kind`/`captured_via`（`pageToInboxItem` 会读 `fm.source_kind ?? fm.captured_via`），不依赖 DB 的 `source_kind` 列。
- `POST /ingest` 走 `requireBearerAuth requiredScopes:['write']`，**cookie 不通** —— SPA 默认拿不到 OAuth write token，因此 Phase 1 **不走 `/ingest`**，直接用 `put_page`。

---

## 2. 数据流与「入库=进流水线」的原理（需求 #5 的地基）

要保证新采集内容正确进入 **enrichment 4 步流水线**，必须理解流水线到底吃什么。

### 2.1 enrichment 4 步流水线是什么

来自 `src/core/minions/handlers/inbox-enrich.ts`（**确定性、零 LLM**）：

1. **Frontmatter normalize** —— 归一化工作流 frontmatter，把 `raw_content`（缺省回落到 `compiled_truth`）固化，置 `inbox_status: merging`。
2. **Typed-link reconcile** —— `runAutoLink` 只对**已显式存在**的 wikilink / frontmatter 引用做对账（**不从散文里猜实体**）。
3. **Serialize / re-import** —— `serializeMarkdown` 重新组装并 `importFromContent`（chunk + 重建链接）。
4. **Merge 入图** —— 置 `inbox_status: merged` + `inbox_enriched_at`。

对应 admin `EnrichmentPipeline.tsx` 的 4 步示意（Frontmatter / Typed-link / Serialize / 合并入图）。

### 2.2 一个页面「算 inbox 条目」的充要条件

从 `src/core/inbox.ts` + `list_inbox`（`slugPrefix: 'inbox/'`）反推：

- **slug 以 `inbox/` 开头** → 自动出现在 `list_inbox` 结果里。
- `inboxStatus(fm)`：`fm.inbox_status` 不合法/缺失 → 默认 `pending_frontmatter`（即「待 enrich」，会被 `stats.pending_enrich` 计入、可勾选触发）。
- `inbox_enrich` 对 `raw_content` 是**软依赖**（缺失回落到正文），但 detail 面板的 **RAW vs ENRICHED diff** 依赖 `frontmatter.raw_content`。

**因此 Phase 1 的最小正确契约**：写一个 slug 为 `inbox/...`、frontmatter 含 `inbox_status: pending_frontmatter` + `raw_content` 的页面，即可 100% 复现 CLI/webhook 采集条目的行为，并被现有「触发 enrichment」按钮直接消费。**流水线本身一行都不用改。**

### 2.3 前端复刻 `prepareInboxCaptureContent`

后端 `prepareInboxCaptureContent`（`inbox.ts:81`）做的事很轻量，可在前端等价实现（用已在用的 `gray-matter` 或手拼 YAML）：

```
inbox_status : 有既有 frontmatter → 'pending_typed_link'；纯正文 → 'pending_frontmatter'
raw_content  : 原始正文
source_kind  : 'admin-capture'（新增的渠道 taxonomy 值）
captured_at  : new Date().toISOString()
[ingestion_metadata] : { via: 'admin-ui', ... 可选 }
```

> 这样即便未来后端 Phase 2 上线，两条路径产出的条目形状仍一致，不会分裂。

---

## 3. Phase 1 详细设计（fork-safe，只碰 `admin/`）

### 3.1 用户界面

**入口按钮**：Inbox `PageHeader` 的 `right` 槽，在「刷新」左侧加「**+ 新建采集**」主按钮（accent 底色，与「触发 enrichment」同一视觉层级）。

**弹窗**：新增 `admin/src/components/brain/NewCaptureDialog.tsx`，**完全复刻 `InboxDiscardDialog.tsx` 的模态骨架**（`fixed inset-0 z-50` + 背景遮罩按钮 + `role="dialog" aria-modal` + 圆角卡片 + 右下角 取消/确认）。遵守 `admin/DESIGN.md`：无渐变/阴影滥用、无 loading spinner（按钮内联「处理中…」）。

**弹窗内含来源 Tab**（Phase 1 只亮 2 个，其余灰显占位并注明 Phase 2）：

```
┌─ 新建采集 ────────────────────────────────┐
│ [ 文本/Markdown ] [ 结构化条目 ]  ·  ( URL 灰 ) ( 文件 灰 ) │
├───────────────────────────────────────────┤
│  Tab A · 文本/Markdown                      │
│   ┌───────────────────────────────────┐    │
│   │ <textarea 粘贴正文，支持 --- frontmatter> │    │
│   └───────────────────────────────────┘    │
│   标题(可选) [____]   类型 [note ▾]          │
│   Slug (可选, 留空自动 inbox/日期-hash) [____] │
│   ☑ 采集后立即触发 enrichment                 │
│                                             │
│  Tab B · 结构化条目                          │
│   标题* [____]  类型 [note ▾]  标签 [a, b]    │
│   正文 <textarea>                            │
├───────────────────────────────────────────┤
│                        [取消]  [采集 (slug 预览)]│
└───────────────────────────────────────────┘
```

- **Tab A 文本/Markdown**：一个 textarea + 可选标题/类型/slug + 「立即触发 enrichment」开关。
- **Tab B 结构化条目**：表单字段（title 必填、type 下拉、tags、body）→ 前端拼成 Markdown。满足需求 #2 的「手动结构化条目」。
- **URL / 文件 Tab**：Phase 1 灰显，tooltip「需后端 processor skillpack，见 Phase 2」。

### 3.2 首版支持的数据来源

| 来源 | Phase | 通道 | 备注 |
|---|---|---|---|
| 文本 / Markdown 粘贴 | **1** | `put_page` | 支持带 `---` frontmatter 的粘贴；自动 merge，不双包裹（复刻 `mergeCaptureFrontmatter` 精神） |
| 手动结构化条目 | **1** | `put_page` | 表单 → Markdown |
| URL 网页采集 | **2** | 后端新 source | 见 §4 |
| 文件（PDF/Word/HTML…） | **2** | processor skillpack | 见 §4，**不自研解析器** |

### 3.3 与现有工作流的集成

- 采集成功后：关闭弹窗 → 调 `reload()`（`useInbox` 已暴露）→ 新条目立即出现在左栏（`pending_frontmatter`）。
- 「立即触发 enrichment」勾选时：`put_page` 成功后紧接着调 `trigger_inbox_enrichment { slugs: [newSlug] }`，复用页面已有的 enrichment 入队逻辑与 `merging` 轮询。
- 复用现有 `actionNotice` / `actionError` 提示条展示结果（"已采集 inbox/… · 已入队 enrichment"）。
- **PGLite 注意**（写进 UI 文案 + 文档）：`trigger_inbox_enrichment` 只是入队；PGLite 下需 worker 执行 job（`gbrain jobs submit inbox_enrich --follow` 或运行 daemon）。UI 在勾选「立即触发」时给一行提示。

### 3.4 数据验证与错误处理

**前端校验（提交前）**：
- 正文非空（`normalizeForHash` 同款：去 BOM、trim 后非空）。
- slug 若手填：必须匹配 slug 语法且以 `inbox/` 开头（否则不进 inbox 列表）；建议默认自动生成，禁止用户填非 `inbox/` 前缀（或给红字提示）。
- frontmatter 粘贴：`gray-matter` 解析失败 → 弹窗内红字「frontmatter 格式错误：…」，不发请求（复刻 `mergeCaptureFrontmatter` 的 malformed 分支）。
- 大小：`put_page` 走 JSON body，无 45KB 管道限制，但建议前端软上限（如 512KB）给出提示。

**请求错误**：
- `callMcp` 抛 `McpError` → 展示在弹窗内错误条；保留用户输入不清空。
- slug 已存在：`put_page` 是 upsert，会覆盖 —— 若 slug 手填且已存在，提交前用 `get_inbox_item` 预检并二次确认「该 slug 已存在，将覆盖」。自动生成的 hash slug 天然幂等（同内容同 slug）。

### 3.5 技术实现细节（Phase 1）

**新增文件（全部在 `admin/`）**：
- `admin/src/components/brain/NewCaptureDialog.tsx` —— 弹窗组件。
- `admin/src/lib/useCapture.ts` —— 采集 action hook：拼 frontmatter、调 `put_page`、可选链 `trigger_inbox_enrichment`。
- `admin/src/lib/capture-frontmatter.ts` —— 复刻 `prepareInboxCaptureContent` 的纯函数（易测）。
- 测试：`admin/src/components/brain/__tests__/NewCaptureDialog.test.tsx`、`admin/src/lib/__tests__/capture-frontmatter.test.ts`。

**改动文件**：
- `admin/src/pages/brain/Inbox.tsx` —— 加按钮 + 弹窗开关 state + 成功回调（`reload`）。
- `admin/src/pages/brain/__tests__/Inbox.page.test.tsx` —— 加用例：打开弹窗、粘贴、断言 `callMcp('put_page', { slug, content })`、断言可选 `trigger_inbox_enrichment`。
- `admin/src/lib/op-types.ts` —— 若需要，补 `PutPageResult` 宽松镜像（`{ slug; status?; chunks? }`）。

**核心调用序列**：
```
用户点「采集」
  → buildInboxContent(body, { title, type, slug })   // capture-frontmatter.ts
  → slug = 用户填写 ?? `inbox/${YYYY-MM-DD}-${sha8(normalized)}`
  → callMcp('put_page', { slug, content })            // /admin/api/op, write scope
  → 若勾选立即触发: callMcp('trigger_inbox_enrichment', { slugs: [slug] })
  → onSuccess: reload(); notice(...)
```

**MCP 操作清单（Phase 1，全部已存在、非 localOnly）**：
- `put_page`（write）—— 写入。
- `trigger_inbox_enrichment`（write）—— 可选立即富化。
- `get_inbox_item`（read）—— 手填 slug 覆盖预检（可选）。
- **无需任何新后端操作、无需 REST 端点。**

### 3.6 slug 生成（复刻 CLI 语义）

前端实现与 `capture.ts:defaultSlug` 一致：`inbox/${y}-${m}-${d}-${sha8(normalizeForHash(body))}`。`sha8` 用 `crypto.subtle.digest('SHA-256', ...)`（浏览器原生）。`normalizeForHash`：去 BOM、CRLF→LF、trim、NFKC —— 直接抄 `capture.ts` 的纯函数逻辑到 `admin/`（不 import `src/`，手动镜像，符合 fork-safe 类型镜像惯例）。

---

## 4. Phase 2 设计（后端可选，明确脱离 fork-safe）

> ⚠️ 本阶段**必须编辑 upstream 树**（含 `src/`、根 `package.json` 等），**非 fork-safe**。
> **落地前须人工确认**；与 Phase 1 admin UI **分开交付**（独立后端 PR）。
> 走完整 `/ship` 流程（VERSION 五文件同步、CHANGELOG、契约测试、引擎 parity）。
> 本节是方向性设计，落地前应过 `/plan-eng-review`。

### 4.1 URL 网页采集

**推荐路线**：新增一个 **`fetch_url` MCP 操作**（`scope: write`，**非 localOnly** 以便 SPA 调用；但对 remote caller 做 SSRF 防护），而非 daemon source（避免跨进程、便于同步返回 slug）。

职责链：
1. **抓取**：服务端 `fetch(url)`，超时 + 大小上限 + 重定向限制 + **SSRF 防护**（禁私网/内网 IP、禁 `file://`、禁 metadata 端点）。`untrusted_payload: true`。
2. **正文抽取**：`text/html` → 正文提取（Readability 类库）→ **转 Markdown**（Turndown 类库）。这两个 npm 依赖进**根 `package.json`**（脱离 fork-safe 的代价之一）。
3. **落库**：复用 `prepareInboxCaptureContent`（`source_kind: 'url'`, `source_uri: <url>`, metadata 存标题/作者/抓取时间）→ `importFromContent`，slug `inbox/YYYY-MM-DD-<hash6>`。
4. **返回** slug 给 SPA → 前端 `reload()`。

前端：URL Tab 变为可用，输入框 + 「抓取」→ `callMcp('fetch_url', { url })`。

**替代（更省事、但更弱）**：不加操作，让用户在浏览器插件/外部把网页转好 Markdown 再走 Phase 1 粘贴。作为过渡文案即可。

### 4.2 文件（PDF / Word / HTML …）—— 走 processor skillpack（按决策）

gbrain 已有**明确的架构位**：`ingest_capture` 对二进制 content-type 抛错并提示「install a content-type processor skillpack（如 `gbrain-audio-transcribe`, `gbrain-image-ocr`）」。**不自研 PDF/Word 解析器**，而是：

1. 新增 SPA 文件 Tab：`<input type=file>`，浏览器读文件。
2. **文本类文件**（`.md` / `.txt` / 纯 `.html`）：浏览器端即可读为文本 → 直接走 **Phase 1 的 `put_page` 路径**（HTML 可选前端 sanitize/转 md）。**这部分其实 fork-safe，可提前到 Phase 1.5。**
3. **二进制文件**（PDF/Word/图片/音视频）：需要
   - 一个可上传二进制的入口（`file_upload` 目前 localOnly + 只存文件不抽取 → 需后端改造或新 `POST /admin/api/upload` REST 端点），**和**
   - 一个 content-type **processor skillpack**（把 PDF/docx 抽成 `text/markdown`），由 `ingest_capture` 路由调用。
4. 抽取出的 `text/markdown` 再走标准 `ingest_capture` → `prepareInboxCaptureContent` → inbox。

**Phase 2 后端工作量清单**（供 `/ship` 评估）：
- [ ] `fetch_url` 操作 + SSRF 防护 + Readability/Turndown 依赖（契约测试、引擎无关）。
- [ ] 二进制上传端点（REST 或放开 `file_upload` 的 remote confinement）。
- [ ] processor-skillpack 加载路径打通 + 至少一个参考 processor（PDF）。
- [ ] `SourceType` taxonomy 增补 `'url'`（`op-types.ts` 镜像 + 后端 `types.ts`）。

---

## 5. UX 与性能

### 5.1 UX
- **零上下文切换**：用户不再需要开终端，粘贴即入库。
- **即时反馈**：采集后新条目立刻出现在左栏（乐观刷新），选中可看 RAW vs ENRICHED diff。
- **可选一步到位**：「采集 + 立即 enrichment」勾选，减少两次点击。
- **slug 预览**：确认按钮上实时显示将要写入的 slug，消除「东西去哪了」的困惑。
- **键盘**：`Esc` 关弹窗、`Cmd/Ctrl+Enter` 提交（与常见编辑器一致）。
- **无破坏性**：采集是纯新增；不涉及删除，无需二次确认（除手填 slug 覆盖场景）。

### 5.2 性能
- Phase 1 单次 `put_page` 同步返回，`chunks`/embed 在后端一次完成；大文本给前端软上限提示。
- 避免 textarea 每键 re-render 触发昂贵计算：slug 的 `sha8` 预览做 **debounce**（如 300ms）或仅在 blur/提交时算。
- 采集后用 `reload()` 增量刷新列表，不整页重挂载。
- `NewCaptureDialog` 未打开时 `return null`（与 `InboxDiscardDialog` 一致），不占渲染成本。
- Phase 2 `fetch_url` 抓取慢 → 后端应入队 or 设明确超时，前端按钮内联「抓取中…」，不阻塞其余 UI。

---

## 6. 分阶段交付与验收

| 阶段 | 内容 | fork-safe | 验收 |
|---|---|---|---|
| **P1** | 文本/Markdown 粘贴 + 结构化条目 + 弹窗 + 可选立即 enrichment | ✅ 是 | 粘贴文本 → 出现在 inbox（pending_frontmatter）→ 勾选可触发富化并 merge |
| **P1.5** | 文本类文件（.md/.txt/纯 html）浏览器读取后走 P1 路径 | ✅ 是 | 选 .md 文件 → 入库同 P1 |
| **P2** | `fetch_url` URL 采集（独立后端 PR） | ❌ 否 | 输入 URL → 抓取转 md → 入库；SSRF 防护测试通过 |
| **P2** | 二进制文件 via processor skillpack | ❌ 否 | 装 PDF processor → 上传 PDF → 抽取入库 |

**建议先只做 P1（+ 视情况 P1.5）**：它零后端风险、可立即合并、覆盖最高频的「把一段文字/一篇 md 存进大脑」的诉求；URL 与二进制文件作为后续独立后端 PR 推进，避免把 fork-safe 的前端改动和会脱离 fork-safe 的后端改动混在一次交付里。

---

## 附录 A：关键代码坐标

- 页面：`admin/src/pages/brain/Inbox.tsx`
- 页面测试：`admin/src/pages/brain/__tests__/Inbox.page.test.tsx`
- 弹窗骨架参考：`admin/src/components/brain/InboxDiscardDialog.tsx`
- 4 步示意：`admin/src/components/brain/EnrichmentPipeline.tsx`
- Hook：`admin/src/lib/useInbox.ts`、`useMcp.ts`、`mcp-client.ts`
- 类型镜像：`admin/src/lib/op-types.ts`（`InboxItem` / `InboxListResult` / `TriggerInboxEnrichmentResult`）
- 后端契约：`src/core/operations.ts`（`put_page:739`、`list_inbox:1440`、`trigger_inbox_enrichment:1546`、`file_upload:2975 localOnly`）
- 采集语义参考：`src/commands/capture.ts`（`defaultSlug`/`normalizeForHash`/`mergeCaptureFrontmatter`）
- inbox 契约：`src/core/inbox.ts`（`prepareInboxCaptureContent:81`、`pageToInboxItem:45`）
- 流水线：`src/core/minions/handlers/inbox-enrich.ts`、`ingest-capture.ts`
- op 代理（localOnly 过滤 + admin scope）：`src/commands/serve-http.ts:1373`、`:1428`
- webhook 摄入：`src/commands/serve-http.ts:1879`（`POST /ingest`，OAuth write，cookie 不通）
