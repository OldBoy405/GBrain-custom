# GBrain Inbox API 使用文档

> 版本对齐：P1 专用 Inbox 契约（`list_inbox` / `get_inbox_item` / `trigger_inbox_enrichment` / `discard_inbox_items`）  
> 后端来源：`src/core/operations.ts`、`src/core/inbox.ts`、`src/core/types.ts`  
> 前端类型镜像：`admin/src/lib/op-types.ts`  
> 关联 UI 分析：`admin/docs/INBOX_PAGE_ANALYSIS.zh.md`

---

## 1. 概述

Inbox（内容入库）是 GBrain 的**收件箱工作流**：把多源采集的内容暂存在 `inbox/` 命名空间下的页面中，经确定性 enrichment 流水线结构化后并入知识图谱。

**设计原则：**

| 原则 | 说明 |
|------|------|
| 无独立队列表 | 工作流状态存在 `pages.frontmatter`，不复制正文 |
| 确定性 enrichment | `inbox_enrich` job **不调用 LLM**，只规范化 frontmatter + 显式链接抽取 |
| Source 隔离 | 所有读写经 `sourceScopeOpts(ctx)`，跨 source 数据不可见 |
| 可恢复丢弃 | `discard_inbox_items` 为软删除，72 小时内可用 `restore_page` 恢复 |

**四个专用 MCP 操作：**

| 操作 | Scope | 用途 |
|------|-------|------|
| `list_inbox` | `read` | 列表 + 聚合统计 |
| `get_inbox_item` | `read` | 单条详情（raw/enriched/typed links） |
| `trigger_inbox_enrichment` | `write` | 入队 `inbox_enrich` 后台任务 |
| `discard_inbox_items` | `write` | 批量软删除 |

以上操作均**非 `localOnly`**，可通过 MCP HTTP（`/mcp`）和 Admin cookie 代理（`/admin/api/op`）远程调用。

---

## 2. 数据模型

### 2.1 页面约定

- **Slug 前缀**：必须以 `inbox/` 开头（如 `inbox/2026-07-10-a1b2c3`）
- **存储**：与普通 `pages` 行相同，无 `inbox_items` 表
- **默认采集 slug**：`ingest_capture` job 在未指定 slug 时生成 `inbox/YYYY-MM-DD-<hash6>`

### 2.2 Frontmatter 工作流字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `inbox_status` | string | 工作流状态（见 §3） |
| `raw_content` | string | 采集时的原始正文快照 |
| `enrichment_tier` | `T1` \| `T2` \| `T3` | 人工/策略分级（可选） |
| `inbox_job_id` | number | 最近一次 enrichment job ID |
| `inbox_error` | string \| null | 失败时的错误信息 |
| `inbox_enriched_at` | ISO8601 | enrichment 完成时间（merged 后写入） |
| `source_kind` | string | 来源类型（如 `mail`、`paste`、`webhook`） |
| `captured_at` | ISO8601 | 采集时间 |
| `ingestion_metadata` | object | 采集侧附加元数据 |
| `inbox_legacy_source` | boolean | 迁移 v123 对历史 inbox 页的标记 |

**状态解析规则**（`src/core/inbox.ts:inboxStatus`）：

- `frontmatter.inbox_status` 为合法枚举值时直接使用
- 否则默认为 `pending_frontmatter`

### 2.3 类型定义（`InboxItem` / `InboxDetail`）

```typescript
// 列表项 — MIRROR OF src/core/types.ts
interface InboxItem {
  slug: string;
  source_id: string;
  type: string;           // PageType，如 note
  title: string;
  updated_at: string;   // ISO8601（HTTP JSON 序列化后）
  source_kind: string | null;
  source_uri: string | null;
  ingested_at: string | null;
  status: InboxStatus;
  tier: 'T1' | 'T2' | 'T3' | null;
  job_id: number | null;
  error: string | null;
  preview: string;        // compiled_truth 前 180 字符
}

// 详情 — 扩展 InboxItem
interface InboxDetail extends InboxItem {
  raw_content: string;
  enriched_content: string;   // 含 frontmatter 的完整 markdown
  frontmatter: Record<string, unknown>;
  typed_links: Link[];
}

interface InboxListResult {
  items: InboxItem[];
  stats: {
    total: number;
    pending_enrich: number;  // status !== 'merged'
    merging: number;
    merged: number;
  };
}
```

