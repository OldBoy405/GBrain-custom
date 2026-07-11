# 类型镜像人工核对清单

`admin/` 与 `src/core/` 跨编译边界（admin `tsconfig.json` `include:['src']` 指向 `admin/src/`），
无法直接 `import` 上游类型。因此 `admin/src/lib/op-types.ts` 是**手写镜像**，沿用
`admin/src/lib/scope-constants.ts` 的既有模式。

**没有为此新增 CI 脚本**（`scripts/` 是上游红线，不新增），改为在此人工核对。
每次 `git merge upstream/master` 后，若下列上游来源有改动，同步更新 `op-types.ts` 对应类型。

## 镜像映射表

| op-types.ts 类型 | 上游来源（真相） | 核对点 |
|---|---|---|
| `AdminStats` | `src/commands/serve-http.ts` `GET /admin/api/stats` 响应 | 字段名/增删 |
| `HealthIndicators` | `src/commands/serve-http.ts` `GET /admin/api/health-indicators` 响应 | `error_rate` 仍为字符串（带 %） |
| `FeedEvent` | `src/commands/serve-http.ts` `broadcastEvent(...)` → SSE `/admin/events` | 广播字段（agent/operation/scopes/latency_ms/status） |
| `JobsWatchSnapshot` | `src/commands/jobs-watch.ts` `readSnapshot()` | by_type/queue_health/top_errors/budget_owners 结构 |
| `PageSummary` | `src/core/operations.ts` `list_pages` 返回映射 | slug/type/title/updated_at/deleted_at |
| `QueryResult` | `src/core/operations.ts` `query` → hybridSearch 结果项 | 宽松镜像；只取渲染用字段 |
| `SkillEntry` / `ListSkillsResult` | `src/core/skill-catalog.ts` `SkillCatalogEntry` / `ListSkillsResult` | 字段增删；`mcp.publish_skills` 门控行为 |
| `ThinkResult` | `src/core/operations.ts` `think` 返回 | 宽松镜像（含索引签名）；**无 conflicts 字段**；citations 为 `page_slug/row_num/citation_index`；gaps 为 `string[]`；remote 不落库 |
| `ConflictGroup` / `ConflictMember` / `FindConflictsResult` | `src/core/operations.ts` `find_conflicts` 返回 | groups/source/note；成员 slug/title/type/updated_at/excerpt |
| `CompileTruthResult` / `CompileDiffRow` | `src/core/operations.ts` `compile_truth` 返回（`src/core/compile-truth.ts`） | compiled_markdown/diff(op:keep\|merge\|add\|remove)/model_used/sources/warnings |
| `AdoptCompiledTruthResult` | `src/core/operations.ts` `adopt_compiled_truth` 返回 | slug/status/compiled_from |
| `GraphNode` | `src/core/types.ts` `GraphNode` | slug/title/type/depth/links |
| `InboxItem` / `InboxListResult` / `EnrichmentStatus` / `TypedLink` | `src/core/types.ts` + `operations.ts` `list_inbox` / `get_inbox_item` | 字段名、状态枚举、typed link 原生形状 |
| `TriggerInboxEnrichmentResult` / `DiscardInboxItemsResult` | `operations.ts` `trigger_inbox_enrichment` / `discard_inbox_items` | accepted/skipped、discarded/failed 形状 |

## 核对流程（合并上游后）
1. `git merge upstream/master` 完成后，`git diff <base>..HEAD -- src/commands/serve-http.ts src/core/operations.ts src/core/types.ts src/core/skill-catalog.ts src/commands/jobs-watch.ts`
2. 若上述文件中被镜像的形状有变，更新 `admin/src/lib/op-types.ts` 对应接口。
3. `cd admin && bun run build && bunx vitest run` + 根 `bun run typecheck`，确认全绿。

## 备注
- Tier3（`callMcp`）返回的是操作 handler 的 JSON，形状即 `operations.ts` 的 handler 返回值；
  Tier1（`/admin/api/*`）返回的是 serve-http 里各 handler 的 `res.json(...)`。两类来源不同，分别核对。
- 宽松镜像（`QueryResult`/`ThinkResult`）刻意只声明渲染用到的可选字段，上游加字段不会破坏前端。
