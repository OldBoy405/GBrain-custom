# GBrain 前端管理页面现代化方案（8 页 + 现有 admin 融合）

> 状态：方案草案（未写代码）。本文档只放在 `admin/docs/`（前端专属文档目录），不触碰任何上游文件。
> 目标：把 `docs/前端案例/` 下 8 个 MHTML 静态示例落地为动态页面，且保证后续 `git merge upstream/master` **零冲突**。
> 所有结论均基于仓库实际代码：`admin/`（现有代码）、`src/core/operations.ts`（契约）、`src/commands/serve-http.ts`（HTTP 路由）、`admin/DESIGN.md`（设计规范）、8 个 MHTML 实测样式。

---

## 0. 先决决策：设计语言冲突（必须先定，否则地基错位）

这是全案唯一的**阻塞性**决策，因为它决定后面每一个组件、每一个 token、每一行 CSS 的走向。

| 维度 | 8 个 MHTML 示例（实测） | 现有 `admin/DESIGN.md` + `index.css`（实测） |
|------|------------------------|--------------------------------------------|
| 主题 | 浅色暖纸感 `--color-canvas:#f5f1e8` / `--color-ink:#1a1a17` | 纯暗色 `--bg-primary:#0a0a0f` / `--text-primary:#e0e0e0` |
| 主色 | 青绿 `--color-accent:#0f766e` + 语义多色（amber/coral/紫/红/绿） | **无主品牌色**，`--accent:#3b82f6` 仅用于激活态；"数据即颜色" |
| 字体 | Inter + JetBrains Mono + **Noto Sans SC + Noto Serif SC**（含衬线） | Inter + JetBrains Mono（无衬线体、无中文体） |
| 图标 | 重度使用 **Lucide** 做导航 | DESIGN.md 明确："❌ 图标做导航（用文字标签）" |
| 侧边栏 | `w-[240px]` + 分组（工作台/后台调度/技能进化） | `.sidebar width:200px` + 扁平列表 |
| 气质 | 面向"读者/知识消费者"的编辑型产品 | 面向"运维者"的高密度 cockpit（Supabase/Grafana 参照） |

**这不是可以"对齐一下"就消解的差异，而是两个面向不同用户的产品表层。** 三种可选路线：

| 路线 | 说明 | 上游兼容性 | 工作量 | 推荐度 |
|------|------|-----------|--------|--------|
| **A. 双表层共存（推荐）** | 新增"知识 Brain"浅色表层承载 8 个新页面；现有 6 个 admin 页保持暗色 cockpit 不动，作为"运维 Ops"表层。两套主题在 `admin/src/themes/` 下并存，通过顶层布局/路由段切换。 | 零影响（全部 `admin/` 内） | 中 | ★★★★★ |
| B. 全量改造为暗色 | 把 8 个示例重绘成 `DESIGN.md` 暗色规范，牺牲示例的编辑气质。 | 零影响 | 中高（推翻示例视觉） | ★★★ |
| C. 全量改造为浅色 | 把现有 6 个 admin 页也改成浅纸感，统一到示例风格。 | 零影响 | 高（回归风险大，改动成熟页面） | ★★ |

**✅ 已确认：采用路线 A（双表层共存）。** 理由：
1. **符合 karpathy「外科手术式改动」**——不动已成熟、已上线的 6 个暗色页面，只新增，回归风险最低。
2. **两种气质各自成立**——8 个页面本就是"知识大脑"消费界面（时间线、图谱、检索、沉淀），浅色编辑风是其原生语言；运维页（Agents/RequestLog/Calibration）本就该是暗色 cockpit。强行统一会两头不讨好。
3. **DESIGN.md 不需要被推翻，而是被扩展**——新增一节"Brain 表层 token"，与既有"Ops 表层 token"并列，两者共享字体族（Inter + JetBrains Mono）与 4px 间距基准，仅在主题色/背景/衬线体上分叉。这样"技术方案与 DESIGN.md 对齐"依然成立。

---

## 1. 示例页面深度分析

### 1.1 设计 Token（8 页共享，实测自 `01.今日动态.mhtml` 的 `:root`）

