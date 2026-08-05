# GBrain 二次开发记录

## 基本信息

| 项 | 值 |
|----|-----|
| 官方仓库 | https://github.com/garrytan/gbrain |
| 二开仓库 | https://github.com/OldBoy405/GBrain-custom |
| 主开发分支 | `custom/main` |
| 当前对齐上游 | **v0.42.73.2** tip `15b9863d` |
| 产品名 | （待填写） |
| 是否对外分发 | （是/否，待填写） |
| HEAD | `a09f3574`（2026-08-05，`合并上游更新`；parents: `9d4c5191` + `15b9863d`） |
| 工作区状态（截至 2026-08-05） | 跟踪文件干净；本地仅剩未跟踪 `.gbrain/` / `.qoder/better-harness/` |

**近期关键本地提交：**

| Commit | 说明 |
|--------|------|
| `1d74f822` | `feat(custom): Graph概览/Ask/NewCapture/Jobs队列 + graph_overview 后端` |
| `45d46fd1` | 合并上游 `upstream/master`（自 v0.42.58.0 → tip `f72de979`） |
| `9d4c5191` | `docs(custom): OpenWiki 接入 + doctor 分类漂移修复 + 二开文档刷新` |
| `a09f3574` | 合并上游 `upstream/master`（自 tip `f72de979` → **v0.42.73.2** `15b9863d`） |

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

#### A. 已提交（2026-07-03 ~ 07-04；Ollama / DeepSeek）

| 日期 | 文件 / 符号位置 | 改动摘要 | 改动原因 | 冲突整合原则 |
|------|----------------|----------|----------|--------------|
| 2026-07-03 | `src/core/ai/dims.ts` · `dimsProviderOptions()` | 新增可选第 5 参 `providerId`；`providerId==='ollama'` 时对任意模型返回 `{ openaiCompatible: { dimensions } }` | 本机 Ollama embed 需显式传 dimensions，上游默认路径不覆盖 | 保留 5 参签名与 Ollama 分支；上游若改 embed 维度逻辑，在合并后的函数体末尾保留 Ollama 特例 |
| 2026-07-03 | `src/core/ai/gateway.ts` · `embed()` | 调用 `dimsProviderOptions(...)` 时传入 `recipe.id` | 把 recipe 身份传给 dims，才能触发 Ollama 特例 | 保留 `recipe.id` 传参；其余 embed 路径以上游为准 |
| 2026-07-03 | `src/core/embedding-dim-check.ts` · `isCustomDimValidForProvider()` | 放行 Ollama 及 `user_provided_models` recipe 的显式自定义维度 | 避免 doctor/init 把合法自定义维度判为非法 | 保留放行规则；与上游 `trust_custom_dims` 并列不互斥（见 2026-07-11 合并记录） |
| 2026-07-03 | `test/ai/gateway.test.ts` | Ollama 维度传参 + `providerId` 向后兼容用例 | 锁住 Ollama 维度与向后兼容行为 | 测试文件：两边用例都保留 |
| 2026-07-03 | `test/embedding-dim-check.test.ts` | Ollama / llama-server / litellm 维度用例 | 锁住本机/代理 provider 的维度放行规则 | 同上 |
| 2026-07-04 | `src/core/config.ts` · `deepseek_api_key` | 文件平面字段 + `DEEPSEEK_API_KEY` env + `KNOWN_CONFIG_KEYS` 注册 | 接入 DeepSeek 作为可选 Chat/Expansion provider | 保留字段注册行；上游新增 key 时一并注册，不删 DeepSeek |
| 2026-07-04 | `src/core/ai/build-gateway-config.ts` | `deepseek_api_key`→`DEEPSEEK_API_KEY`；`DEEPSEEK_BASE_URL`→`base_urls.deepseek` | 把 config/env 注入 gateway，与 openai/anthropic 同模式 | 保留 DeepSeek env 注入；与 openai/anthropic 同模式并列 |
| 2026-07-04 | `src/core/ai/recipes/deepseek.ts` | `expansion` touchpoint；V4 模型列表；1M context | 提供 DeepSeek V4 recipe（含 expansion） | 整文件保留；上游若改 recipe 结构，迁移字段后保留 expansion。**2026-08-05：上游已吸收同款**，合并以上游 touchpoints/定价为准，保留 config.json 文案 |
| 2026-07-04 | `src/core/model-pricing.ts` | 登记 `deepseek-v4-flash` / `deepseek-v4-pro` | 成本估算/eval 需要定价行，且定价唯一真源在此 | 保留定价行；定价以本文件为唯一真源，不手抄到别处 |
| 2026-07-04 | `test/ai/build-gateway-config.test.ts` 等 | DeepSeek config / expansion / 定价回归 | 锁住 DeepSeek 接线与定价不漂移 | 两边用例都保留 |

