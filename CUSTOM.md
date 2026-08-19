# GBrain 二次开发记录

## 基本信息

| 项 | 值 |
|----|-----|
| 官方仓库 | https://github.com/garrytan/gbrain |
| 二开仓库 | https://github.com/OldBoy405/GBrain-custom |
| 主开发分支 | `custom/main` |
| 当前对齐上游 | **v0.46.21.0**（`upstream/master` tip `649ffe5f`） |
| 产品名 | （待填写） |
| 是否对外分发 | （是/否，待填写） |
| 本机默认栈 | Windows + PGLite + Ollama embed（`qwen3-embedding:4b`）+ DeepSeek chat/subagent |

> 版本与 commit 以 `VERSION` / `git log` 为准；勿在此文件追 HEAD 或 doctor 分数。

---

## 上游代码改动（`src/` / `test/` / `scripts/`）

> **范围**：凡落在官方仓库目录树内的代码（不含 `admin/`）。`admin/dist` 嵌入产物 `src/admin-embedded.ts` 随 admin 构建刷新，物理位置在 `src/`。

### 合并冲突总则

执行 `git merge upstream/master` 时：

1. **两边都保留**——不做「全取上游」或「全取二开」，如果功能重叠，在上游基础上，将二开新增的功能补齐。
2. **逻辑整合**——以上游为基底，把二开改动贴回正确位置；上游改名则跟着改名。
3. **加法优先**——二开以新增为主；未使用新能力时行为应与上游一致。
4. **标记区块**——`serve-http.ts` 的 `CUSTOM ADMIN ROUTES (BEGIN/END)` 整块保留，贴在上游路由之后。
5. **合并后必跑**——`bun run typecheck` + 本节相关测试 + `admin/docs/TYPE-MIRROR-CHECKLIST.md`。

### 仍须在合并时保留的二开改动

#### A. Ollama / DeepSeek

| 文件 / 符号 | 保留什么 | 合并注意 |
|-------------|----------|----------|
| `dims.ts` · `dimsProviderOptions()` | 第 5 参 `providerId`；`ollama` → `{ openaiCompatible: { dimensions } }` | 上游改 embed 维度逻辑时，保留 Ollama 分支 |
| `gateway.ts` · `embed()` | 传入 `recipe.id` | 其余以上游为准 |
| `embedding-dim-check.ts` | 放行 Ollama / `user_provided_models` 自定义维度 | 与上游 `trust_custom_dims` 并列 |
| `config.ts` / `provider-env.ts` | `deepseek_api_key` → `DEEPSEEK_API_KEY`；`DEEPSEEK_BASE_URL` 仍在 `build-gateway-config.ts` | 上游把 key fold 收到 `mergedProviderEnv`；**勿删** DeepSeek 行 |
| `recipes/deepseek.ts` | 上游已吸收同款 recipe | **以上游 touchpoints/定价为准**；保留 config.json 文案 |
| `model-pricing.ts` | deepseek 定价行；二开另有 `input_cache_hit` | 定价只改本文件 |
| 相关 tests | Ollama / DeepSeek 用例 | 两边都保留 |

#### B. Inbox / 真理 / Jobs / Query / Admin 代理

| 文件 / 符号 | 保留什么 | 合并注意 |
|-------------|----------|----------|
| `serve-http.ts` | `mcpOperations` 上提共用；`CUSTOM ADMIN ROUTES` → `POST /admin/api/op` | CUSTOM 块整段保留 |
| `inbox.ts`、`ops/inbox.ts`、`inbox-enrich` / ingest 分支 | Inbox 工作流 | 上游把 ops 拆到 `src/core/ops/`；inbox 进 `ops/inbox.ts` 再 splice 进 `operations` |
| `migrate.ts` · `inbox_workflow_frontmatter` | 回填 `inbox_*` frontmatter | **当前 version = 133**（勿与上游 migration 撞号；幂等 UPDATE） |
| `ops/truth.ts` + `conflicts.ts` / `compile-truth.ts` | 真理沉淀 | 整段保留；注册在 `find_contradictions` 之后 |
| `ops/jobs.ts` · `list_jobs` / `get_job` · `execution_lane` | Jobs 页标签 | 返回前 `.map()` 加回 |
| `ops/search.ts` · `query.trace` | Ask 诊断载荷 | 保留可选 `trace`；变量名随上游 |
| `status.ts` · `phases` | DreamCycle 耗时 | 字段并列 |
| `cli.ts` · search/query | `Array.isArray` 解包 | **只留这一行**；`--json` 仍 dump 原始 `result`（含 trace 信封） |
| `admin-embedded.ts` | 嵌入哈希 | **不手改** → `bun run build:admin` |
| inbox / conflicts / compile-truth tests | 回归 | 新文件保留；上游用例不删 |