```css
/* 颜色 — 浅色暖纸感 */
--color-canvas:  #f5f1e8;   /* 页面底色（暖纸） */
--color-hairline:#ddd7c7;   /* 分隔细线 */
--color-emphasis:#b8b29f;   /* 强调边框 */
--color-ink:     #1a1a17;   /* 主文字 */
--color-ink-soft:#4d4d47;   /* 次文字 */
--color-muted:   #8b8a80;   /* 弱文字 */
--color-inverse: #fafaf6;   /* 反白文字（深底上） */
--color-accent:  #0f766e;   --color-accent-soft:#e8f2f1;  /* 青绿主色 + 柔和底 */
--color-amber:   #b45309;   /* 入库/警示语义 */
--color-coral:   #d4613a;   /* 检索/联系语义 */
--color-node-entity:  #6b5b3a;  --color-node-source:  #8c8b63;
--color-node-synthesis:#7b3f9e; --color-node-recent: #d97706;  /* 图谱节点分类色 */
--color-contra:  #b91c1c;   /* 矛盾 */  --color-ok: #166534;  /* 通过 */
/* 字体 */
--font-sans:     "Inter", system-ui, sans-serif;
--font-mono:     "JetBrains Mono", ui-monospace, monospace;
--font-sans-sc:  "Noto Sans SC", "PingFang SC", sans-serif;   /* 中文正文 */
--font-serif-sc: "Noto Serif SC", "Songti SC", serif;          /* 中文标题/引文（编辑气质来源）*/
```

**语义色是「有意义的」而非装饰**（与 DESIGN.md 的"每个颜色都有意义"哲学一致）：amber=入库、coral=检索/联系、紫=综合沉淀、青绿=主行动、红=矛盾、绿=通过。图谱节点色（entity/source/synthesis/recent）是一套独立的分类色板。

### 1.2 布局与导航结构

- **侧边栏**：`w-[240px] shrink-0`，固定左侧，含 logo + 分组导航 + 激活指示器（`text-accent` 高亮 + 图标着色）。分组：`工作台`（今日动态/内容入库/精确检索/知识网络/整理沉淀）、`后台调度`（jobs）、`技能进化`（skills）。
- **路由**：hash 模式，与现有 admin 完全一致：`#/`、`#/inbox`、`#/ask`、`#/graph`、`#/synthesize`、`#/jobs`、`#/skills`、`#/three-paradigms`。
- **图标体系**：Lucide（house/inbox/message-circle-question/network/layers/wrench/git-compare/sparkles/activity/git-branch/search/arrow-right/moon 等），内联 SVG，`aria-hidden`。
- **主内容区模式**：统计卡片行 + 时间线流 / 数据列表 / 图谱画布 / 步骤管道，随页面而变。

### 1.3 数据展示与交互模式（逐页）

| 页面 | 路由 | 核心展示件 | 交互 | 转换难点 |
|------|------|-----------|------|---------|
| 今日动态 | `#/` | 统计卡片 + 时间线活动流 + 实时状态点 | SSE/轮询实时追加 | 实时流连接管理 |
| 内容入库 | `#/inbox` | 多源输入入口 + 内容列表 + 状态 Badge | 提交表单、状态标签切换 | 多源输入的表单/上传 |
| 精确检索 | `#/ask` | 搜索框 + **12 步检索管道可视化** + 结果列表 | 逐步动画、结果展开 | 管道步骤动画时序 |
| 知识网络 | `#/graph` | **知识图谱**（节点-边） | 缩放/拖拽/点选节点、右侧抽屉详情 | 力导向布局 + 性能 |
| 整理沉淀 | `#/synthesize` | 冲突组列表、候选卡、Compile 产出 + diff | 选组、触发 Compile、采纳 | 无（同步 read op，非长任务） |
| 后台调度 | `#/jobs` | 任务队列表 + 执行状态 + 调度配置 | 暂停/重试/取消、轮询刷新 | 已有 `jobs/watch` 端点可复用 |
| 技能进化 | `#/skills` | Skill 列表 + 版本 + 进化记录 | 展开版本、diff 查看 | 版本时间线 |
| 三大范式 | `#/three-paradigms` | 文档型静态页 | 锚点跳转 | 无（纯静态，最先做） |

### 1.4 技术栈差异对照（示例 vs 现有 admin）

| 项 | 示例（Astro+React+Tailwind） | 现有 admin（Vite+React19+纯 CSS） | 落地取舍 |
|----|------|------|---------|
| 框架 | Astro（含 SSG） | Vite SPA | 保持 Vite SPA（Astro 会引入 SSR/构建复杂度，且嵌入二进制需静态产物） |
| 样式 | Tailwind + CSS 变量 | 纯 CSS + CSS 变量 | 见第 2 节决策（Tailwind 仅限 admin，零上游影响） |
| 图标 | Lucide 内联 SVG | 无（文字导航） | 新表层引入 `lucide-react`（仅 Brain 表层） |
| 路由 | Astro 文件路由 | hash + 手写 switch | 保持 hash，抽出配置化路由表 |

---

## 2. 现代化前端技术架构（选型 + 理由 + 上游影响）

**约束前提**：所有依赖只进 `admin/package.json`（`cd admin && bun add`），根 `package.json` 一律不动；产物 `admin/dist/` 提交、`admin/node_modules/` 已忽略。

