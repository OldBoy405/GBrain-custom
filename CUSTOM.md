# GBrain 二次开发记录

## 基本信息

| 项 | 值 |
|----|-----|
| 官方仓库 | https://github.com/garrytan/gbrain |
| 二开仓库 | https://github.com/OldBoy405/GBrain-custom |
| 主开发分支 | `custom/main` |
| 产品名 | （待填写） |
| 是否对外分发 | （是/否，待填写） |
| 上次提交 | `5a57912`（2026-07-07 16:33，`Merge upstream/master`） |
| 工作区状态（截至 2026-07-11） | 已跟踪 24 文件（+1478/−286）；未跟踪 ~116 文件（主要在 `admin/`） |

---

## 未提交改动总览（2026-07-07 16:33 以来）

在官方暗色 Ops cockpit 之上，落地 **「Ops 暗色 + Brain 浅色」双表层 SPA（8 页）**，并打通三条端到端链路：**Inbox 入库**、**真理沉淀（Compiled Truth）**、**精准检索 + 查询诊断**；辅以 cookie 免令牌代理、Why? 教育按钮与配套文档/测试。

| 分区 | 路径 | 是否动上游 |
|------|------|-----------|
| Brain 前端 SPA | `admin/src/**` | 否（fork-safe） |
| Inbox 入库 | `src/core/inbox.ts` + 4 op + handler + `Inbox.tsx` | **是** |
| 真理沉淀 | `conflicts.ts` / `compile-truth.ts` + 3 op + `Synthesize.tsx` | **是** |
| Admin 鉴权代理 | `serve-http.ts` + `mcp-client.ts` | **是**（薄层） |
| Jobs/Skills/Ask 深化 | `execution-lane` / `status.ts` / `query trace` + admin 页 | **部分** |
| 文档 / 教育 | `admin/docs/**`、`why-topics.ts` | 否 |

**验证**：Admin Vitest 120 用例（119 过，`Synthesize.page.test.tsx` 标题断言 1 处待对齐）；根 `bun run typecheck` 通过（`Agents.tsx` 3 处预存错误除外）。

> 上游改动明细与合并原则 → 见下一节。**Admin-only 改动** → 见「Admin 前端改动」节。

---

## 上游代码改动（`src/` / `test/` / `scripts/`）

> **范围**：凡落在官方仓库目录树内的代码（不含 `admin/`）。`admin/dist` 嵌入产物 `src/admin-embedded.ts` 随 admin 构建自动刷新，逻辑上归属 admin 构建链，但文件物理位置在 `src/`。

### 合并冲突总则

执行 `git merge upstream/master` 时，对本节所列文件的**默认原则**：

1. **两边都保留**——不采用「取上游覆盖二开」或「取二开覆盖上游」的二选一。
2. **逻辑整合**——把上游新增/重构的代码作为基底，再把二开改动**重新贴回**到整合后的正确位置；若上游重命名了变量/函数，跟着改名后保留二开语义。
3. **加法优先**——本仓库对上游的改动以「新增文件 / 新增 op / 新增可选参数 / 新增返回字段 / 新增 migration / 新增 register 行」为主，不改既有参数的默认行为；整合后应保证**未使用新能力时行为与上游一致**。
4. **标记区块**——`serve-http.ts` 的 `CUSTOM ADMIN ROUTES (BEGIN/END)` 整块保留；与上游路由冲突时，先合并上游路由，再把 CUSTOM 块贴到文件末尾合适位置。
5. **合并后必跑**——`bun run typecheck` + 本节涉及的测试文件 + `admin/docs/TYPE-MIRROR-CHECKLIST.md` 人工核对。

---

### 上游改动清单

#### A. 已提交（2026-07-03 ~ 07-04，在 `5a57912` 之前）