#### C. Graph / Windows path-confine

| 文件 / 符号 | 保留什么 | 合并注意 |
|-------------|----------|----------|
| `ops/links.ts` · `traverse_graph` · `node_limit` / `frontier_cap` | Graph 规模护栏 | 默认收紧是故意的 |
| `traversePaths` · `frontierCap` + `to_title`/`to_type` | 两引擎锁步 | 上游重写函数体时贴回 |
| `graph_overview` op + 两引擎实现 | 无根骨架 | 整段 + `linksOperations` 注册行保留 |
| `path-confine.ts` · `resolvedPrefixContained()` | `path.sep` | 上游已抽出纯函数；合并取上游，勿叠两套 `isPathContained` |
| `traverse-paths-metadata` / `graph-overview` tests | 回归 | 保留 |

#### D. Windows skill frontmatter（CRLF）

| 文件 / 符号 | 保留什么 | 合并注意 |
|-------------|----------|----------|
| `skill-frontmatter.ts` · `parseSkillFrontmatter()` | 解析前 `CRLF→LF` | 与 `extractTriggers` 同款；上游改解析后复测 Windows |
| `test/skill-brain-first.test.ts` | CRLF 用例 | 保留 |
| `skills/RESOLVER.md` · skill-optimizer / skill-creator 触发 | 路由行 | 不删上游新增路由 |
| `strategic-reading` / `functional-area-resolver` SKILL.md | frontmatter 必须文件开头 | Convention 只放正文 |

#### 历史（上游已吸收，勿叠两套）

| 项 | 说明 |
|----|------|
| `scripts/postinstall.ts` 跨平台 postinstall | 上游 #1554 已落地；合并以上游为准 |
| `path-confine.ts` Windows `path.sep` | 上游 #3643/#4103 抽出 `resolvedPrefixContained`；合并取上游 |
| `skill-frontmatter.ts` CRLF→LF | 上游已吸收 `content.replace(/\r\n/g, '\n')`；保留注释即可 |

### 按主题索引

| 主题 | 状态 |
|------|------|
| Ollama 自定义 embed 维度 | 仍须保留；与上游 `trust_custom_dims` 并存 |
| DeepSeek config / pricing | recipe 以上游为准；config 注入 + `input_cache_hit` 仍须保留 |
| Admin cookie MCP 代理 | 仍须保留 |
| Inbox / 真理 / Jobs lane / query trace | 仍须保留；ops 在 `src/core/ops/`；inbox migration **v133** |
| Graph 护栏 + `graph_overview` | 仍须保留 |
| Windows `path-confine` / CRLF frontmatter | 上游已吸收；合并取上游，保留注释 + 回归用例 |

---

## Admin 前端（`admin/`，fork-safe 为主）

**原则**：Brain 功能默认零改上游契约；只消费既有 op / Tier1 REST / cookie 代理。依赖只进 `admin/package.json`。  
**例外**：后端 `graph_overview` / `traverse_graph` 护栏见上节 C。

**当前架构**

- 双表层：Ops（`#dashboard`…）+ Brain（`#/`、`#/inbox`…），`routes.ts` 单一配置源
- 数据：Tier1 `api.ts`（cookie）；Tier3 `mcp-client.ts`（Bearer `/mcp` 或 cookie `/admin/api/op`）
- 信任：令牌仅内存；401 → `#login`

**Brain 页能力（当前）**：Today、Inbox、Ask（`trace`）、Synthesize、Graph（默认 `graph_overview`）、Jobs（`execution_lane` / DreamCycle phases）、Skills/Advisor、NewCapture、Why?、三大范式等。组件在 `admin/src/components/brain/`。

合并后：`bun run build:admin` 重生 `admin/dist` + `src/admin-embedded.ts`。

---

## 二开专属文件