| 决策项 | 选项对比 | 最终选择 | 理由（≥2 条） | 上游兼容性影响 |
|--------|---------|---------|--------------|--------------|
| 框架 | Astro / Next / **保持 Vite SPA** | **Vite + React 19（沿用）** | ①`serve-http.ts` 已按静态 SPA 方式嵌入 `admin/dist`（`src/admin-embedded.ts` 打包 `ADMIN_ASSETS`），换框架会破坏嵌入链路；②避免引入 SSR，保持 cookie 鉴权模型不变；③与现有 6 页零迁移成本 | 零影响（仅 `admin/` 内） |
| CSS 方案 | 全量 Tailwind / 纯 CSS 变量 | **✅ 已确认：一开始就引入 Tailwind（仅 admin 内）+ CSS 变量做 token 层** | ①示例本就是 Tailwind + CSS 变量驱动，class 与 token 可 1:1 搬运，落地成本最低；②Tailwind 配置（`tailwind.config` + postcss）全在 `admin/` 内，仅影响 admin 构建；③token 用 CSS 变量定义、Tailwind theme 引用变量，两表层（ops/brain）切换只换变量值。Ops 表层现有 6 页继续用纯 CSS 类，与 Tailwind 共存不冲突（Tailwind 只作用于新页 class） | 零影响（仅 `admin/` 内） |
| 路由 | react-router / wouter / **配置化 hash 路由（增强现有）** | **配置化 hash 路由（自研轻量，扩展现有 `App.tsx` 模式）** | ①现有已是 hash + switch，加路由库是过度设计（karpathy「简单优先」）；②配置化即一个 `routes.ts` 数组，导航与页面从同一份配置生成；③保持与现有 6 页一致的鉴权/401 跳转 | 零影响 |
| 图标库 | 自绘 SVG / **lucide-react** | **lucide-react（仅 Brain 表层）** | ①示例全用 Lucide，直接对应，零重绘；②tree-shakeable，只打包用到的图标；③`bun add lucide-react` 仅进 admin | 零影响 |
| 状态管理 | Redux/Zustand / **React 内置 + 轻量 store** | **React hooks + 每页自持（沿用现有模式）+ 必要时 Zustand** | ①现有页面用 `useState/useEffect` 直连 `api.ts`，无全局 store，简单有效；②8 页多为读多写少，数据契约即 hook；③仅当跨页共享（如全局 brain/source 选择）才引 Zustand | 零影响 |
| 数据获取 | 裸 fetch / **TanStack Query（可选）** | **先沿用 `api.ts` 裸 fetch 封装；读密集页可选 TanStack Query** | ①`api.ts` 已封装 401 跳转 + credentials，复用；②TanStack Query 带来缓存/重试/轮询，对 8 个读页价值大，但属增强非必需；③二阶段引入 | 零影响 |
| 表单 | RHF+Zod / **受控组件（沿用）** | **受控组件（入库表单简单）** | ①入库/调度配置表单字段少，受控足够；②避免 Zod 与 `src/core` 类型混淆 | 零影响 |
| 图表/可视化 | D3 / vis-network / **D3-force（图谱）+ 轻量 SVG（管道/时间线）** | **知识图谱用 D3-force；管道/统计用手写 SVG+CSS 动画** | ①图谱力导向 D3 最成熟；②管道 12 步/时间线用 CSS + 少量 SVG 即可，避免重库；③按需引入 | 零影响 |
| 前端测试 | Jest / **Vitest** | **Vitest（+ @testing-library/react）** | ①与 Vite 同源，配置最少；②测试全部在 `admin/` 内，与上游 `test/`（Bun test）物理隔离；③不碰上游 3700+ 测试 | 零影响（`test/` 不动） |

**与现有 codebase 的关系总览**：全部为「新增」或「增强 `admin/` 内」，无一「替代上游」。

---

## 3. 静态 → 动态转换路径

### 3.1 层次化转换模型（四层，逐层可验证）

```
L1 提取设计 Token   → 把示例 :root 变量搬进 admin/src/themes/brain.css，视觉像素级对齐
   verify: 截图比对示例，token 无遗漏
L2 提取组件层级     → 从 MHTML 拆出可复用件（StatCard/Timeline/Badge/Drawer/PipelineStep/GraphCanvas…）
   verify: Storybook 或页面级静态渲染，纯 UI 无数据
L3 注入数据接口     → 为每页定义 useXxx() hook（数据契约），先接 mock JSON，再接真实端点
   verify: hook 单测（Vitest）+ mock 渲染
L4 接入状态/实时    → SSE/轮询、加载/错误边界、乐观更新
   verify: 断线重连、401 跳转、空态
```

