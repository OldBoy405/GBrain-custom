# GBrain 二次开发台账

> 描述**当前**相对官方仓库仍有效的增量与运维约定。版本以 `VERSION` 为准；勿在此追 HEAD、doctor 分数或合并日期流水。

## 基本信息

| 项 | 值 |
|----|-----|
| 官方仓库 | https://github.com/garrytan/gbrain |
| 二开仓库 | https://github.com/OldBoy405/GBrain-custom |
| 主开发分支 | `custom/main` |
| 当前对齐上游 | **v0.46.29.0**（`upstream/master`） |
| 产品名 | （待填写） |
| 是否对外分发 | （是/否，待填写） |
| 本机默认栈 | Windows + PGLite + Ollama embed（`qwen3-embedding:4b`）+ DeepSeek chat/subagent |

---

## 后端增量（`src/`、`test/`、`scripts/`）

官方目录树内的二开能力。`admin/dist` 与 `src/admin-embedded.ts` 由 `bun run build:admin` 生成，勿手改嵌入哈希。

### AI 提供方：Ollama 维度 + DeepSeek 配置

| 能力 | 位置 | 说明 |
|------|------|------|
| Ollama 显式 embed 维度 | `dims.ts` · `dimsProviderOptions()` 第 5 参 `providerId`；`gateway.ts` · `embed()` 传 `recipe.id` | 与上游 `trust_custom_dims` 并存 |
| 自定义维度放行 | `embedding-dim-check.ts` | Ollama / `user_provided_models` |
| DeepSeek 密钥注入 | `config.ts` / `provider-env.ts` · `deepseek_api_key` → `DEEPSEEK_API_KEY` | 上游 `mergedProviderEnv` 已吸收 fold 模式；**保留 config 行** |
| DeepSeek Base URL | `build-gateway-config.ts` · `DEEPSEEK_BASE_URL` | env 覆盖 |
| DeepSeek recipe / 定价 | `recipes/deepseek.ts`（**以上游为准**）、`model-pricing.ts` · `input_cache_hit` | 定价只改 `model-pricing.ts` |
| 回归 | Ollama / DeepSeek / `build-gateway-config` 相关 tests | — |

### 工作流：Inbox · 真理沉淀 · Jobs · Query

| 能力 | 位置 | 说明 |
|------|------|------|
| Inbox 工作流 | `src/core/ops/inbox.ts`（splice 进 `operations.ts`）、`inbox-enrich.ts`、ingest 分支 | ops 已 peel 到 `src/core/ops/` |
| Inbox frontmatter 迁移 | `migrate.ts` · version **142** · `inbox_workflow_frontmatter` | 幂等 UPDATE；原 133 与上游撞号，已顺延重编 |
| 真理沉淀 | `src/core/ops/truth.ts` + `conflicts.ts` / `compile-truth.ts` | 注册在 `find_contradictions` 之后 |
| Jobs 执行通道 | `ops/jobs.ts` · `list_jobs` / `get_job` 返回 `execution_lane` | Admin Jobs 页标签 |
| Query 诊断 | `ops/search.ts` · 可选 `trace` 参数与返回信封 | Ask 页 `trace: true` |
| DreamCycle 阶段 | `status.ts` · `phases` 字段 | 与上游字段并列 |
| CLI 空结果解包 | `cli.ts` · search/query 路径 **`Array.isArray` 一行** | `--json` 仍 dump 含 trace 的原始 `result` |
| Admin cookie 代理 | `serve-http.ts` · `CUSTOM ADMIN ROUTES (BEGIN/END)` → `POST /admin/api/op` | 整块保留，贴在上游路由之后 |
| 回归 | inbox / conflicts / compile-truth tests | — |

### Graph · 路径安全 · Skill frontmatter

| 能力 | 位置 | 说明 |
|------|------|------|
| Graph 规模护栏 | `ops/links.ts` · `traverse_graph` · `node_limit` / `frontier_cap` | 默认收紧是故意的 |
| 遍历元数据 | 两引擎 `traversePaths` · `frontierCap` + `to_title`/`to_type` | 引擎锁步 |
| 无根骨架图 | `graph_overview` op + 两引擎实现 + `linksOperations` 注册 | Graph 页默认模式 |
| Windows path-confine | `path-confine.ts` · `resolvedPrefixContained()` | **以上游实现为准**（#3643/#4103 已吸收） |
| Windows CRLF frontmatter | `skill-frontmatter.ts` · 解析前 `CRLF→LF` | **以上游逻辑为准**；保留注释 + `skill-brain-first` 用例 |
| Skill 路由 | `skills/RESOLVER.md` 二开行；`strategic-reading` / `functional-area-resolver` frontmatter 在文件开头 | 不删上游新增路由 |
| 回归 | `traverse-paths-metadata` / `graph-overview` tests | — |

### 已上游化（合并时勿叠第二套）

| 项 | 当前做法 |
|----|----------|
| 跨平台 postinstall | 以上游 `scripts/postinstall.ts`（#1554）为准 |
| Windows `path.sep` path-confine | 取上游 `resolvedPrefixContained()` |
| CRLF frontmatter 归一化 | 取上游 `content.replace(/\r\n/g, '\n')` |

---

## Admin 增量（`admin/`，fork-safe 为主）

**原则**：Brain 功能默认零改上游契约；只消费既有 op / Tier1 REST / cookie 代理。依赖只进 `admin/package.json`。  
**例外**：消费后端 `graph_overview`、`traverse_graph` 护栏、`query.trace`、`execution_lane`（见上节）。