#### B. 已提交（2026-07-08 ~ 07-11；Inbox / 真理 / Jobs / Query / Admin 代理）

> 曾标注「未提交」——截至 2026-07-18 已全部在 `custom/main` 上（Inbox/真理等随此前提交合入；Graph 与 Ask/Jobs/NewCapture 深化见 `1d74f822`）。

| 日期 | 文件 / 符号位置 | 改动摘要 | 改动原因 | 冲突整合原则 |
|------|----------------|----------|----------|--------------|
| 2026-07-09 | `src/commands/serve-http.ts` · `mcpOperations` | 上提 `operations.filter(!localOnly)`，`/mcp` 与 `/admin/api/op` 共用 | Admin cookie 代理与 `/mcp` 共用同一 op 白名单，避免两处 filter 漂移 | 保留上提后的单一来源；上游若改 filter 条件，合并条件后仍共用 |
| 2026-07-09 | `src/commands/serve-http.ts` · `CUSTOM ADMIN ROUTES` | 新增 `POST /admin/api/op`（cookie `requireAdmin`→`dispatchToolCall`，响应 `{result:ToolResult}`） | Brain SPA 用 cookie 调 MCP op，无需把 Bearer 写进 localStorage | **整块保留** BEGIN/END 标记内代码；上游路由追加后 CUSTOM 块贴末尾 |
| 2026-07-08~11 | `src/core/inbox.ts` · **新文件** | Inbox 投影/状态：`pageToInboxItem`、`prepareInboxCaptureContent`、`patchInboxFrontmatter` 等 | Brain Inbox 页需要专用投影与 frontmatter 状态机 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/types.ts` · `INBOX_STATUSES` / `InboxItem` / `InboxDetail` | `PageFilters` 之后追加 inbox 类型块 | 前后端/op 共用 inbox 类型契约 | 保留类型块；上游若在相邻位置加类型，顺序上 inbox 块不删 |
| 2026-07-08~11 | `src/core/migrate.ts` · `inbox_workflow_frontmatter` | 回填存量 `inbox/*` 页的 `inbox_status` / `inbox_legacy_source` | 存量 inbox 页缺状态字段，升级后列表/过滤才能工作 | 保留 migration 条目；**注意 version 序号**不与上游新 migration 撞号。2026-08-05 合并时与上游 v124/v125 撞号 → **改号为 v126**（幂等 UPDATE，旧脑已跑过旧号仍安全） |
| 2026-07-08~11 | `src/core/operations.ts` · `list_inbox` / `get_inbox_item` / `trigger_inbox_enrichment` / `discard_inbox_items` | 4 个新 op，插在 `list_pages` 与 `search` 之间 | Admin Inbox 工作流（列表/详情/enrich/丢弃）需要契约化 op | 整段 op 定义保留；上游同位置新增 op 时按逻辑顺序并列，导出数组也要注册 |
| 2026-07-08~11 | `src/core/operations.ts` · `find_conflicts` / `compile_truth` / `adopt_compiled_truth` | 真理沉淀 3 op + 导出数组注册 | Synthesize 页「找矛盾→编译真理→采纳」工作台需要后端 op | 整段保留；`compile_truth` handler 依赖 `compile-truth.ts`，合并后确认 import 仍在 |
| 2026-07-08~11 | `src/core/operations.ts` · `list_jobs` / `get_job` handler | 返回前 `.map()` 附加 `execution_lane`（`getExecutionLane(name)`） | Jobs 页要区分 shell/LLM 等执行通道做标签展示 | 保留 `.map()` 追加；上游若改返回形状，在最终返回前加回 `execution_lane` |
| 2026-07-11 | `src/core/operations.ts` · `query` op | 可选 `trace: boolean`；`trace===true` 时返回 `{results, trace}` | Ask 页检索诊断（瀑布/管道示意）需要可选 trace 载荷 | 保留 `trace` 参数与条件分支；注意 `capturedMeta` 变量名随上游同步 |
| 2026-07-08~11 | `src/core/conflicts.ts` · **新文件** | `groupConflicts()` union-find 矛盾分组 | `find_conflicts` 需要把相关矛盾簇成组再交给前端 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/compile-truth.ts` · **新文件** | `compileTruth()` LLM 合并提案 + `parseCompileJSON` | `compile_truth` 的 LLM 合并与 JSON 解析实现体 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/minions/execution-lane.ts` · **新文件** | `getExecutionLane(name)` 纯函数 | 从 job name 推导执行通道，供 list/get_job 附加字段 | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/minions/handlers/inbox-enrich.ts` · **新文件** | 零 LLM 确定性 enrichment handler | Inbox 批量 enrich 走确定性 pipeline，不烧 token | 新文件无冲突；直接保留 |
| 2026-07-08~11 | `src/core/minions/handlers/ingest-capture.ts` · handler 体 | `isInboxSlug` 分支 → `prepareInboxCaptureContent`；`importFromContent` 传 `source_kind`/`source_uri` | 捕获入库时识别 inbox slug，写入正确 frontmatter/来源元数据 | 保留 inbox 分支与额外 opts；非 inbox 路径以上游为准 |
| 2026-07-08~11 | `src/commands/jobs.ts` · `registerBuiltinHandlers` | 追加 `worker.register('inbox_enrich', makeInboxEnrichHandler(engine))` | 让 `inbox_enrich` job 可被 worker 调度执行 | 保留 register 行；不删上游新增 register |
| 2026-07-11 | `src/commands/status.ts` · `CycleRow` / `toCycleRow()` | 新增 `phases` 字段，从 `result.report.phases` 投影 | Jobs/DreamCycle 卡片要展示各 phase 耗时 | 保留 `phases` 字段投影；上游改 `CycleRow` 时字段并列 |
| 2026-07-11 | `src/cli.ts` · `case 'search': case 'query':` | `const results = Array.isArray(result) ? result : result?.results` 防御性解包 | `query --trace` 返回 `{results,trace}` 后，CLI 打印不能把对象当数组 | **仅保留这一行解包**；其余格式化逻辑以上游为准 |
| 2026-07-08~11 | `src/core/eval-shared/json-repair.ts` | `compile-truth.ts` 复用 `stripFences` / `tryParse` / `repairJson`（小改动） | 真理编译复用既有 JSON 修复，避免再造一套解析 | 保留上游 json-repair 逻辑；二开若仅增加 export 使用方，不改修复算法 |
| 2026-07-08~11 | `src/admin-embedded.ts` | admin `bun run build` 后嵌入的静态资源哈希刷新 | Brain SPA 构建产物需嵌入二进制；随 admin 构建自动刷新 | **不手改**——合并冲突时以 `bun run build:admin` 重新生成为准 |
| 2026-07-08~11 | `test/inbox-workflow.test.ts` · **新文件** | inbox op + handler 集成测试 | 锁住 Inbox 工作流不回归 | 新文件保留 |
| 2026-07-08~11 | `test/conflicts.test.ts` · **新文件** | `groupConflicts` 纯函数测试 | 锁住矛盾分组算法 | 新文件保留 |
| 2026-07-08~11 | `test/compile-truth.test.ts` · **新文件** | `compileTruth` / `parseCompileJSON` 测试 | 锁住真理编译与 JSON 解析 | 新文件保留 |
| 2026-07-08~11 | `test/ingestion/ingest-capture.test.ts` | inbox slug 捕获路径用例扩展 | 锁住 inbox 捕获分支 | 保留 inbox 用例；上游用例不删 |

#### C. 已提交（2026-07-14 ~ 07-17；Graph / path-confine；`1d74f822`）

| 日期 | 文件 / 符号位置 | 改动摘要 | 改动原因 | 冲突整合原则 |
|------|----------------|----------|----------|--------------|
| 2026-07-14 | `src/core/operations.ts` · `traverse_graph` | 新增可选 `node_limit`（默认300，顶2000）/`frontier_cap`（默认200，顶1000，传0禁用）；`node_limit` 接线两引擎；`frontier_cap` 透传 | Graph 页防超大 hub/深 walk 打爆浏览器或 DB | 保留两参数与切片逻辑；未传新参数时行为与旧版等价（默认 300 属故意收紧）；上游若改返回形状，切片挪到新返回点 |
| 2026-07-14 | `src/core/engine.ts` · `traversePaths` 接口 | opts 新增可选 `frontierCap?: number` | `frontier_cap` 需作用到路径遍历 API | 保留该字段；不影响未传该参的既有调用方 |
| 2026-07-14 | `src/core/pglite-engine.ts` · `traversePaths()` | ①递归项加 `frontierCap`；②最终 SELECT 补 `to_title`/`to_type` | Graph 力导向需要目标节点 title/type；路径 walk 需广度护栏 | 保留 wrapRec 与新增列；上游重写函数体时把两处改动贴回三分支 |
| 2026-07-14 | `src/core/postgres-engine.ts` · `traversePaths()` | 同 pglite 语义（内联三元 `sql` 拼接） | 两引擎锁步 | 保留内联写法；`engine-parity` DATABASE_URL 门控兜底 |
| 2026-07-14 | `src/core/types.ts` · `GraphPath` | 新增可选 `to_title?`/`to_type?` | 前端画边/标签，避免再逐条 `get_page` | 保留可选字段 |
| 2026-07-14 | `src/core/operations.ts` · `graph_overview` · **新 op** | 无根全量概览：度数 top-N + 其间边；`node_limit`/`edge_limit`；源隔离 | Graph 默认需要无根骨架，不能只靠有根 traverse | 整段 op + 注册行保留；返回形状复用 `GraphNode` |
| 2026-07-14 | `src/core/engine.ts` · `graphOverview` | `BrainEngine` 新方法签名 | 契约层声明 | 仅 pglite/postgres 两实现需同步 |
| 2026-07-14 | 两引擎 · `graphOverview()` · **新方法** | `deg` CTE → `top_nodes` → 自洽出边 | 高效度数 top-N 子图 | 两引擎锁步 |
| 2026-07-14 | `test/traverse-paths-metadata.test.ts` / `test/graph-overview.test.ts` · **新文件** | 元数据 + frontier + overview 回归 | 锁住 Graph 后端语义 | 新文件保留 |
| 2026-07-16 | `src/core/path-confine.ts` · `isPathContained()` | 分隔符改用 `path.sep` | Windows 上父子路径误判「不包含」（见「我修复的上游 Bug」） | 保留 `path.sep`；上游若改 confinement 逻辑，合并后复测 Windows |

#### D. 根目录脚本（历史；上游已吸收同款）

| 日期 | 文件 / 符号位置 | 改动摘要 | 改动原因 | 冲突整合原则 |
|------|----------------|----------|----------|--------------|
| 2025-06-25 | `package.json` · `postinstall` + `scripts/postinstall.ts` | bash 内联 → `bun run scripts/postinstall.ts` | Windows 无 bash | **上游 #1554（v0.42.62 波次）已落地同款跨平台 postinstall**。合并时以上游 ts 脚本为准，勿叠两套；本条目仅作历史记录 |

---

### 上游改动按主题索引

| 主题 | 涉及文件 | 首次日期 | 状态 |
|------|----------|----------|------|
| Ollama 自定义 embed 维度 | `dims.ts`、`gateway.ts`、`embedding-dim-check.ts` + tests | 2026-07-03 | 已提交；与上游 `trust_custom_dims` 并存 |
| DeepSeek provider | `config.ts`、`build-gateway-config.ts`、`recipes/deepseek.ts`、`model-pricing.ts` + tests | 2026-07-04 | 已提交 |
| Admin cookie MCP 代理 | `serve-http.ts`（CUSTOM 区块） | 2026-07-09 | 已提交 |
| Inbox 入库工作流 | `inbox.ts`、`types.ts`、`migrate.ts`、`operations.ts`×4、`inbox-enrich.ts`、`ingest-capture.ts`、`jobs.ts` + tests | 2026-07-08~11 | 已提交 |
| 真理沉淀 Compiled Truth | `conflicts.ts`、`compile-truth.ts`、`operations.ts`×3、`json-repair.ts` + tests | 2026-07-08~11 | 已提交 |
| Jobs 执行通道 | `execution-lane.ts`、`operations.ts`（list/get job） | 2026-07-11 | 已提交 |
| Dream Cycle phase 耗时 | `status.ts` | 2026-07-11 | 已提交 |
| Query 检索诊断 | `operations.ts`（query）、`cli.ts` | 2026-07-11 | 已提交 |
| Graph 规模护栏 + 路径元数据 + `graph_overview` | `operations.ts`、`engine.ts`、两引擎、`types.ts` + tests | 2026-07-14 | 已提交（`1d74f822`） |
| Windows `path-confine` | `path-confine.ts` | 2026-07-16 | 已提交（`1d74f822`） |
| 跨平台 postinstall | `scripts/postinstall.ts` | 2025-06-25 | **上游已吸收**（#1554） |

---

## Admin 前端改动（`admin/` only，fork-safe 为主）

> **原则**：所有 Brain 功能默认 **零上游改动**；仅通过既有 op / Tier1 REST / cookie 代理消费后端。依赖只进 `admin/package.json`。  
> **例外（non-fork-safe）**：`graph_overview` / `traverse_graph` 护栏等后端改动见上节 C；前端 Graph/Ask 消费这些 op。

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
| 2026-07-14~17 | Graph / Ask / Jobs / NewCapture（`1d74f822`） | `graph_overview` 默认骨架；Ask 深化；`NewCaptureDialog`；Jobs 队列 `allSettled`/退避/栏标题澄清；`graph-cache`；DreamCycle phases 拆分 |

### 组件库（`admin/src/components/brain/`）

`PageHeader`、`StatCard`、`Badge`、`StatusPill`、`Drawer`、`AsyncState`、`McpConnect`、`ErrorBoundary`、`BrainTopBar`、`JobQueueColumns`、`JobsQueueSection`、`DreamCycleCard`、`DreamCyclePipeline`、`EnrichmentPipeline`、`EnrichmentDiff`、`InboxCard`/`InboxDetail`/`InboxDiscardDialog`、`NewCaptureDialog`、`PipelineSteps`、`TraceWaterfall`、`ForceGraph`、`TypedLinkTable`/`TypedLinkDemo`、`SkillDetailDrawer` 等（30+，统一 `index.tsx` 导出）。

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
| 2026-07-17 | `admin/docs/NEW-CAPTURE-PLAN.zh.md` 等 | NewCapture / Jobs 队列相关计划与对照文档 |

---

## 我修复的上游 Bug

| 日期 | 文件 / 符号位置 | Bug 描述 | 根因 | 修复 | 影响面 |
|------|----------------|----------|------|------|--------|
| 2026-07-16 | `src/core/path-confine.ts` · `isPathContained()` | Windows 上，对任意真实的父子目录关系（无符号链接）一律误判为「不包含」——`gbrain check-resolvable`/`gbrain doctor` 的 `resolver_health` 在项目根目录下跑都报「找不到 skills 目录」，即便 `skills/RESOLVER.md` 明明存在 | 分隔符硬编码成 `'/'`：`realpathSync()` 在 Windows 返回反斜杠路径，拼接 `/` 后 `startsWith` 永远失败 | 改用 `path.sep` | 所有调用 `isPathContained` 的路径（skills 探测、symlink 逃逸校验、上传路径校验等）。已随 `1d74f822` 提交。修复后 `check-resolvable` 在项目根下正确探测到 `skills/` |

---

## 后续待办（Issue）

| 待办项 | 备注 |
|--------|------|
| **Takes 双门控（§8.6）** | 可选能力，默认关。详见 `docs/operations/OPS_MANUAL.zh.md` §8.6 |
| **Reranker 精排（§8.7）** | 本机 Ollama 栈已关 reranker。详见 `docs/operations/OPS_MANUAL.zh.md` §8.7 |
| **Brain 多 Source 支持** | admin 顶栏 Source 选择器 + `callMcp` 自动带 `source_id`。详见 `admin/docs/FRONTEND_PLAN.zh.md` §4.3 |
| **知识网络全量视图（远期）** | 触发条件：万级节点 / 力导向卡顿 / 跨 source 聚类需求。详见 `GRAPH_PAGE_COMPARISON.zh.md`。**注**：`graph_overview` 已提供默认无根骨架，本项指更大规模的全量/聚类视图 |
| **Synthesize 测试标题对齐** | `Synthesize.page.test.tsx` 页头文案与实现不一致，1 用例待修 |
| **Graph non-fork-safe 合并护栏** | 后端 + 前端已在 `1d74f822` 提交（不再「待独立提交」）。后续每次 `git merge upstream/master`：① 对 `traverse_graph`/`traversePaths`/`graph_overview` 按本节 C 整合；② `bun run typecheck` + `test/traverse-paths-metadata.test.ts` + `test/graph-overview.test.ts`；③ 跑 `admin/docs/TYPE-MIRROR-CHECKLIST.md` 核对 `GraphPath.to_title/to_type` |
| **`chunk_strategy` 配置未接线，`semantic` chunker 是死代码** | 2026-07-17 排查确认：`gbrain config set chunk_strategy semantic` 对 import/sync/put/embed 主路径**无任何效果**。运行时始终走 `chunkers/recursive.ts`；`chunkTextSemantic()` 全仓库零调用。种子值默认 `'semantic'` 会误导用户。待定：① 真正接线 dispatch；或 ② 删死代码 + 种子值 |
| **后台调度页性能：分层与优化时机** | Fork-safe 已做（`allSettled`、错误退避、栏标题澄清、按 id 去重）。**非 fork-safe 待办**仍在：透传 `by_status`、精简档跳过 24h `by_type` 聚合（改 `jobs-watch.ts`）。个人单机规模不必抢跑；有真实负载或恰改该文件时再做 |
| **试用上游新能力（本机）** | 见下「合并官方记录 → 2026-07-18」：FTS 语言、Moonshot、`--src-subpath`、`provider_chat_options` 等，按需验证 |

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
| 2026-07-14 | Graph 规模护栏 + 路径元数据 + `graph_overview` | `operations.ts` / 两引擎 / `Graph.tsx` |
| 2026-07-16 | Windows `path-confine` 修复 | `path-confine.ts` |
| 2026-07-17 | Ask 深化 / NewCapture / Jobs 队列加固 | `Ask.tsx`、`NewCaptureDialog`、`jobs-queue-fetch.ts`（`1d74f822`） |

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
| 2026-07-18 | v0.42.62.0 tip `f72de979`（合并提交 `45d46fd1`；自 v0.42.58.0） | 见合并当时记录 | 带入 0.42.59–0.62 + tip 上未打点版本的 feat；二开 Graph/Inbox/DeepSeek 等保留 |
| 2026-08-05 | **v0.42.73.2** tip `15b9863d`（合并提交 `a09f3574`；自 tip `f72de979`） | **10 文件**（见下） | DeepSeek 已基本被上游吸收；inbox migration → v126；admin 经 `build:admin` 重生。`typecheck` + doctor/gateway/inbox/pricing 相关测试通过 |

### 2026-08-05 合并：冲突整合摘要 + 上游能力（相对 tip `f72de979` / v0.42.62 波次）

#### 冲突文件（按总则整合）

| 文件 | 整合结果 |
|------|----------|
| `src/core/ai/recipes/deepseek.ts` | **以上游为准**（expansion + v4 模型列表 + 2026-07-27 定价）；保留 `deepseek_api_key` config 文案 |
| `src/core/ai/build-gateway-config.ts` | 注释并列表：deepseek + 上游 openrouter/voyage/dashscope/google |
| `src/core/model-pricing.ts` | 上游 deepseek 行 + 保留二开 `input_cache_hit` |
| `test/ai/gateway.test.ts` / `gateway-chat.test.ts` | **两边用例都保留**（上游 openai-compat 矩阵 + 二开 v4/expansion） |
| `src/core/doctor-categories.ts` | 并入上游 `undeclared_db_only_pages` |
| `test/doctor-categories.test.ts` | 以上游 drift guard 为准（已含 onboard/checks 扫描） |
| `src/core/migrate.ts` | 上游 v124/v125 保留；`inbox_workflow_frontmatter` **改号 v126** |
| `admin/dist/*` + `src/admin-embedded.ts` | **不手改** → `bun run build:admin` 重生（保留 Brain SPA） |
| `test/inbox-workflow.test.ts`（合并后类型/期望） | 补 `deadlineAtMs: null`；migration 期望 → 126 |

#### 本波次上游高价值能力（摘要；完整见 `CHANGELOG.md`）

| 能力 | 版本 | 要点 |
|------|------|------|
| **OAuth slug-prefix write fence** | 0.42.72 | `--bound-slug-prefixes` 服务端强制写隔离；`docs/integrations/qm-harness.md` |
| **Embedding 跨 provider 迁移** | 0.42.67 | `gbrain migrate-embeddings`（离 ZeroEntropy 等） |
| **Conversation parser LLM fallback** | 0.42.66 | 可选 LLM 回退解析会话 |
| **社区修复双波** | 0.42.69–0.70 | 静默失败 / 本地模型 / 多 source / Windows 等 |
| **GitHub Releases 随版本发布** | 0.42.71 | 自更新链路 |
| **Dedup 写路径 scope  hardening** | 0.42.73.2 | 受限客户端 dedup 重定向也过写范围检查 |
| **OpenWiki（本仓库先行）** | `9d4c5191` | 二开侧文档；与上游合并无关 |

**建议本机验证：**

```bash
gbrain upgrade
gbrain doctor
gbrain stats
# 若有 inbox 存量页：确认 frontmatter 含 inbox_status（v126 幂等回填）
```

### 2026-07-18 合并：上游新增能力（相对 v0.42.58.0）

> 下列为**官方**带入本分支的能力（非二开）。修复/加固类从略，完整条目见 `CHANGELOG.md`。

#### 正式进 CHANGELOG（v0.42.59–0.42.62）

| 能力 | 版本 | 要点 / 如何用 |
|------|------|----------------|
| **`provider_chat_options` 透传** | 0.42.62 | 按 provider/model 传 chat 选项（如关 thinking）。config 键 `provider_chat_options` |
| **内联 `[Source: …, YYYY-MM-DD]` → timeline** | 0.42.61 | extract / auto-timeline 识别引用约定，幂等再提取 |
| **Schema pack `extractable` 驱动 atom 发现** | 0.42.61 | 声明了 `extract_atoms` 的 pack，其 `extractable` 页类型参与发现（首轮 cycle 可能多扫 notes/emails 等） |
| **Book-mirror 双栏 HTML `<table>`** | 0.42.61 | 多段单元格渲染更稳 |
| **`auth register-client --bound-*`** | 0.42.62 | agent 绑定客户端，满足 `submit_agent` gate |
| **`get_timeline` 日期窗口** / **`query` since·until 按有效日期** | 0.42.62 | 时间过滤不再误用 `updated_at` |
| **LiteLLM chat + expansion touchpoints** | 0.42.62 | 本地 LiteLLM 代理可走 subagent，不再强依赖 Anthropic key |
| **跨平台 `postinstall`（#1554）** | 0.42.62 | 与本仓库历史二开同款；以上游为准 |
| **Windows serve 父进程 watchdog** | 0.42.62 | signal-0 探活，Windows 可用 |
| **CI：OSV / Semgrep / release attestation** | 0.42.62 | 工程侧安全扫描（使用者无感） |
| **Docs：macOS 26 PGLite + 原生 Postgres** | 0.42.62 | `docs/` 指南 |

#### tip 上已合入、CHANGELOG 尚无独立版本条目的 feat

| 能力 | Commit / PR | 要点 / 如何用 |
|------|-------------|---------------|
| **Moonshot / Kimi recipe** | `a8e6b1d1` #2378 | `src/core/ai/recipes/moonshot.ts`（kimi-k2.5 / 2.6 / 2.7-code 等） |
| **可配置 FTS 语言 + `gbrain reindex-search-vector`** | `f8d11f67` #2941 | `docs/guides/multi-language-fts.md`；换语言后需 reindex |
| **Postgres RLS source-scope（opt-in）** | `93cfb375` #2940 | 可选把 source 范围绑进 RLS（Postgres 引擎） |
| **Sync monorepo：`--src-subpath` + `--exclude`** | `f72de979` #2942 | 从 git 仓子目录当独立 source 同步 |
| **OpenAI `prompt_cache_key` 自动派生** | `2df41a84` #2933 | 原生 OpenAI chat 路径利于 prompt cache |

#### 同波次高价值修复（对本机/多 source 影响大，摘要）

- 多 source 写路径带正确 `source_id`（extract / cycle / ingest）
- Windows `sync --full` 路径分隔符 + 大规模误删安全阀
- `think` / takes / 图片 import 的源隔离收紧
- Gateway 非 Anthropic 工具环 resume、DeepSeek reasoning 读取
- Facts 含 `|` 的 fence 往返、模糊实体名隔离检疫
- Autopilot 死锁/崩溃后可立即接管；atom slug 确定性去重
- 搜索 cache 纳入 hard-exclude 策略（防跨策略污染）

**建议本机验证：**

```bash
gbrain upgrade
gbrain doctor
gbrain stats
# 可选：多语言 FTS / Moonshot / monorepo sync
# gbrain reindex-search-vector --dry-run
# gbrain sync --src-subpath <dir> --exclude ...
```