### 3.2 实现优先级排序（及理由）

| 序 | 页面 | 理由 | 数据来源（见第 4 节） |
|----|------|------|---------------------|
| 1 | 三大范式 `#/three-paradigms` | 纯静态，零 API，先跑通"新表层布局+路由+主题"骨架 | 无 |
| 2 | 今日动态 `#/` | 门面页 + 复用现有 `stats`/`health` 端点，验证 L3 数据注入 | 复用 `/admin/api/stats`+`health-indicators`（Tier1） |
| 3 | 后台调度 `#/jobs` | **已有 `/admin/api/jobs/watch` 端点**，几乎零后端成本 | 复用 `jobs/watch`（Tier1）+ MCP `list_jobs`（Tier3） |
| 4 | 内容入库 `#/inbox` | 列表+表单，中等复杂，打通"写"路径 | MCP `list_pages`/`log_ingest`/`get_ingest_log`（Tier3） |
| 5 | 技能进化 `#/skills` | 列表+版本，读为主 | MCP `list_skills`/`get_skill`（Tier3） |

**当前 MVP 范围澄清（2026-07-11 补记）**：技能进化页目前是「Skill 目录浏览 + Skillpack 只读概览」（`list_skills`/`get_skill` 详情抽屉 + `list_brain_skillpack`），案例设计稿里的「版本时间线 + diff」仍是规划项，未实现——详见 `admin/docs/SKILLS_PAGE_COMPARISON.zh.md`。
| 6 | 精确检索 `#/ask` | 12 步管道动画是难点，但价值高 | MCP `query`（Tier3，含 `steps` 元数据） |
| 7 | 整理沉淀 `#/synthesize` | 冲突检测 + LLM 合并，放检索之后 | MCP `find_conflicts`/`compile_truth`/`adopt_compiled_truth`（Tier3） |
| 8 | 知识网络 `#/graph` | D3 力导向 + 性能，最难，最后做 | MCP `traverse_graph`/`get_links`（Tier3） |

### 3.3 各页难点与对策

- **检索管道（`#/ask` 12 步动画）**：`query` 操作返回结果时携带管道元数据（`operations.ts` 的 query 含 `tool_name:'query'` 及步骤信息）。对策：前端定义静态的 12 步 schema，按后端返回的每步耗时/命中数做**状态机驱动的 CSS 过渡**，不追求逐帧动画；无步骤数据时降级为静态列表。
- **知识图谱（`#/graph`）**：`traverse_graph`/`get_links` 返回节点-边。对策：D3-force 布局 + Canvas/SVG 混合渲染；节点数 > 阈值时启用聚类/god-node 折叠；右侧抽屉复用通用 `Drawer` 组件。首版可先用 `--depth` 限制规模。
- **实时流（`#/` 今日动态）**：现有 `/admin/events` 是 SSE（`requireAdmin`）。对策：封装一个 `useSSE(url)` hook，统一断线重连与页面隐藏时暂停；无 SSE 时退化为 1s 轮询（照搬 `JobsWatch.tsx` 的轮询模式）。
- **合并工作台（`#/synthesize`）**：`compile_truth` 是同步 read op（LLM 调用但不持久化），`adopt_compiled_truth` 才是写。对策：无需轮询/SSE，按钮态（`编译中…`/`采纳中…`）足够，UI 不用 spinner（DESIGN.md 反对 spinner）。

---

## 4. 后端 API 集成方案（非侵入式三层策略）

**核心事实**（实测 `serve-http.ts`）：现有 admin 端点全部形如 `app.get('/admin/api/xxx', requireAdmin, …)`，鉴权是 **HttpOnly cookie**；而 `POST /mcp` 鉴权是 **Bearer token**（`requireBearerAuth`）。`operations.ts` 共约 100 个操作（59 个 `read`）。

### 4.1 现有可复用端点（Tier 1 — 零改动优先）

| 端点 | 支撑操作 | 服务于新页面 |
|------|---------|-------------|
| `GET /admin/api/stats` | get_stats | 今日动态 统计卡 |
| `GET /admin/api/health-indicators` | get_health | 今日动态 状态点 |
| `GET /admin/api/full-stats` | 汇总 | 今日动态 扩展 |
| `GET /admin/api/jobs/watch` | 队列快照 | 后台调度 主数据 |
| `GET /admin/api/calibration/*` | 校准 | （运维页已用） |
| `GET /admin/api/agents` `/requests` | agents/日志 | （运维页已用） |
| `GET /admin/events`（SSE） | 实时流 | 今日动态 实时追加 |

### 4.2 页面 → 操作映射（决定各页数据从哪来）