### 架构（当前）

- **双表层**：Ops（`#dashboard`…）+ Brain（`#/`、`#/inbox`…）；`routes.ts` 为路由单一配置源
- **数据通道**：Tier1 `api.ts`（cookie）；Tier3 `mcp-client.ts`（Bearer `/mcp` 或 cookie `/admin/api/op`）
- **信任模型**：会话令牌仅内存 + HttpOnly cookie；401 → `#login`

### Brain 页（当前）

Today、Inbox、Ask（`trace` + TraceWaterfall）、Synthesize、Graph（无根默认 `graph_overview`）、Jobs（`execution_lane` / DreamCycle phases）、Skills/Advisor、NewCapture、Why?、三大范式等。复用组件在 `admin/src/components/brain/`。

### 构建

```bash
bun run build:admin   # admin/dist + src/admin-embedded.ts
cd admin && bun run test
```

合并上游后必跑；类型镜像人工对照 `admin/docs/TYPE-MIRROR-CHECKLIST.md`。

---

## 二开专属文件（不在官方树或未随 upstream 分发）

| 路径 | 说明 |
|------|------|
| `CUSTOM.md` | 本台账 |
| `AGENTS.md` | Qoder / Windows 说明（含 OpenWiki 标记） |
| `.qoder/` | 本地知识库（`better-harness/` 等 **勿提交**） |
| `docs/operations/*.zh.md` | 中文运维（OPS 手册、Windows+Ollama 清单、配置平面） |
| `openwiki/`、`.github/workflows/openwiki-update.yml` | OpenWiki |
| `gbrian-project-technical-overview.html` | 架构可视化 |
| `admin/docs/*`（对照/计划类 zh 文档） | Brain SPA 设计与页面对照 |

---

## 合并守则

执行 `git merge upstream/master` 时：

1. **两边都保留**——功能重叠时以上游为基底，把二开增量贴回正确 cluster（ops 在 `src/core/ops/`）。
2. **加法优先**——未启用二开能力时行为应与官方一致。
3. **`CUSTOM ADMIN ROUTES` 整块保留**——贴在上游 `serve-http.ts` 路由之后。
4. **inbox migration 号**——当前 **142**（顺延规则：永远取上游最新号 +1）；合并后需探针验证新迁移产物（版本号被占会导致上游 DDL 静默跳过）。
5. **合并后必跑**——`bun run typecheck`、上表相关 tests、`bun run build:admin`、`TYPE-MIRROR-CHECKLIST.md`。

上游变更明细见 `CHANGELOG.md`，不在此复述。

---

## 阶段记录（倒序）

### 2026-08-25 — 对齐上游 v0.46.29.0

**上游合并策略**：`custom/main` merge `v0.46.29.0`，12 个冲突文件全部走「上游为基底、二开增量贴回」：`traversePaths` 双方增量并存（frontier cap + #3754 软删除过滤）、定价表双缓存字段并存（`input_cache_hit` + `cache_read/cache_write`）、jobs 返回 `execution_lane` + token 脱敏、search trace + CRAG meta、ingest tombstone + inbox 预处理。

**关键风险（已闭环）**：迁移版本号碰撞。二开 `inbox_workflow_frontmatter` 原占 v133，上游同号（`content_chunks_embedded_text_hash`）发布后其 DDL 被 runner 静默跳过（版本号已记录即不重放），导致 `embedded_text_hash` 列缺失。处置：二开迁移重编号 **v142**（永远压在上游最新号之上），缺失列按 information_schema 探针手工幂等补齐。合并后必查：新迁移产物的探针验证，不只信迁移日志。

**STARTER_OPS 重推导**：按 30d `mcp_request_log` 重推导。仅 1 个观测客户端，裁剪不安全 → 保留 `BRAIN_TOOL_ALLOWLIST` 全量（D12 subagent parity），追加 11 个使用缺口 op（advisor / find_conflicts / get_stats / get_status_snapshot / graph_overview / list_brain_skillpack / list_inbox / list_jobs / list_pages / query / think）。

**运维发现**：source default 一周未同步，根因是 Ollama 未运行（17 文件 embed 失败），非数据损坏；重启 Ollama 后 sync/embed/extract 全恢复。1 个 autopilot-cycle 卡死 37 天（锁失效），`jobs cancel` 清除。

---

## 故意不用的路径

| 项 | 原因 |
|----|------|
| Windows `bun build --compile` 作全局 CLI | PGLite WASM 无法释放（#1340）；用 cmd shim |
| Windows `bun link -g gbrain` | 易链到空 global 包 |

---

## 待办

| 项 | 备注 |
|----|------|
| Takes 双门控（§8.6） | 可选，默认关 · `OPS_MANUAL.zh.md` |
| Reranker 精排（§8.7） | 本机 Ollama 栈已关 · `OPS_MANUAL.zh.md` |
| Brain 多 Source UI | 顶栏 Source + `callMcp` 带 `source_id` · `FRONTEND_PLAN.zh.md` |
| 知识网络全量视图（远期） | 万级节点 / 跨 source 聚类；`graph_overview` 已覆盖默认骨架 |
| Synthesize 测试标题对齐 | `Synthesize.page.test.tsx` 1 用例 |
| `chunk_strategy` / `semantic` chunker | 配置未接线；接线或删死代码 |
| Jobs 页非 fork-safe 性能 | 透传 `by_status`、精简 24h 聚合——有负载再做 |