`typed_links` 对齐 `Link` 接口：

| 字段 | 说明 |
|------|------|
| `from_slug` | 边起点 |
| `to_slug` | 边终点 |
| `link_type` | 关系类型（如 `mentions`、`invested_in`） |
| `context` | 证据文本 |
| `link_source` | `markdown` \| `frontmatter` \| `manual` \| null |
| `origin_slug` | frontmatter 来源页（可选） |
| `origin_field` | frontmatter 字段名（可选） |

---

## 3. 状态机

```
pending_frontmatter ──trigger──► merging ──success──► merged
        ▲                            │
        │                            │ failure
        └──── pending_typed_link ◄───┘
              (+ inbox_error)
```

| 状态 | 含义 |
|------|------|
| `pending_frontmatter` | 已入库，待 enrichment（默认） |
| `pending_typed_link` | enrichment 失败或中断，待重试 |
| `merging` | `inbox_enrich` job 执行中 |
| `merged` | 确定性流水线已完成 |

**统计口径**（`list_inbox.stats`）：

- `total`：当前 source 范围内全部 `inbox/*` 页
- `pending_enrich`：`status !== 'merged'`
- `merging` / `merged`：按 `inbox_status` 计数

---

## 4. 访问通道与鉴权

### 4.1 三种调用方式

| 通道 | 适用场景 | 端点 |
|------|----------|------|
| **本地 CLI** | 开发、脚本、`dryRun` | `gbrain call <op> '<json>'` |
| **MCP Bearer** | Agent、API Key | `POST /mcp`（JSON-RPC `tools/call`） |
| **Admin Cookie** | 已登录管理后台 | `POST /admin/api/op` |

Admin 前端（`admin/src/lib/mcp-client.ts`）自动选择通道：

- 内存中有 `gbrain_` 令牌 → Bearer `/mcp`
- 否则 → cookie `/admin/api/op`（401 跳转 `#login`）

### 4.2 Scope 要求

| 操作 | 最低 scope |
|------|------------|
| `list_inbox`、`get_inbox_item` | `read` |
| `trigger_inbox_enrichment`、`discard_inbox_items` | `write` |

Admin cookie 代理以 `scopes: ['admin']` 调用，等效于全权限本地操作员。

### 4.3 Source 路由

与 GBrain 双轴模型一致：

```bash
# CLI：显式指定 source
gbrain call --source wiki list_inbox '{}'

# 环境变量
GBRAIN_SOURCE=wiki gbrain call list_inbox '{}'

# MCP：令牌 permissions.source_id 或操作级 source_id（若操作支持）
```

`list_inbox` / `get_inbox_item` / `trigger_*` / `discard_*` 均通过 `sourceScopeOpts(ctx)` 过滤；**超出授权 source 的 slug 视为不存在**（`not_found_or_out_of_scope`）。

---

## 5. API 参考

### 5.1 `list_inbox`

列出当前 source 范围内的 `inbox/*` 页面，并返回聚合统计。

**参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `status` | string | 否 | — | `pending_frontmatter` \| `pending_typed_link` \| `merging` \| `merged` |
| `source_kind` | string | 否 | — | 按 `source_kind` / `captured_via` 过滤 |
| `tier` | string | 否 | — | `T1` \| `T2` \| `T3` |
| `limit` | number | 否 | 50 | 最大 100 |
| `sort` | string | 否 | `updated_desc` | `updated_desc` \| `updated_asc` \| `created_desc` \| `slug` |

**返回**：`InboxListResult`

**示例（CLI）**

```bash
gbrain call list_inbox '{"status":"pending_frontmatter","limit":20}'
```