| 路径 | 说明 |
|------|------|
| `CUSTOM.md` | 本文件 |
| `AGENTS.md` | Qoder / Windows 说明（含 OpenWiki 标记） |
| `.qoder/` | 本地知识库（`better-harness/` 等勿提交） |
| `docs/operations/OPS_MANUAL.zh.md`、`OPS_CHECKLIST.windows-ollama.zh.md`、`CONFIG_PLANES_AND_MODEL_ROUTING.zh.md` | 运维中文文档 |
| `openwiki/`、`.github/workflows/openwiki-update.yml` | OpenWiki |
| `gbrian-project-technical-overview.html` | 架构可视化（原 `gbrain-architecture.html` 已删） |
| `admin/docs/*`（对照/计划类 zh 文档） | Brain SPA 设计与对照 |

---

## 我修复的上游 Bug（合并时勿丢）

| 文件 | 问题 | 修复 |
|------|------|------|
| `path-confine.ts` · `isPathContained()` | Windows 上 `realpathSync` 反斜杠 + 硬编码 `'/'` → 父子路径永假 | 改用 `path.sep` |
| `skill-frontmatter.ts` · `parseSkillFrontmatter()` | Windows CRLF 下 `/^---\n/` 永不匹配 → frontmatter 触发词索引空、`resolver_health` 误报 | 解析前 `CRLF→LF` |

---

## 后续待办

| 待办 | 备注 |
|------|------|
| Takes 双门控（§8.6） | 可选，默认关。见 `OPS_MANUAL.zh.md` |
| Reranker 精排（§8.7） | 本机 Ollama 栈已关。见 `OPS_MANUAL.zh.md` |
| Brain 多 Source UI | 顶栏 Source + `callMcp` 带 `source_id`。见 `FRONTEND_PLAN.zh.md` |
| 知识网络全量视图（远期） | 万级节点 / 跨 source 聚类；`graph_overview` 已覆盖默认骨架 |
| Synthesize 测试标题对齐 | `Synthesize.page.test.tsx` 1 用例 |
| `chunk_strategy` / `semantic` chunker | 配置未接线；接线或删死代码 |
| Jobs 页非 fork-safe 性能 | 透传 `by_status`、精简 24h 聚合——有负载再做 |

---

## 二开能力一览（相对官方，当前仍有效）

| 能力 | 位置 |
|------|------|
| Ollama 显式 embed 维度 | `dims.ts` 等 |
| DeepSeek config 平面接入 | `config.ts` / `provider-env.ts`（recipe 已上游化） |
| Brain SPA + cookie MCP 代理 | `admin/`、`POST /admin/api/op` |
| Inbox / 真理沉淀 / query trace / Jobs lane | `ops/inbox.ts` `ops/truth.ts` `ops/search.ts` `ops/jobs.ts` + core 新文件 |
| Graph 护栏 + `graph_overview` | `ops/links.ts` + 两引擎 + Graph 页 |
| Windows path-confine + CRLF skill frontmatter | `path-confine.ts`、`skill-frontmatter.ts` |
| OpenWiki + 中文运维文档 | `openwiki/`、`docs/operations/*.zh.md` |

---

## 故意不用的路径

| 项 | 原因 |
|----|------|
| Windows `bun build --compile` 作全局 CLI | PGLite WASM 无法释放（#1340）；用 cmd shim |
| Windows `bun link -g gbrain` | 易链到空 global 包 |

---

## 合并官方记录（摘要）

| 日期 | 对齐 | 冲突要点 |
|------|------|----------|
| 2026-07-04 | v0.42.56.0 | 无 |
| 2026-07-11 | v0.42.58.0 | embedding 维度区域：上游 `trust_custom_dims` + 保留 Ollama 5 参 |
| 2026-07-18 | ~v0.42.62 tip | Graph/Inbox/DeepSeek 等自动或按总则保留 |
| 2026-08-05 | **v0.42.73.2** | DeepSeek 以上游为准；inbox → **v126**；admin `build:admin`；随后补 CRLF frontmatter |
| 2026-08-19 | **v0.46.21.0** | 上游 `operations.ts` 拆到 `src/core/ops/`；inbox/truth/graph 贴回对应 cluster；inbox → **v133**；DeepSeek fold 进 `provider-env.ts`；path-confine/CRLF 以上游为准 |

上游能力明细见 `CHANGELOG.md`，不在此复述。合并冲突按上文「仍须保留」表执行即可。