| 日期 | 文件 / 符号位置 | 改动摘要 | 冲突整合原则 |
|------|----------------|----------|--------------|
| 2026-07-03 | `src/core/ai/dims.ts` · `dimsProviderOptions()` | 新增可选第 5 参 `providerId`；`providerId==='ollama'` 时对任意模型返回 `{ openaiCompatible: { dimensions } }` | 保留 5 参签名与 Ollama 分支；上游若改 embed 维度逻辑，在合并后的函数体末尾保留 Ollama 特例 |
| 2026-07-03 | `src/core/ai/gateway.ts` · `embed()` | 调用 `dimsProviderOptions(...)` 时传入 `recipe.id` | 保留 `recipe.id` 传参；其余 embed 路径以上游为准 |
| 2026-07-03 | `src/core/embedding-dim-check.ts` · `isCustomDimValidForProvider()` | 放行 Ollama 及 `user_provided_models` recipe 的显式自定义维度 | 保留放行规则；上游若新增 provider 校验分支，与之并列不互斥 |
| 2026-07-03 | `test/ai/gateway.test.ts` | Ollama 维度传参 + `providerId` 向后兼容用例 | 测试文件：两边用例都保留 |
| 2026-07-03 | `test/embedding-dim-check.test.ts` | Ollama / llama-server / litellm 维度用例 | 同上 |
| 2026-07-04 | `src/core/config.ts` · `deepseek_api_key` | 文件平面字段 + `DEEPSEEK_API_KEY` env + `KNOWN_CONFIG_KEYS` 注册 | 保留字段注册行；上游新增 key 时一并注册，不删 DeepSeek |
| 2026-07-04 | `src/core/ai/build-gateway-config.ts` | `deepseek_api_key`→`DEEPSEEK_API_KEY`；`DEEPSEEK_BASE_URL`→`base_urls.deepseek` | 保留 DeepSeek env 注入；与 openai/anthropic 同模式并列 |
| 2026-07-04 | `src/core/ai/recipes/deepseek.ts` | `expansion` touchpoint；V4 模型列表；1M context | 整文件保留；上游若改 recipe 结构，迁移字段后保留 expansion 配置 |
| 2026-07-04 | `src/core/model-pricing.ts` | 登记 `deepseek-v4-flash` / `deepseek-v4-pro` | 保留定价行；定价以本文件为唯一真源，不手抄到别处 |
| 2026-07-04 | `test/ai/build-gateway-config.test.ts` 等 | DeepSeek config / expansion / 定价回归 | 两边用例都保留 |

#### B. 未提交（2026-07-08 ~ 07-11，在 `5a57912` 之后）