**示例（MCP JSON-RPC）**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_inbox",
    "arguments": { "limit": 100, "sort": "updated_desc" }
  }
}
```

**示例响应**

```json
{
  "items": [
    {
      "slug": "inbox/2026-07-10-a1b2c3",
      "source_id": "default",
      "type": "note",
      "title": "会议纪要草稿",
      "updated_at": "2026-07-10T06:00:00.000Z",
      "source_kind": "mail",
      "source_uri": "mailto:alice-example@acme-example.com",
      "ingested_at": "2026-07-10T06:00:00.000Z",
      "status": "pending_frontmatter",
      "tier": "T2",
      "job_id": null,
      "error": null,
      "preview": "今天讨论了 widget-co 的 seed round…"
    }
  ],
  "stats": {
    "total": 12,
    "pending_enrich": 8,
    "merging": 1,
    "merged": 3
  }
}
```

**实现注意**：引擎先取最多 100 条 `inbox/` 页计算 `stats`，再按 filter 截断 `items`。`stats` 反映**过滤前**的全量 inbox，不受 `limit` 影响。

---

### 5.2 `get_inbox_item`

获取单条 inbox 详情，含 raw/enriched 对比与 typed links。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 必须以 `inbox/` 开头 |

**返回**：`InboxDetail`

**错误**

| 错误码 | 条件 |
|--------|------|
| `invalid_params` | slug 不以 `inbox/` 开头 |
| `page_not_found` | 页面不存在或超出 source 范围 |

**示例**

```bash
gbrain call get_inbox_item '{"slug":"inbox/2026-07-10-a1b2c3"}'
```

**字段说明**

- `raw_content`：优先 `frontmatter.raw_content`，否则 `compiled_truth`
- `enriched_content`：`serializeMarkdown` 重建的完整文档（含 YAML frontmatter + tags）
- `typed_links`：`get_links` 的出边列表（受 source scope 约束）

---

### 5.3 `trigger_inbox_enrichment`

为 1–50 条 inbox 页入队 `inbox_enrich` Minion 任务。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slugs` | string[] | 是 | 1–50 个唯一 `inbox/` slug |
| `tier` | string | 否 | 触发时写入 `enrichment_tier`（`T1`/`T2`/`T3`） |

**返回**

```typescript
interface TriggerInboxEnrichmentResult {
  accepted: Array<{ slug: string; job_id: number; status: string }>;
  skipped: Array<{ slug: string; reason: string }>;
}
```

**`skipped.reason` 取值**

| reason | 含义 |
|--------|------|
| `not_found_or_out_of_scope` | 页面不存在或不在当前 source |
| `already_enriched_for_revision` | 同内容 revision 的 job 已完成 |

**错误**

| 错误码 | 条件 |
|--------|------|
| `invalid_params` | slugs 为空、>50、含非 `inbox/` slug |

**幂等性**

- `idempotency_key = inbox-enrich:{source_id}:{slug}:{revision}`
- `revision` = `sha256(raw_content)` 前 16 位
- 同一 revision 重复触发返回**同一 `job_id`**，不创建 duplicate job

**示例**

```bash
gbrain call trigger_inbox_enrichment '{"slugs":["inbox/a","inbox/b"],"tier":"T2"}'
```

**示例响应**

```json
{
  "accepted": [
    { "slug": "inbox/a", "job_id": 42, "status": "waiting" }
  ],
  "skipped": [
    { "slug": "inbox/b", "reason": "not_found_or_out_of_scope" }
  ]
}
```

**副作用**

- 入队前将页面 `inbox_status` 设为 `merging`（job 已在执行中时跳过覆写）
- 写入 `inbox_job_id`，清空 `inbox_error`
- job 入队 `delay: 250ms`，避免与 worker 竞态

---

### 5.4 `discard_inbox_items`