| 页面 | 需要的 operations.ts 操作 | 现有端点? | 建议 Tier |
|------|--------------------------|----------|-----------|
| 今日动态 | get_stats, get_health, get_status_snapshot, get_timeline, get_recent_salience, find_anomalies, advisor | 部分（stats/health/events） | Tier1 为主 + Tier3 补 |
| 内容入库 | list_pages, get_ingest_log, log_ingest, put_page, file_list | 否 | Tier3 |
| 精确检索 | query, search | 否 | Tier3 |
| 知识网络 | traverse_graph, get_links, get_backlinks, find_experts, find_contradictions | 否 | Tier3 |
| 整理沉淀 | find_conflicts, compile_truth, adopt_compiled_truth | 否 | Tier3 |
| 后台调度 | list_jobs, get_job, get_job_progress, cancel/retry/pause/resume_job | 部分（jobs/watch） | Tier1 + Tier3 |
| 技能进化 | list_skills, get_skill, list_brain_skillpack | 否 | Tier3 |
| 三大范式 | —（静态） | — | 无 |

**advisor 落位说明（2026-07-11 补记）**：本表最初把 `advisor` 与 `list_brain_skillpack` 一起归到「技能进化」，那是两个 op 都还没实现时的粗分类。实际后端语义（`src/core/operations.ts` 的 `advisor` op）是全 brain 范围的「接下来该做什么」（版本漂移/待执行迁移/schema-pack 问题/卡住的 job/用量异常/setup smell），没有一类是 skill 专属，且用独立门控 `mcp.publish_advisor`（代码注释明写 "diagnostics are not prose skills"）。已改到「今日动态」页新增的「建议行动」区块。

### 4.3 Tier 3（零后端改动，**推荐主力**）：admin API key → `/mcp` JSON-RPC

**关键发现（实测）**：`POST /admin/api/api-keys` 直接 `INSERT INTO access_tokens`；而 `oauth-provider.ts::verifyAccessToken` 有 `access_tokens` 回退验证路径。因此 **admin 面板签发的 `gbrain_...` API key 可直接作为 Bearer 调用 `POST /mcp`，访问全部 ~90 个操作，且不改任何 `src/` 文件。**

```
前端（admin SPA） --(1) cookie--> POST /admin/api/api-keys  → 得到 gbrain_ 令牌（现有端点）
前端            --(2) Bearer gbrain_ ---> POST /mcp (JSON-RPC: tools/call {name:'query',…})
```

- **优点**：真正零上游改动，覆盖全部操作，天然与 CLI/MCP 契约同源（`operations.ts` 是唯一真相）。
- **落地方式**：新增 `admin/src/lib/mcp-client.ts`，封装 JSON-RPC 请求 + Bearer 注入 + 错误映射；令牌由用户在现有"API Keys"页生成一次后存于内存/会话（**不写 localStorage**，遵循 `api.ts` 的 D11/D12 信任模型）。
- **待验证项**（列入路线图 Phase 0）：
  1. 无 `permissions` 的 legacy `access_tokens` 行默认 scope 是否覆盖 read 类操作（需读 `verifyAccessToken` 后半段确认默认授权）；
  2. `POST /mcp` 的 CORS（`app.use('/mcp', cors(corsOAuthOptions))` 已开）对同源 admin 是否放行。

### 4.4 Tier 2（最小改动，**✅ 已确认允许**）：在 `serve-http.ts` 注册新 `/admin/api/*`

若某页确需 cookie 鉴权的专用端点（而非 Bearer），唯一注册点是 `src/commands/serve-http.ts`（express app 在此构建，无插件钩子）。

> ℹ️ `serve-http.ts` 属 `src/commands/`，不在红线明列的 `src/core`/`src/mcp`/`src/cli.ts` 中。**已获准做受控最小改动**，但仍属上游代码、有 `git merge` 冲突风险，故**优先级仍低于 Tier1/Tier3**：能用现有端点或 MCP Bearer 就不新增。

**已确认的 Tier2 冲突最小化约束（落地时必须遵守）**：
- 所有新增路由集中在**单个连续区块**，插入在现有路由**末尾**（远离上游高频改动区），用醒目注释包裹：`// === CUSTOM ADMIN ROUTES (BEGIN) — see admin/docs/FRONTEND_PLAN.zh.md ===` … `// === CUSTOM ADMIN ROUTES (END) ===`；
- 每个新端点做成薄转发：直接调 `operations.ts` 已导出的 handler（不重写逻辑），降低语义耦合，也便于上游升级时快速核对；
- **每次改动 `serve-http.ts` 必须在 `CUSTOM.md` 追加一行记录**（日期/文件/改了什么），符合二开追踪要求；
- 改后必跑 `bun run test` + `bun run verify`，确认上游测试与静态检查全绿。