| 日期 | 文件 / 符号位置 | 改动摘要 | 冲突整合原则 |
|------|----------------|----------|--------------|
| 2026-07-09 | `src/commands/serve-http.ts` · `mcpOperations` | 上提 `operations.filter(!localOnly)`，`/mcp` 与 `/admin/api/op` 共用 | 保留上提后的单一来源；上游若改 filter 条件，合并条件后仍共用 |
| 2026-07-09 | `src/commands/serve-http.ts` · `CUSTOM ADMIN ROUTES` | 新增 `POST /admin/api/op`（cookie `requireAdmin`→`dispatchToolCall`，响应 `{result:ToolResult}`） | **整块保留** BEGIN/END 标记内代码；上游路由追加后 CUSTOM 块贴末尾 |
| 2026-07-08~11 | `src/core/inbox.ts` · **新文件** | Inbox 投影/状态：`pageToInboxItem`、`prepareInboxCaptureContent`、`patchInboxFrontmatter` 等 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/types.ts` · `INBOX_STATUSES` / `INboxItem` / `InboxDetail` | `PageFilters` 之后追加 inbox 类型块 | 保留类型块；上游若在相邻位置加类型，顺序上 inbox 块不删 |
| 2026-07-08~11 | `src/core/migrate.ts` · `inbox_workflow_frontmatter` | 回填存量 `inbox/*` 页的 `inbox_status` / `inbox_legacy_source` | 保留 migration 条目；**注意 version 序号**不与上游新 migration 撞号，必要时改序号 |
| 2026-07-08~11 | `src/core/operations.ts` · `list_inbox` / `get_inbox_item` / `trigger_inbox_enrichment` / `discard_inbox_items` | 4 个新 op，插在 `list_pages` 与 `search` 之间 | 整段 op 定义保留；上游同位置新增 op 时按逻辑顺序并列，导出数组也要注册 |
| 2026-07-08~11 | `src/core/operations.ts` · `find_conflicts` / `compile_truth` / `adopt_compiled_truth` | 真理沉淀 3 op + 导出数组注册 | 整段保留；`compile_truth` handler 依赖 `compile-truth.ts`，合并后确认 import 仍在 |
| 2026-07-08~11 | `src/core/operations.ts` · `list_jobs` / `get_job` handler | 返回前 `.map()` 附加 `execution_lane`（`getExecutionLane(name)`） | 保留 `.map()` 追加；上游若改返回形状，在最终返回前加回 `execution_lane` |
| 2026-07-11 | `src/core/operations.ts` · `query` op | 可选 `trace: boolean`；`trace===true` 时返回 `{results, trace}` | 保留 `trace` 参数与条件分支；注意 `capturedMeta` 变量名随上游同步 |
| 2026-07-08~11 | `src/core/conflicts.ts` · **新文件** | `groupConflicts()` union-find 矛盾分组 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/compile-truth.ts` · **新文件** | `compileTruth()` LLM 合并提案 + `parseCompileJSON` | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/minions/execution-lane.ts` · **新文件** | `getExecutionLane(name)` 纯函数 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/minions/handlers/inbox-enrich.ts` · **新文件** | 零 LLM 确定性 enrichment handler | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/minions/handlers/ingest-capture.ts` · handler 体 | `isInboxSlug` 分支 → `prepareInboxCaptureContent`；`importFromContent` 传 `source_kind`/`source_uri` | 保留 inbox 分支与额外 opts；非 inbox 路径以上游为准 |
| 2026-07-08~11 | `src/commands/jobs.ts` · `registerBuiltinHandlers` | 追加 `worker.register('inbox_enrich', makeInboxEnrichHandler(engine))` | 保留 register 行；不删上游新增 register |
| 2026-07-11 | `src/commands/status.ts` · `CycleRow` / `toCycleRow()` | 新增 `phases` 字段，从 `result.report.phases` 投影 | 保留 `phases` 字段投影；上游改 `CycleRow` 时字段并列 |
| 2026-07-11 | `src/cli.ts` · `case 'search': case 'query':` | `const results = Array.isArray(result) ? result : result?.results` 防御性解包 | **仅保留这一行解包**；其余格式化逻辑以上游为准 |
| 2026-07-08~11 | `src/core/eval-shared/json-repair.ts` | `compile-truth.ts` 复用 `stripFences` / `tryParse` / `repairJson`（小改动） | 保留上游 json-repair 逻辑；二开若仅增加 export 使用方，不改修复算法 |
| 2026-07-08~11 | `src/admin-embedded.ts` | admin `bun run build` 后嵌入的静态资源哈希刷新 | **不手改**——合并冲突时以 `bun run build:admin` 重新生成为准 |
| 2026-07-08~11 | `test/inbox-workflow.test.ts` · **新文件** | inbox op + handler 集成测试 | 新文件保留 |
| 2026-07-08~11 | `test/conflicts.test.ts` · **新文件** | `groupConflicts` 纯函数测试 | 新文件保留 |
| 2026-07-08~11 | `test/compile-truth.test.ts` · **新文件** | `compileTruth` / `parseCompileJSON` 测试 | 新文件保留 |
| 2026-07-08~11 | `test/ingestion/ingest-capture.test.ts` | inbox slug 捕获路径用例扩展 | 保留 inbox 用例；上游用例不删 |

#### C. 根目录脚本（非 `src/` 但影响上游构建链）

| 日期 | 文件 / 符号位置 | 改动摘要 | 冲突整合原则 |
|------|----------------|----------|--------------|
| 2025-06-25 | `package.json` · `postinstall` | bash 内联 → `bun run scripts/postinstall.ts` | 保留 ts 脚本引用；上游 postinstall 追加时两步都跑或合并为 ts |
| 2025-06-25 | `scripts/postinstall.ts` · **新文件** | 跨平台 postinstall（Windows 兼容） | 新文件保留；上游若改 postinstall 逻辑，迁入 ts 脚本 |

---

### 上游改动按主题索引

| 主题 | 涉及文件 | 首次日期 |
|------|----------|----------|
| Ollama 自定义 embed 维度 | `dims.ts`、`gateway.ts`、`embedding-dim-check.ts` + tests | 2026-07-03 |
| DeepSeek provider | `config.ts`、`build-gateway-config.ts`、`recipes/deepseek.ts`、`model-pricing.ts` + tests | 2026-07-04 |
| Admin cookie MCP 代理 | `serve-http.ts`（CUSTOM 区块） | 2026-07-09 |
| Inbox 入库工作流 | `inbox.ts`、`types.ts`、`migrate.ts`、`operations.ts`×4、`inbox-enrich.ts`、`ingest-capture.ts`、`jobs.ts` + tests | 2026-07-08~11 |
| 真理沉淀 Compiled Truth | `conflicts.ts`、`compile-truth.ts`、`operations.ts`×3、`json-repair.ts` + tests | 2026-07-08~11 |
| Jobs 执行通道 | `execution-lane.ts`、`operations.ts`（list/get job） | 2026-07-11 |
| Dream Cycle phase 耗时 | `status.ts` | 2026-07-11 |
| Query 检索诊断 | `operations.ts`（query）、`cli.ts` | 2026-07-11 |

---

## Admin 前端改动（`admin/` only，fork-safe）

> **原则**：所有 Brain 功能默认 **零上游改动**；仅通过既有 op / Tier1 REST / cookie 代理消费后端。依赖只进 `admin/package.json`。

### 架构

- **双表层**：Ops 暗色 6 页（`#dashboard`…）+ Brain 浅色 8 页（`#/`、`#/inbox`…），`routes.ts` 单一配置源。
- **数据双通道**：Tier1 `api.ts`（cookie）；Tier3 `mcp-client.ts`（Bearer `/mcp` 或 cookie `/admin/api/op`）。
- **信任模型**：令牌仅内存，不写 localStorage；401 → `#login`。

### 改动清单（按时间）

| 日期 | 范围 | 要点 |
|------|------|------|
| 2026-07-07 | P1 骨架 | `BrainLayout`/`OpsLayout`、`tailwind.css`、配置化路由、Vitest 基建 |
| 2026-07-07 | P2 页面 | `Today.tsx`（Tier1+SSE）、`Jobs.tsx`（jobs/watch 轮询）、`mcp-client`/`useSSE`/`op-types` |
| 2026-07-07 | P3 页面 | `Inbox`/`Ask`/`Skills`/`Synthesize` 初版（后 Inbox/Synthesize 换专用 op） |
| 2026-07-07 | P4 可视化 | `Graph.tsx`、`PipelineSteps.tsx`（后 Graph 换 ForceGraph） |
| 2026-07-07 | P5 收尾 | `ErrorBoundary`、`React.lazy` 分割 Graph chunk、`DESIGN.md` Brain 规范 |
| 2026-07-07 | 联调修正 | `mcp-client` 解包 `isError`；`Skills` 降级文案 |
| 2026-07-09 | 鉴权 UX | `BrainTopBar` Bearer 折叠；`callMcp` 双通道；去掉 Tier3 页令牌门禁 |
| 2026-07-11 | Skills 深化 | `SkillDetailDrawer`、`list_brain_skillpack`、`AdvisorPanel`→`Today` |
| 2026-07-11 | Jobs 深化 | 页头图标/标题、24h 计数、`execution_lane` 标签、`DreamCycleCard` phases、`TraceWaterfall` |
| 2026-07-08~11 | Inbox 页 | 过滤/统计/详情/批量 enrich·丢弃/进度 SSE；`EnrichmentPipeline` 等组件 |
| 2026-07-08~11 | Synthesize 页 | `find_conflicts`→`compile_truth`→`adopt_compiled_truth` 工作台 |
| 2026-07-08~11 | Ask 页 | 预设问题、`trace:true`、`think` 按需、12 步管道示意 |
| 2026-07-08~11 | Graph 页 | `react-force-graph-2d`、`link_type`/`direction` 过滤、力参数滑块 |
| 2026-07-08~11 | Today 深化 | `TodayHero`/`TodayStory`/`ActivityFeedTable`/`MetricDetailDrawer` |
| 2026-07-08~11 | Why? 按钮 | 12 topic × `WhyProvider`/`WhyPanel`/`WhyButton` |
| 2026-07-08~11 | 三大范式 | `ThreeParadigms.tsx` 静态对照页 |
| 2026-07-08~11 | 文档 | `FRONTEND_PLAN.zh.md`、8×`*_COMPARISON.zh.md`、`INBOX_API.zh.md`、`admin/CLAUDE.md` 等 |

### 组件库（`admin/src/components/brain/`）

`PageHeader`、`StatCard`、`Badge`、`StatusPill`、`Drawer`、`AsyncState`、`McpConnect`、`ErrorBoundary`、`BrainTopBar`、`JobQueueColumns`、`DreamCycleCard`、`EnrichmentPipeline`、`EnrichmentDiff`、`InboxCard`/`InboxDetail`/`InboxDiscardDialog`、`PipelineSteps`、`TraceWaterfall`、`ForceGraph`、`TypedLinkTable`/`TypedLinkDemo`、`SkillDetailDrawer` 等（30+，统一 `index.tsx` 导出）。

---

## 二开专属文件（不动上游契约）

| 日期 | 文件/目录 | 说明 |
|------|-----------|------|
| 2025-06-25 | `AGENTS.md` | Qoder 开发者指南 + Windows 构建说明 |
| 2025-06-25 | `CUSTOM.md` | 本文件 |
| 2026-06-25 | `.qoder/` | 项目知识库 |
| 2026-06-25 | `gbrain-architecture.html` | 架构可视化 |
| 2026-07-03~04 | `docs/operations/OPS_MANUAL.zh.md` 等 | 运维手册与 Windows+Ollama 速查 |
| 2026-07-03~04 | `docs/integrations/embedding-providers.md`、`KEY_FILES.md` | Ollama 维度 / DeepSeek 文档同步 |
| 2026-07-08~11 | `.qoder/skills/entity-state-design/` | 实体状态设计 Qoder 技能 |

---

## 后续待办（Issue）

| 待办项 | 备注 |
|--------|------|
| **Takes 双门控（§8.6）** | 可选能力，默认关。详见 `docs/operations/OPS_MANUAL.zh.md` §8.6 |
| **Reranker 精排（§8.7）** | 本机 Ollama 栈已关 reranker。详见 `docs/operations/OPS_MANUAL.zh.md` §8.7 |
| **Brain 多 Source 支持** | admin 顶栏 Source 选择器 + `callMcp` 自动带 `source_id`。详见 `admin/docs/FRONTEND_PLAN.zh.md` §4.3 |
| **知识网络全量视图（远期）** | 触发条件：万级节点 / 力导向卡顿 / 跨 source 聚类需求。详见 `GRAPH_PAGE_COMPARISON.zh.md` |
| **Synthesize 测试标题对齐** | `Synthesize.page.test.tsx` 页头文案与实现不一致，1 用例待修 |

---

## 我新增的能力

| 日期 | 能力 | 位置 |
|------|------|------|
| 2026-06-25 | 项目知识库 / 架构页 / AGENTS.md | `.qoder/`、`gbrain-architecture.html`、`AGENTS.md` |
| 2026-07-03 | Ollama 自定义 embed 维度 | `src/core/ai/dims.ts` 等 |
| 2026-07-04 | DeepSeek Chat + Expansion | `src/core/ai/recipes/deepseek.ts` |
| 2026-07-07~11 | Brain 管理表层（8 页 SPA） | `admin/src/pages/brain/` |
| 2026-07-09 | Admin Cookie MCP 代理 | `POST /admin/api/op` |
| 2026-07-08~11 | Inbox 入库工作流 | `inbox.ts` + 4 op + `inbox_enrich` |
| 2026-07-08~11 | 真理沉淀工作台 | `compile-truth.ts` + 3 op |
| 2026-07-11 | Query 检索诊断 / Jobs 执行通道 / Dream Cycle phases | `query trace` / `execution-lane` / `status.ts` |
| 2026-07-08~11 | Why? 教育按钮 / Admin 开发指南 | `why-topics.ts` / `admin/CLAUDE.md` |

---

## 我故意删除或禁用的内容

| 日期 | 路径/配置 | 原因 |
|------|-----------|------|
| 2026-07-04 | Windows `bun build --compile` 作全局 CLI | PGLite WASM 无法释放（#1340）；改用 cmd shim |
| 2026-07-04 | Windows `bun link -g gbrain` | 易链到空 global 包 |

---

## 合并官方记录

| 日期 | 官方版本/commit | 冲突 | 备注 |
|------|----------------|------|------|
| 2026-07-04 | v0.42.56.0（`3ba1351f`） | 无 | Ollama 维度等二开保留；`typecheck` 通过 |
| 2026-07-11 | v0.42.58.0（`a25209bb`，#2627） | **5 文件** | embedding 维度区域：`embedding-dim-check.ts`、2 测试、2 文档；采用上游 `trust_custom_dims` + 保留二开 Ollama 5 参 `dimsProviderOptions`、DeepSeek 测试、LiteLLM 文档合并；Inbox/真理沉淀/serve-http 等**无冲突**自动合并 |