批量丢弃 inbox 页面。默认 **软删除**；`mode: 'hard'` 为永久删除。

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slugs` | string[] | 是 | 1–50 个唯一 `inbox/` slug |
| `mode` | string | 否 | `soft`（默认，72h 可 `restore_page`）或 `hard`（永久级联删除） |

**返回**

```typescript
interface DiscardInboxItemsResult {
  mode: 'soft' | 'hard';
  discarded: string[];
  failed: Array<{ slug: string; reason: string }>;
}
```

**`failed.reason` 取值**

| reason | 含义 |
|--------|------|
| `not_found_or_out_of_scope` | 不存在或超出 source |
| `already_soft_deleted` | 已软删除（仅 soft 模式） |
| `hard_delete_failed` | 硬删除引擎错误（仅 hard 模式） |

**示例**

```bash
gbrain call discard_inbox_items '{"slugs":["inbox/spam-001"]}'
```

---

## 6. 内容采集（入库入口）

Inbox 页通常由 **`ingest_capture` Minion job** 创建，而非直接 `put_page`。

### 6.1 提交流程

```bash
gbrain jobs submit ingest_capture --params '{
  "event": {
    "content": "# 标题\n\n正文…",
    "content_type": "text/markdown",
    "source_kind": "paste",
    "source_uri": null,
    "received_at": "2026-07-10T07:00:00Z"
  }
}' --follow
```

PGLite 环境须加 `--follow`（无常驻 worker daemon）。

### 6.2 `inbox/` slug 的 frontmatter 自动盖章

当目标 slug 以 `inbox/` 开头时，`prepareInboxCaptureContent` 自动写入：

```yaml
inbox_status: pending_frontmatter
raw_content: <原始正文>
source_kind: <event.source_kind>
captured_at: <event.received_at>
ingestion_metadata: <event.metadata>  # 若有
```

已有 frontmatter 字段**不会被覆盖**（只补缺失项）。

### 6.3 默认 slug

未指定 `job.data.slug` 且 `event.metadata.slug` 为空时：

```
inbox/YYYY-MM-DD-<sha256(content)前6位>
```

---

## 7. Enrichment 后台任务（`inbox_enrich`）

`trigger_inbox_enrichment` 入队的 job 类型为 **`inbox_enrich`**（handler：`src/core/minions/handlers/inbox-enrich.ts`）。

### 7.1 四步流水线（确定性、零 LLM）

| 步骤 | Progress phase | 动作 |
|------|----------------|------|
| 1. Normalize | `inbox_enrich.normalize` | 确保 `raw_content` 快照；`inbox_status → merging` |
| 2. Frontmatter | （同上阶段内） | 合并 workflow 字段，`inbox_status → merged`，写 `inbox_enriched_at` |
| 3. Typed-link | `inbox_enrich.merge` | `runAutoLink` 抽取显式 wikilink / frontmatter 引用 |
| 4. Merge | （完成） | `importFromContent` 回写页面；返回 link 统计 |

**不做的事：**

- 不调用 embedding / LLM
- 不从散文中猜测实体
- 不修改 `manual` / 非本页 `markdown` 来源的已有边

### 7.2 成功返回

```json
{
  "slug": "inbox/a",
  "status": "merged",
  "job_id": 42,
  "links": { "created": 2, "removed": 0, "errors": 0 }
}
```

### 7.3 失败处理

- 页面 `inbox_status → pending_typed_link`
- `inbox_error` 写入错误信息
- job 标记 failed，可 `gbrain jobs retry <id>` 重试

### 7.4 执行 job（PGLite vs Postgres）

| 引擎 | 推荐方式 |
|------|----------|
| **PGLite** | `gbrain jobs submit inbox_enrich --params '{"slug":"inbox/a","source_id":"default"}' --follow` |
| **Postgres** | 常驻 `gbrain jobs work`，或 `--follow` 单次执行 |

查询 job 状态：

```bash
gbrain jobs get <job_id>
gbrain call get_job '{"id":42}'
```

---

## 8. 关联操作

| 操作 | 用途 |
|------|------|
| `submit_job` | 提交 `ingest_capture` / 其他采集 job |
| `get_job` / `list_jobs` | 跟踪 enrichment 进度 |
| `retry_job` | 重试失败的 `inbox_enrich` |
| `restore_page` | 恢复 `discard_inbox_items` 软删除的页 |
| `get_links` / `traverse_graph` | 查看 enrichment 产出的图谱边 |
| `delete_page` | 硬删除（与 discard 不同，慎用） |

---

## 9. HTTP 调用示例

### 9.1 Admin Cookie 代理（已登录）

```bash
# 先登录获取 cookie（或用浏览器 DevTools 复制）
curl -s -c cookies.txt -X POST http://localhost:3131/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"token":"<bootstrap-token>"}'

curl -s -b cookies.txt -X POST http://localhost:3131/admin/api/op \
  -H 'Content-Type: application/json' \
  -d '{"name":"list_inbox","arguments":{"limit":10}}'
```

响应信封与 MCP 相同：`{ "result": { "content": [{ "type": "text", "text": "<JSON>" }] } }`

### 9.2 MCP Bearer

```bash
curl -s -X POST http://localhost:3131/mcp \
  -H 'Authorization: Bearer gbrain_...' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{"name":"list_inbox","arguments":{"limit":10}}
  }'