### 4.5 类型同步策略（跨编译边界）

`admin/tsconfig.json` 的 `include:['src']` 指向 `admin/src/`，**无法直接 import `../../src/core/` 类型**。沿用现有 `admin/src/lib/scope-constants.ts` 的**手写 mirror**模式：

- 新增 `admin/src/lib/op-types.ts`：手写镜像 8 页所需操作的**入参/出参**最小类型（只镜像用到的字段，非全量）。
- 顶部注释标明"MIRROR OF src/core/operations.ts <op>"，并说明它是手写副本。
- 可选（增强，不强制）：新增 `admin/src/lib/mcp-ops.md` 记录镜像来源版本，便于上游升级时人工核对；若要 CI 兜底，可仿 `scripts/check-admin-scope-drift.sh` 思路，但**该脚本在 `scripts/`（红线），故不新增 CI 脚本**，改为在 `admin/docs/` 记录人工核对清单。

---

## 5. 代码组织与可扩展性

### 5.1 `admin/src/` 目录结构建议（标注 新增/修改/已有）

```
admin/
├─ package.json                 [已改·P1] 追加 tailwindcss@4、@tailwindcss/vite、lucide-react、vitest、@testing-library/*、jsdom（仅 admin）
├─ vite.config.ts               [已改·P1] 加 tailwindcss() 插件 + vitest test 段
├─ index.html                   [已改·P1] 字体链接追加 Noto Sans SC + Noto Serif SC
├─ DESIGN.md                    [待改·P5] 追加「Brain 表层」token 一节（与 Ops 表层并列）
├─ docs/
│  ├─ FRONTEND_PLAN.zh.md       [新增] 本文档
│  └─ TYPE-MIRROR-CHECKLIST.md  [待增·P3] 手写类型镜像的人工核对清单
└─ src/
   ├─ main.tsx                  [已改·P1] import './tailwind.css'（在 index.css 之后）
   ├─ App.tsx                   [已改·P1] 配置化路由 + 双表层派发（现有 6 页零回归）
   ├─ api.ts                    [已有] 复用；新增方法后续追加在末尾
   ├─ index.css                 [已有] Ops 表层暗色主题，**不拆分、原样保留**
   ├─ tailwind.css              [新增·P1] Tailwind v4 入口：theme+utilities（跳过 preflight）+ @theme Brain token
   ├─ routes.ts                 [新增·P1] 路由+导航配置化单一真相（+ routes.test.ts）
   ├─ layouts/
   │  ├─ OpsLayout.tsx          [新增·P1] 暗色壳（逐字沿用原 App 侧边栏）
   │  └─ BrainLayout.tsx        [新增·P1] 浅色 240px 壳 + 分组导航 + Lucide 图标
   ├─ test/setup.ts             [新增·P1] Vitest + jest-dom
   ├─ lib/
   │  ├─ scope-constants.ts     [已有] 手写 mirror（不动）
   │  ├─ mcp-client.ts          [新增·P2] Tier3：Bearer + JSON-RPC 封装（+ mcp-client.test.ts）
   │  ├─ op-types.ts            [新增·P2/P3] 端点+操作响应类型手写镜像
   │  ├─ useSSE.ts              [新增·P2] SSE 数据契约 hook（重连 + 隐藏暂停）
   │  ├─ useMcp.ts              [新增·P3] 声明式 MCP 取数 hook
   │  └─ McpTokenContext.tsx    [新增·P3] MCP 令牌上下文（仅内存）
   ├─ components/brain/index.tsx [新增·P2/P3] PageHeader/StatCard/Badge/StatusPill/McpConnect/AsyncState/Drawer
   │  ├─ ErrorBoundary.tsx      [新增·P5] brain 页错误边界
   │  ├─ PipelineSteps.tsx      [新增·P4] 检索 12 步管道示意（状态机驱动）
   │  └─ GraphCanvas.tsx        [新增·P4] d3-force 力导向图谱（+ GraphCanvas.test.ts，Graph 页懒加载）
   └─ pages/
      ├─ Login/Dashboard/Agents/RequestLog/Calibration/JobsWatch  [已有] 现有 6 页（暗色，保持）
      └─ brain/
         ├─ ThreeParadigms.tsx  [新增·P1] 完整静态页
         ├─ Today.tsx / Jobs.tsx            [新增·P2] Tier1（stats+health+SSE / jobs·watch）
         ├─ Inbox.tsx / Ask.tsx / Skills.tsx / Synthesize.tsx [新增·P3] Tier3（list_pages/query/list_skills/think）
         ├─ Graph.tsx           [新增·P4] Tier3（traverse_graph + 力导向图谱）
         └─ Placeholder.tsx     [新增·P1] 仅未知路由 fallback（8 个页面已全部落地）
```

> **P1 相对方案的两处落地调整**（更简单、更零回归）：
> 1. **Tailwind v4 走 `@tailwindcss/vite` 插件**，无需 `postcss.config.js` / `tailwind.config.ts`；token 直接写进 `tailwind.css` 的 `@theme`。
> 2. **不拆分 `index.css` 为 `themes/ops.css`**（避免无谓 churn），Ops 主题原样留在 `index.css`；Brain 主题独立在 `tailwind.css`，并**跳过 preflight**、仅用 `[data-surface='brain']` 作用域补最小边框基础规则，确保对现有暗色页零影响。

### 5.2 通用组件复用矩阵（横：组件 / 纵：页面）

| 组件＼页面 | 今日 | 入库 | 检索 | 图谱 | 沉淀 | 调度 | 技能 | 范式 | 现有6页 |
|-----------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Sidebar    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓(暗) |
| StatCard   | ✓ | ✓ |   |   |   | ✓ | ✓ |   | ✓ |
| Badge      | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   | ✓ |
| DataTable  |   | ✓ | ✓ |   |   | ✓ | ✓ |   | ✓ |
| Timeline   | ✓ |   |   |   | ✓ |   | ✓ |   |   |
| Drawer     |   | ✓ |   | ✓ | ✓ | ✓ | ✓ |   |   |
| Modal      |   | ✓ |   |   |   | ✓ |   |   | ✓ |
| CodeBlock  |   |   | ✓ |   | ✓ | ✓ |   | ✓ | ✓ |
| Tabs       |   | ✓ |   | ✓ |   | ✓ | ✓ | ✓ | ✓ |
| PipelineSteps | | | ✓ |   |   |   |   |   |   |
| GraphCanvas|   |   |   | ✓ |   |   |   |   |   |

> DataTable/Badge/Modal 等可做成**主题无关**（token 驱动），Ops/Brain 两表层共用，减少重复。

### 5.3 可扩展性设计

- **导航配置化**：`routes.ts` 一份数组 `{ path, label, icon, group, surface, component }`，侧边栏与路由都从它生成 —— 加页 = 加一行。
- **页面即组装**：页面只负责"取 hook 数据 + 摆通用组件"，不含数据逻辑。
- **API hook 即数据契约**：`useMcp('query', params)` / `useSSE(...)`，页面依赖 hook 而非 fetch 细节；换 Tier1↔Tier3 只改 hook 内部。
- **组件 props 驱动 + 主题 token**：组件不写死颜色，全用 CSS 变量；切表层只换 `<body data-surface>`。

### 5.4 与现有 6 页的共存/渐进迁移策略

- **共存**：`App.tsx` 顶层按 `route.surface` 决定挂哪套主题 css 与哪套 Sidebar；现有 6 页归 `surface:'ops'`（暗），8 新页归 `surface:'brain'`（浅），互不影响。
- **渐进迁移（可选，非必须）**：现有 6 页在 Phase 3 后可**逐页**替换为复用新通用组件（DataTable/Badge/Modal），每页替换后跑 Vitest + 视觉比对，回归可控；不做"大爆炸"重写。

---

## 6. 开发步骤与最佳实践

### 6.1 分阶段路线图（含验证步骤）

| 阶段 | 内容 | 验证步骤（每阶段必过） |
|------|------|----------------------|
| **P0 决策+验证**（0.5d） | 确认路线 A/B/C；验证 §4.3 两个待验证项（API key→/mcp scope、CORS） | 手动 curl `/mcp` 用 admin key 成功调 `get_stats`；`bun run test`+`bun run verify` 全绿（基线） |
| **P1 骨架**（1–2d） | Vite+Vitest+**Tailwind/postcss** 配置；themes/ 两套（CSS 变量）；tailwind theme 引用变量；routes.ts；Sidebar/App 表层切换；三大范式页 | `cd admin && bun run build` 通过；`admin/dist` 更新；根 `bun run test`/`verify` 全绿 |
| **P2 复用端点页**（1–2d） | 今日动态、后台调度（走 Tier1 现有端点 + SSE/轮询） | 页面拉到真实 stats/jobs 数据；useSSE 断线重连测试 |
| **P3 MCP 数据页**（3–5d） | mcp-client + op-types；入库/技能/检索/沉淀 | 各页 hook Vitest 单测；mock+真实双通 |
| **P4 可视化难点**（2–4d） | 知识图谱 D3、检索 12 步管道动画 | 图谱在 N 节点下不卡；管道状态机演示 |
| **P5 收尾**（1–2d）✅ | ErrorBoundary、空态(AsyncState)、代码分割(Graph 懒加载 d3-force)、DESIGN.md 追加 Brain 表层、TYPE-MIRROR-CHECKLIST、CUSTOM.md 记录 | vitest 16 过 + build 分块 + 根 typecheck 绿；`admin/dist` 已重建（待提交）；文档已更新 |