```

---

## 10. 完整工作流示例

### 10.1 采集 → 列表 → 详情 → enrichment → 验证

```bash
# 1. 采集一条粘贴内容
bun run src/cli.ts jobs submit ingest_capture --params '{
  "event": {
    "content": "# 笔记\n\n提到了 [概念页](concepts/widget-co)。",
    "content_type": "text/markdown",
    "source_kind": "paste",
    "received_at": "2026-07-10T08:00:00Z"
  }
}' --follow

# 2. 列出 inbox（记下返回的 slug）
bun run src/cli.ts call list_inbox '{"limit":5}'

# 3. 查看详情与 typed links
bun run src/cli.ts call get_inbox_item '{"slug":"inbox/2026-07-10-xxxxxx"}'

# 4. 触发 enrichment
bun run src/cli.ts call trigger_inbox_enrichment '{"slugs":["inbox/2026-07-10-xxxxxx"]}'

# 5. PGLite：inline 执行 job
bun run src/cli.ts jobs submit inbox_enrich \
  --params '{"slug":"inbox/2026-07-10-xxxxxx","source_id":"default"}' --follow

# 6. 确认 merged
bun run src/cli.ts call get_inbox_item '{"slug":"inbox/2026-07-10-xxxxxx"}'
```

### 10.2 Admin 前端联调

```bash
# 终端 1：HTTP 服务
bun run src/cli.ts serve --http --port 3131

# 终端 2：Vite 热更新（代理 API 到 3131）
cd admin && bun run dev
# 打开 http://localhost:5173/admin/#/inbox
```

详见 `admin/CLAUDE.md`「本地联调」一节。

---

## 11. 错误处理与调试

### 11.1 操作级错误（HTTP 200 + `isError`）

MCP 工具失败时 HTTP 仍为 200，错误在 `result.isError` + `content[].text` 中：

```json
{
  "result": {
    "isError": true,
    "content": [{ "type": "text", "text": "{\"error\":\"page_not_found\",\"message\":\"Page not found: inbox/missing\"}" }]
  }
}
```

Admin `callMcp` 会将其解包为抛出的 `McpError`。

### 11.2 常见问题

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 列表为空 | 无 `inbox/` 页；source 路由错误 | 检查 `GBRAIN_SOURCE`；用 `list_pages` + `slugPrefix` 排查 |
| trigger 后一直 `merging` | job 未被执行 | PGLite 需 `--follow` 或 Postgres worker |
| `pending_typed_link` + error | enrichment 失败 | 读 `inbox_error`；`retry_job` |
| 跨 source 看不到数据 | source 隔离 | 切换 source 或检查令牌 `permissions` |
| 历史页无 `raw_content` | 升级前入库 | 运行迁移 v123 `inbox_workflow_frontmatter` |

### 11.3 测试入口

```bash
# 后端工作流单测
bun test test/inbox-workflow.test.ts

# Admin Inbox 页
cd admin && bun run test -- src/pages/brain/__tests__/Inbox.page.test.tsx
```

---

## 12. 迁移与向后兼容

**迁移 v123 `inbox_workflow_frontmatter`** 对已有 `inbox/%` 且未删除的页面：

1. 若缺 `raw_content` → 回填为当前 `compiled_truth`
2. 若缺 `inbox_status` → 设为 `pending_frontmatter`
3. 写入 `inbox_legacy_source: true`

不影响正文与图谱边；仅补 workflow 元数据。

---

## 13. 前端集成要点

| 模块 | 职责 |
|------|------|
| `admin/src/lib/useInbox.ts` | 轮询 `list_inbox` |
| `admin/src/lib/useInboxDetail.ts` | 懒加载 `get_inbox_item` |
| `admin/src/pages/brain/Inbox.tsx` | 列表筛选、批量 trigger/discard |
| `admin/src/components/brain/InboxCard.tsx` | 卡片：source_kind、status、tier |
| `admin/src/components/brain/InboxDetail.tsx` | RAW/ENRICHED 对比 |
| `admin/src/components/brain/TypedLinkTable.tsx` | typed links 表格 |

类型变更时同步 `admin/src/lib/op-types.ts`（清单见 `admin/docs/TYPE-MIRROR-CHECKLIST.md`）。

---

## 14. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-10 | P1：新增四个专用 Inbox 操作；`inbox_enrich` handler；迁移 v123；Admin 切换专用契约 |