> 每阶段结束都必须：`cd admin && bun run build` + 回到根跑 `bun run test` 与 `bun run verify`，确认上游测试与静态检查全部通过。

### 6.2 最佳实践（标注 通用建议 / 项目特有约束）

| 实践 | 类别 | 说明 |
|------|------|------|
| 类型安全用手写 mirror | **项目特有** | 因 admin 与 src/core 跨编译边界，照抄 `scope-constants.ts` 模式 |
| 前端测试隔离在 admin/（Vitest） | **项目特有** | 上游用 Bun test + `test/` 红线，物理隔离避免污染 3700+ 测试 |
| 不写 localStorage/sessionStorage 存令牌 | **项目特有** | 遵循 `api.ts` D11/D12 信任模型；Tier3 令牌仅内存 |
| 依赖只进 admin/package.json | **项目特有** | 根 package.json 零新增，保零冲突 |
| `admin/dist` 提交进 git | **项目特有** | 二进制嵌入需要（`src/admin-embedded.ts`） |
| SSE 连接管理（hidden 暂停+重连+退化轮询） | 通用建议 | `useSSE` 统一封装 |
| 错误边界（React ErrorBoundary） | 通用建议 | 每表层一个兜底 |
| 代码分割（React.lazy 按路由） | 通用建议 | 图谱/D3 等重组件懒加载 |
| 无 spinner，展示陈旧数据直到刷新 | **项目特有** | DESIGN.md 明确反对 skeleton/spinner |
| 语义色而非装饰色 | **项目特有** | 两套 DESIGN.md 哲学一致 |

---

## 7. 文件改动边界速查表（本方案实际触碰面）

| 目录/文件 | 本方案操作 | 是否越红线 |
|-----------|-----------|-----------|
| `admin/src/**`（新增页/组件/lib/themes/routes） | 新增 | ✅ 允许 |
| `admin/package.json` / `admin/bun.lock` | 修改（`bun add`） | ✅ 允许 |
| `admin/vite.config.ts` | 修改（加 vitest） | ✅ 允许 |
| `admin/DESIGN.md` | 修改（追加 Brain 表层节） | ✅ 允许 |
| `admin/docs/**` | 新增 | ✅ 允许 |
| `admin/dist/**` | 修改（构建产物，提交） | ✅ 允许 |
| `.gitignore` | 末尾追加（如 `admin/coverage/`、`admin/.vitest/`） | ✅ 允许（仅追加） |
| `CUSTOM.md` | 追加记录 | ✅ 允许 |
| `docs/operations/**` | 如需运维说明则更新已有二开文档 | ✅ 允许 |
| `src/core/**` `src/mcp/**` `src/cli.ts` `scripts/**` `test/**` `skills/**` 根 `package.json` `README.md` | **不碰** | 🚫 严禁 |
| `src/commands/serve-http.ts` | **Tier1/3 优先，尽量不碰**；已获准 Tier2 受控最小改动（单区块+注释包裹+记 CUSTOM.md+测试全绿），承担冲突风险 | ⚠️ 上游代码，能不碰就不碰 |

**结论**：主力走"路线 A + Tier1/Tier3"，**不触碰任何上游文件**，`git merge upstream/master` 零冲突；仅极少数确需 cookie 专用端点的页面才动 `serve-http.ts`（Tier2），此时冲突面收敛到单个连续路由区块，并有 CUSTOM.md 追踪。

---

## 8. 已确认决策（拍板记录）

| # | 决策项 | 结论 | 对后续章节的影响 |
|---|--------|------|-----------------|
| 1 | 设计语言路线 | **路线 A：双表层共存**（新增浅色 Brain 表层承载 8 页；现有 6 个暗色页不动） | §1/§2/§5 主题按 A 落地 |
| 2 | Tier2 是否允许 | **允许**（个别页确需 cookie 专用端点时可受控改 `serve-http.ts`，遵守 §4.4 约束 + 记 CUSTOM.md），但优先级仍低于 Tier1/Tier3 | §4.4 已锁定约束 |
| 3 | Tailwind 引入时机 | **一开始就引入**（P1 即配置，仅 admin 内，theme 引用 CSS 变量） | §2 CSS 决策 + §5 目录树 + §6 P1 已更新 |

> 下一步：确认本文档后，即可进入 P0（验证 §4.3 两个待验证项）与 P1（骨架搭建）。届时再开始写代码。
