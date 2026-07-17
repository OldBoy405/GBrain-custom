# GBrain 项目运维手册

> 基于仓库 `docs/`、`src/core/config.ts`、`src/cli.ts` 及当前代码行为整理。  
> 默认数据目录：Windows `%USERPROFILE%\.gbrain\`；Linux/macOS `~/.gbrain/`。可通过 `GBRAIN_HOME` 覆盖父目录。

---

## 目录

1. [环境搭建与运行](#1-环境搭建与运行)
2. [配置项详解](#2-配置项详解)
3. [配置步骤指导](#3-配置步骤指导)
4. [使用指令大全](#4-使用指令大全)
5. [维护指令操作](#5-维护指令操作)
6. [Server 模式运行](#6-server-模式运行)
7. [特殊功能配置](#7-特殊功能配置)
8. [模型 Tier、可选升级与检索精排](#8-模型-tier可选升级与检索精排)
9. [指令速查总表（按场景）](#9-指令速查总表按场景)
10. [端到端最佳实践（标准工作流）](#10-端到端最佳实践标准工作流)

---

## 1. 环境搭建与运行

### 1.1 前置要求


| 组件               | 要求                                     |
| ---------------- | -------------------------------------- |
| 运行时              | **Bun**（项目标准运行时）                       |
| 本地默认引擎           | **PGLite**（嵌入式 Postgres WASM，零配置）      |
| 生产/大规模           | **Postgres + pgvector**（Supabase 或自托管） |
| 本地 Embedding（可选） | **Ollama**（如 `qwen3-embedding:4b`）     |
| 远程 MCP           | **ngrok** 或公网主机（HTTP + OAuth）          |




### 1.2 开发环境搭建

```powershell
# 克隆并安装依赖
cd C:\path\to\gbrain
bun install

# 开发模式直接跑 CLI
bun run src/cli.ts --help

# 类型检查
bun run typecheck

# 单元测试
bun run test

# 编译二进制（可选）
bun build --compile --outfile bin/gbrain src/cli.ts
```

**初始化本地 Brain（PGLite + Ollama 示例）：**

```powershell
ollama pull qwen3-embedding:4b

bun run src/cli.ts init --pglite `
  --embedding-model ollama:qwen3-embedding:4b `
  --embedding-dimensions 1024

bun run src/cli.ts doctor
bun run src/cli.ts providers test --model ollama:qwen3-embedding:4b
```

**常用环境变量（运行时覆盖** `config.json`**）：**


| 变量                                                                               | 作用                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GBRAIN_HOME`                                                                    | 配置/数据父目录（实际路径为 `$GBRAIN_HOME/.gbrain`）                    |
| `DATABASE_URL` / `GBRAIN_DATABASE_URL`                                           | Postgres 连接串（设置后强制 `engine=postgres`）                     |
| `OPENAI_API_KEY`                                                                 | OpenAI                                                    |
| `ANTHROPIC_API_KEY`                                                              | Anthropic                                                 |
| `ZEROENTROPY_API_KEY`                                                            | ZeroEntropy                                               |
| `VOYAGE_API_KEY`                                                                 | Voyage                                                    |
| `GROQ_API_KEY` / `TOGETHER_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`             | 其他云 provider Key                                          |
| `OLLAMA_BASE_URL`                                                                | 默认 `http://localhost:11434/v1`                            |
| `LMSTUDIO_BASE_URL` / `LLAMA_SERVER_BASE_URL` / `LLAMA_SERVER_RERANKER_BASE_URL` | 本地 OpenAI 兼容端点 / 本地 reranker（§8.7）                        |
| `OPENROUTER_BASE_URL` / `LITELLM_BASE_URL`                                       | 网关聚合器根地址                                                  |
| `DEEPSEEK_API_KEY`                                                               | DeepSeek Chat / Expansion（可被 config 覆盖，见下）                |
| `DEEPSEEK_BASE_URL`                                                              | DeepSeek API 根地址（如 `https://api.deepseek.com` 或 `.../v1`） |
| `GBRAIN_EMBEDDING_MODEL` / `GBRAIN_EMBEDDING_DIMENSIONS`                         | 覆盖 embedding 模型 / 维度                                      |
| `GBRAIN_CHAT_MODEL` / `GBRAIN_EXPANSION_MODEL` / `GBRAIN_MODEL`                  | 覆盖 chat / expansion / 全局兜底模型                              |
| `GBRAIN_SOURCE`                                                                  | 默认 source id（等价 `--source`）                               |
| `GBRAIN_EMBED_CONCURRENCY`                                                       | embed 并发数                                                 |
| `GBRAIN_NO_REEMBED`                                                              | 升级后跳过重嵌 sweep                                             |
| `GBRAIN_RETRIEVAL_REFLEX` / `GBRAIN_RETRIEVAL_REFLEX_WINDOW_TURNS`               | `false`/`0` 关闭反射 / 窗口轮数                                   |
| `GBRAIN_INIT_SKIP_EMBED_CHECK`                                                   | `1` 跳过 init 时 embed 探测                                    |
| `GBRAIN_NO_SANITY` / `GBRAIN_PAGE_WARN_BYTES` / `GBRAIN_PAGE_BLOCK_BYTES`        | 内容体检开关 / 阈值（§2.7）                                         |


详见 `docs/operations/headless-install.md`（Docker/CI 无 TTY 安装）。

### 1.3 生产环境部署（Postgres + HTTP MCP）

典型拓扑见 `docs/mcp/DEPLOY.md`、`docs/tutorials/company-brain.md`。

**服务器要求：**

- Postgres 15+，安装 **pgvector**
- 建议通过 **PgBouncer** 连接池（transaction mode）
- 公网暴露需 TLS（ngrok / 反向代理）
- HTTP MCP 在 Postgres 上功能最完整；遗留 bearer token 表为 Postgres-only

**部署步骤概要：**

```bash
# 1. 安装
bun install -g github:garrytan/gbrain

# 2. 初始化 Postgres
gbrain init --supabase
# 或
gbrain init --url postgresql://user:pass@host:5432/gbrain

# 3. 应用迁移
gbrain apply-migrations --yes

# 4. 启动 HTTP 服务
gbrain serve --http --port 3131 --bind 0.0.0.0 \
  --public-url https://your-brain.example.com

# 5. 健康检查
curl http://localhost:3131/health
```

**安全要点：**

- `~/.gbrain/config.json` 权限 `0600`
- OAuth 客户端按 `read` / `write` / `admin` 分权
- 远程禁止 `localOnly` 操作：`sync_brain`、`file_upload`、`file_list`、`file_url`
- 多租户勿开 `--log-full-params`（默认参数摘要脱敏）



### 1.4 两种运行模式对比


| 模式              | 命令                                 | 数据库                      | 适用场景                       |
| --------------- | ---------------------------------- | ------------------------ | -------------------------- |
| **PGLite 嵌入**   | `gbrain init --pglite`             | `~/.gbrain/brain.pglite` | 个人本机、<1000 文件、零运维          |
| **Postgres 外部** | `gbrain init --supabase` / `--url` | 远程 Postgres              | 多用户、大库、HTTP MCP、Minion 常驻  |
| **Thin Client** | `gbrain init --mcp-only`           | 无本地库                     | 只连远程 `gbrain serve --http` |
| **MCP stdio**   | `gbrain serve`                     | 沿用已配置引擎                  | Claude Code / Cursor 本地子进程 |
| **MCP HTTP**    | `gbrain serve --http`              | 建议 Postgres              | ChatGPT、Perplexity、远程团队    |


**模式切换：**

```bash
gbrain migrate --to supabase    # PGLite → Postgres
gbrain migrate --to pglite      # Postgres → PGLite（少见）
gbrain reinit-pglite --embedding-model ... --embedding-dimensions N  # PGLite 换 embedding
```

引擎架构详见 `docs/ENGINES.md`。

---



## 2. 配置项详解

GBrain 有 **两层配置平面**，运维时必须区分：


| 平面        | 存储位置                    | 修改方式                              | 典型用途                              |
| --------- | ----------------------- | --------------------------------- | --------------------------------- |
| **文件平面**  | `~/.gbrain/config.json` | 直接编辑 / `gbrain init`              | 引擎、DB 路径、embedding 模型/维度、API Key  |
| **数据库平面** | DB `config` 表           | `gbrain config set <key> <value>` | 搜索模式、spend、dream、autopilot 等运行时旋钮 |


**重要：** `embedding_model`、`embedding_dimensions` **不能**用 `gbrain config set` 热改（会改 schema 列宽）。必须用 `gbrain reinit-pglite`（PGLite）或 `docs/embedding-migrations.md` 中的 Postgres 迁移流程。

### 2.1 配置文件位置与格式

```
%USERPROFILE%\.gbrain\          (Windows)
~/.gbrain/                       (Linux/macOS)
├── config.json          # 主配置（JSON，权限 0600）
├── brain.pglite/        # PGLite 数据目录
├── brain.pglite.bak     # reinit-pglite 自动备份
├── supervisor.pid       # Minion supervisor PID
└── audit/               # 审计日志
```

`config.json` 示例：

```json
{
  "engine": "pglite",
  "database_path": "C:\\Users\\YOU\\.gbrain\\brain.pglite",
  "embedding_model": "ollama:qwen3-embedding:4b",
  "embedding_dimensions": 1024,
  "deepseek_api_key": "sk-...",
  "chat_model": "deepseek:deepseek-v4-pro",
  "expansion_model": "deepseek:deepseek-v4-flash",
  "provider_base_urls": {
    "deepseek": "https://api.deepseek.com"
  },
  "schema_pack": "gbrain-base-v2",
  "mcp": { "publish_skills": true },
  "self_upgrade": { "mode": "notify", "mode_prompted": true }
}
```



### 2.2 文件平面核心字段（`GBrainConfig`）


| 字段                                                             | 含义                           | 默认/典型值                                      |
| -------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| `engine`                                                       | `pglite` | `postgres`        | init 时选定                                    |
| `database_path`                                                | PGLite 目录                    | `~/.gbrain/brain.pglite`                    |
| `database_url`                                                 | Postgres 连接串                 | Supabase 初始化写入                              |
| `embedding_model`                                              | `provider:model`             | 如 `ollama:qwen3-embedding:4b`               |
| `embedding_dimensions`                                         | 向量维度                         | 须与模型/schema 一致                              |
| `embedding_disabled`                                           | 延迟 embedding 配置              | `gbrain init --no-embedding`                |
| `deepseek_api_key`                                             | DeepSeek API Key（文件平面）       | 注入 `DEEPSEEK_API_KEY`；也可用环境变量               |
| `openai_api_key` / `anthropic_api_key` / `zeroentropy_api_key` | 各云厂商 Key                     | 同上，文件平面 → gateway                           |
| `expansion_model`                                              | 查询扩展模型                       | 如 `deepseek:deepseek-v4-flash`（tokenmax 模式） |
| `chat_model`                                                   | 默认对话模型                       | 如 `deepseek:deepseek-v4-pro`                |
| `chat_fallback_chain`                                          | 静默降级链                        | `provider:model` 数组                         |
| `provider_base_urls`                                           | 各 provider 自定义 base URL      | 如 Ollama 代理地址                               |
| `schema_pack`                                                  | 类型/抽取规则包                     | `gbrain-base-v2`                            |
| `retrieval_reflex`                                             | 每轮注入实体指针                     | 默认 **开启**（缺省=true）                          |
| `retrieval_reflex_max_pointers`                                | 每轮最大指针数                      | 默认 3                                        |
| `remote_mcp`                                                   | Thin Client 远程 MCP 配置        | `issuer_url`、`mcp_url`、`oauth_client_id`    |
| `mcp.publish_skills`                                           | 远程 MCP 是否发布技能目录              | 新装默认 true                                   |
| `mcp.publish_advisor`                                          | 远程 MCP 是否暴露 advisor          | 默认 false                                    |
| `mcp.skills_dir`                                               | 发布技能时的 skills 目录覆盖（**不影响** `resolver_health`，见 §5.3） | 自动探测                                        |
| `self_upgrade.mode`                                            | `notify` | `auto` | `off`    | 自升级策略                                       |
| `self_upgrade.quiet_hours`                                     | 静默升级时间窗 `{start,end,tz}`     | 无                                           |
| `retrieval_reflex_window_turns`                                | 反射从最近几轮对话抽实体                 | 4（文件/env）                                   |
| `embedding_multimodal` / `embedding_multimodal_model`          | 多模态（图文）摄取开关 + 模型             | 默认关；如 `voyage:voyage-multimodal-3`          |
| `embedding_image_ocr` / `embedding_image_ocr_model`            | 图片 OCR 开关 + 模型               | 默认关                                         |
| `content_sanity.*`                                             | 内容体检（超大页告警/软阻断、垃圾/markup 模式） | 见 §2.7                                      |
| `dream.synthesize.*` / `dream.patterns.*`                      | Dream 合成/模式阶段的语料目录、模型、窗口     | 见 §8 与 §7.6                                 |
| `search_embedding_column` / `embedding_columns`                | 默认检索向量列 + 多向量列注册表            | `embedding`                                 |


> **实际出厂默认 embedding**：上游新装默认 `zeroentropyai:zembed-1` @ **1280 维**（走云 API）。本 Fork 的个人栈用 `gbrain init --embedding-model ollama:… --embedding-dimensions 1024` 覆盖为本机 Ollama，见清单 §1.3。

`retrieval_reflex` / `retrieval_reflex_max_pointers` / `retrieval_reflex_window_turns` 为**文件/env 平面**：须编辑 `config.json` 或设 `GBRAIN_RETRIEVAL_REFLEX`*，`gbrain config set retrieval_reflex false` 写入 DB 平面**无效**（代码不读 DB 侧的该键）。同理 `dream.`* **无 env 层**（设计如此，无 `GBRAIN_DREAM_`*）。

### 2.3 数据库平面常用键（`gbrain config set`）

完整列表见 `src/core/config.ts` 的 `KNOWN_CONFIG_KEYS` 与 `KNOWN_CONFIG_KEY_PREFIXES`。

**搜索模式（**`search.`***）：** 详见 `docs/guides/search-modes.md`


| 键                            | 含义          | conservative | balanced | tokenmax |
| ---------------------------- | ----------- | ------------ | -------- | -------- |
| `search.mode`                | 模式名         | ✓            | ✓（默认）    | ✓        |
| `search.token_budget`        | 返回 token 上限 | 4000         | 12000    | off      |
| `search.expansion`           | LLM 多查询扩展   | off          | off      | on       |
| `search.relationalRetrieval` | 关系图召回       | off          | on       | on       |
| `search.limit_default`       | 默认结果数       | 10           | 25       | 50       |


**花费控制：** 详见 `docs/operations/spend-controls.md`


| 键                                       | 默认      | 说明                       |
| --------------------------------------- | ------- | ------------------------ |
| `spend.posture`                         | `gated` | `tokenmax` = 所有花费门仅提示不阻断 |
| `sync.cost_gate_min_usd`                | `0.50`  | sync 内联 embed 花费门槛       |
| `embed.backfill_max_usd_per_source_24h` | `25`    | 每 source 24h 回填上限        |
| `embed.backfill_max_usd`                | `10`    | 单次 backfill 任务上限         |


**模型分层（**`models.`***）：** 四档 Tier 与解析优先级见 [§8](#8-模型-tier可选升级与检索精排)。仅改 `config.json` 的 `chat_model` / `expansion_model` **不足以**覆盖运行时路由，必须在 DB 平面写入 `models.tier.`*（或 `models.default` / 各任务键）。

```bash
gbrain config set models.tier.subagent anthropic:claude-sonnet-4-6
gbrain config set models.tier.utility anthropic:claude-haiku-4-5
```

**Autopilot（**`autopilot.`***）：**


| 键                                                                         | 默认             | 说明                    |
| ------------------------------------------------------------------------- | -------------- | --------------------- |
| `autopilot.nightly_quality_probe.enabled`                                 | false          | 夜间质量探测（耗 API）         |
| `autopilot.auto_drain.enabled`                                            | true           | 自动消化 extract_atoms 积压 |
| `autopilot.auto_drain.threshold` / `.window_seconds` / `.max_usd_per_day` | 25 / 120 / 2.0 | 触发阈值 / 单次预算 / 每日花费上限  |


**其他常用 DB 键：**


| 键                                                                 | 默认                 | 说明                                         |
| ----------------------------------------------------------------- | ------------------ | ------------------------------------------ |
| `search.cache.enabled` / `.similarity_threshold` / `.ttl_seconds` | true / 0.92 / 3600 | 语义查询缓存（见 §8.7 与 `gbrain cache`）            |
| `search.intent_weighting`                                         | on                 | 查询意图加权                                     |
| `search.reranker.enabled` / `.model`                              | 随 mode             | Cross-encoder 精排（详见 §8.7）                  |
| `search.track_retrieval`                                          | —                  | 记录检索命中用于 `search stats` / volunteer 精度     |
| `sync.federated_v2`                                               | —                  | 联邦同步 v2                                    |
| `emotional_weight.high_tags` / `.user_holder`                     | —                  | salience 情感权重的高权标签 / 本人 holder（v0.29）      |
| `takes.bootstrap_enabled` / `takes.autopilot_allowed`             | false / false      | Takes 抽取双重门（见 §8.6；**需** `--force` **写入**） |


> **未登记键需** `--force`**：** `gbrain config set` 对不在 `KNOWN_CONFIG_KEYS` / 前缀白名单内的键会**拒绝**（`src/commands/config.ts`）。这类键包括 `takes.`*、`agent.use_gateway_loop`（§8.4）、`pace.*`（§5.4，通常用 `GBRAIN_PACE_*` env 代替）。确需写入时加 `--force`：
> `gbrain config set takes.bootstrap_enabled true --force`



### 2.4 配置优先级（运行时）

```
环境变量 > ~/.gbrain/config.json > DB config 表 > 代码默认值
```



### 2.5 场景化配置示例

**场景 A：本机 Ollama + DeepSeek Chat/Expansion**

```json
{
  "engine": "pglite",
  "embedding_model": "ollama:qwen3-embedding:4b",
  "embedding_dimensions": 1024,
  "deepseek_api_key": "sk-...",
  "chat_model": "deepseek:deepseek-v4-pro",
  "expansion_model": "deepseek:deepseek-v4-flash",
  "provider_base_urls": { "deepseek": "https://api.deepseek.com" }
}
```

```bash
gbrain config set search.mode tokenmax   # 或 conservative/balanced（不跑 expansion）
```

**场景 B：本机 Ollama + 省资源搜索（无 DeepSeek）**

```json
{
  "engine": "pglite",
  "embedding_model": "ollama:qwen3-embedding:4b",
  "embedding_dimensions": 1024
}
```

```bash
gbrain config set search.mode conservative
```

**场景 C：Supabase 团队 Brain + 远程 MCP**

```json
{
  "engine": "postgres",
  "database_url": "postgresql://...",
  "embedding_model": "openai:text-embedding-3-large",
  "embedding_dimensions": 1536,
  "mcp": { "publish_skills": true, "publish_advisor": false }
}
```

**场景 D：Thin Client（仅远程）**

```json
{
  "remote_mcp": {
    "issuer_url": "https://brain.example.com",
    "mcp_url": "https://brain.example.com/mcp",
    "oauth_client_id": "your-client-id"
  }
}
```

Embedding 提供商选型见 `docs/integrations/embedding-providers.md`。

### 2.6 入库落盘（`sync.repo_path` 与 `sources.local_path`）

GBrain 内容存于 **两层**：


| 层               | 位置                                                         | 资源管理器可读？         |
| --------------- | ---------------------------------------------------------- | ---------------- |
| **数据库**         | `%USERPROFILE%\.gbrain\brain.pglite\`（PGLite）              | ❌ 嵌入式库，勿当笔记文件夹打开 |
| **Markdown 落盘** | `sync.repo_path` 或 source 的 `local_path` 下按 slug 生成的 `.md` | ✅ 可直接浏览、Git 管理   |


**仅** `init --pglite`**、未** `import` **/ 未绑定目录时**：页面只在 DB 里（Admin Inbox / `gbrain list` 可见），**磁盘上没有对应** `.md`。这是正常现象，不是丢数据。

#### 两个路径键（勿混淆）


| 键                    | 存储            | 何时写入                                                | 作用                                                                 |
| -------------------- | ------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| `sync.repo_path`     | DB `config` 表 | `gbrain import <dir>` 成功时                           | 默认 source 的 legacy 落盘根目录；`capture` / `put_page` write-through 回退到此 |
| `sources.local_path` | `sources` 表   | `gbrain sources add <id> --path <dir>` 或 `--url` 克隆 | 多 source 时各 repo 独立工作树；`gbrain sync` 首选此路径                         |


解析链：`sources.local_path` → 若无则 `sync.repo_path`（`src/core/source-resolver.ts`）。

#### 磁盘路径规则（default source）

```
{brain目录}\inbox\2026-07-15-a1b2c3.md          # 采集 / capture 默认 slug
{brain目录}\people\alice-example.md              # 普通页面
{brain目录}\.sources\{source_id}\...             # 非 default source
```



#### 验证是否已落盘

```powershell
gbrain sources list
gbrain config get sync.repo_path
# 两者皆空 → 仅 DB；见 §3.4 绑定目录或 §4.2 export
```



#### 文件夹监听（可选）

丢文件到 **`%USERPROFILE%\.gbrain\inbox\`**（Shortcuts / AirDrop）会触发采集；与 brain 内 `inbox/` **slug 命名空间**不同，但同属入库流水线。

### 2.7 内容体检与隔离（`content_sanity.*`）

入库（`capture` / `import` / `put`）前会跑一遍内容体检：超大页告警/软阻断、垃圾模式、markup 占比过高等。高置信垃圾默认进**隔离区**（quarantine）而非直接拒绝。


| 键（文件/DB 双平面）                           | 默认           | env 覆盖                        |
| -------------------------------------- | ------------ | ----------------------------- |
| `content_sanity.bytes_warn`            | 50_000       | `GBRAIN_PAGE_WARN_BYTES`      |
| `content_sanity.bytes_block`           | 500_000      | `GBRAIN_PAGE_BLOCK_BYTES`     |
| `content_sanity.junk_patterns_enabled` | true         | `GBRAIN_NO_JUNK_PATTERNS=1` 关 |
| `content_sanity.max_markup_ratio`      | 0.85         | `GBRAIN_MAX_MARKUP_RATIO`     |
| `content_sanity.disabled`（总开关）         | false        | `GBRAIN_NO_SANITY=1` 关        |
| `content_sanity.junk_disposition`      | `quarantine` | 无（可设 `reject`）                |


**隔离区操作：**

```powershell
gbrain quarantine list [--json] [--include-flagged]   # 看被隔离/标记的页
gbrain quarantine scan [--limit N] [--apply]          # 重扫已有页，--apply 落隔离
gbrain quarantine clear <slug> [--force] [--no-embed]  # 放行（重新入正库）
```

---



## 3. 配置步骤指导



### 3.1 完整初始化流程

```
安装 → gbrain init → 选择引擎 → 配置 embedding → initSchema/迁移
     → gbrain doctor → import/sync → 可选 serve/autopilot/jobs
```

**推荐命令序列（PGLite）：**

```powershell
bun run src/cli.ts init --pglite `
  --embedding-model ollama:qwen3-embedding:4b `
  --embedding-dimensions 1024

bun run src/cli.ts config show
bun run src/cli.ts doctor
bun run src/cli.ts providers test --model ollama:qwen3-embedding:4b
bun run src/cli.ts import D:\notes
```



### 3.4 绑定 brain 目录（init 后建议立即做）

若希望 **资源管理器 / Git / Obsidian** 能直接看到笔记，须指定落盘根目录：

```powershell
# 1. 建目录（可空目录，仅作 brain 仓库根）
New-Item -ItemType Directory -Force D:\MyBrain

# 2. 绑定并写入 sync.repo_path（会把目录内已有 .md 导入 DB）
gbrain import D:\MyBrain

# 3. 验证
gbrain config get sync.repo_path          # 应输出 D:\MyBrain
gbrain sources list                       # default 行；never synced → 再跑 sync
explorer D:\MyBrain\inbox                 # 有 capture 后可见 .md
```

**已有 DB 内容、尚未落盘时**（`sources list` 有页数但无路径）：

```powershell
gbrain import D:\MyBrain                  # 绑定路径；若目录空，主要效果是写 config
gbrain sync --repo D:\MyBrain             # 把 DB 页 reverse-write 到磁盘（需已 import 设 anchor）
# 或一次性导出（不依赖 sync.repo_path）：
gbrain export --dir D:\MyBrain-export
```

**多 source：** `gbrain sources add wiki --path D:\wiki-repo`，各 source 独立 `local_path`。

**PGLite 注意：** 本机 `gbrain serve --http` **占用数据库** 时，另开终端跑 `sources list` / `import` 可能 **连接超时**。先停 serve，或只用 Admin/MCP 读；写操作务必停 serve 后再跑 CLI。

### 3.2 选项选择依据


| 决策                 | 建议                                                      |
| ------------------ | ------------------------------------------------------- |
| PGLite vs Postgres | <1000 md 文件 → PGLite；团队/HTTP MCP/大库 → Postgres          |
| 搜索模式               | 成本敏感 → `conservative`；日常 → `balanced`；深度研究 → `tokenmax` |
| Embedding 维度       | ≤2000 可走 HNSW；Ollama Matryoshka 可截断（如 Qwen3→1024）       |
| expansion 模型       | 默认 Haiku 即可；tokenmax 模式才强依赖                             |
| `spend.posture`    | 个人本机 Ollama 可 `tokenmax`；云 API 保持 `gated`               |




### 3.3 配置验证

```bash
gbrain doctor                    # 全量健康检查
gbrain doctor --fast             # 跳过 DB 探测
gbrain doctor --json             # CI/脚本
gbrain models && gbrain models doctor
gbrain search modes
gbrain search stats --days 7
```

**Embedding 维度不一致时：** `doctor` 会给出 `reinit-pglite` 或 `retrieval-upgrade` 修复命令。

---



## 4. 使用指令大全



### 4.1 生命周期与引擎


| 命令                                    | 用途                          |
| ------------------------------------- | --------------------------- |
| `gbrain init`                         | 初始化 brain                   |
| `gbrain reinit-pglite`                | PGLite 换模型/维度（破坏性，会 `.bak`） |
| `gbrain upgrade`                      | 自升级 + schema 迁移             |
| `gbrain apply-migrations --yes`       | 仅跑迁移                        |
| `gbrain migrate --to supabase|pglite` | 引擎迁移                        |
| `gbrain doctor`                       | 健康诊断                        |
| `gbrain config show/set/unset`        | 配置管理                        |




### 4.2 内容导入、入库与落盘


| 命令                           | 用途                             | 典型场景                    |
| ---------------------------- | ------------------------------ | ----------------------- |
| `gbrain import <dir>`        | 批量导入 + **设置** `sync.repo_path` | 首次灌库 / 绑定 Windows 目录    |
| `gbrain sync`                | 磁盘 ↔ DB 双向增量同步                 | 笔记 Git 仓库持续更新           |
| `gbrain sync --repo <dir>`   | 指定目录同步                         | 尚未写入 `local_path` 时显式指定 |
| `gbrain sync --watch`        | 监听变更                           | 开发时实时同步                 |
| `gbrain sync --all`          | 多 source 同步                    | 多仓库 brain               |
| `gbrain capture "..."`       | 单条内容进 brain（默认 `inbox/` slug）  | CLI / 脚本采集              |
| `gbrain capture --file PATH` | 从文件采集                          | 单文件入库                   |
| `gbrain export --dir <out>`  | 导出全部为 markdown                 | **仅 DB 时**用资源管理器查看      |
| `gbrain files list [slug]`   | 附件元数据                          | PDF/图片等（非正文 .md）        |
| `gbrain files sync <dir>`    | 扫描目录登记附件                       | 媒体附件平面                  |


**入库 → 落盘推荐顺序：**

```
init → import <brain目录> → capture / Admin 采集 → sync → embed --stale → search
```

**查看已入库内容：**


| 方式       | 命令 / 入口                                      |
| -------- | -------------------------------------------- |
| CLI 列表   | `gbrain list` / `gbrain list --type inbox`   |
| CLI 全文   | `gbrain get inbox/2026-07-15-xxxxx`          |
| Admin UI | `serve --http` 后 `#/inbox`（内容入库）、`#/ask`（检索） |
| 资源管理器    | `{sync.repo_path}\inbox\*.md`（须 §3.4 已绑定）    |


**Inbox enrichment（结构化流水线）：**

```powershell
gbrain jobs submit inbox_enrich --params '{"slug":"inbox/2026-07-15-xxxxx"}' --follow
```

PGLite 无常驻 worker，提交 job 须加 `--follow` 内联执行。

#### 页面生命周期与版本


| 命令                                                    | 用途                              |
| ----------------------------------------------------- | ------------------------------- |
| `gbrain put <slug> [< file.md]`                       | 写/更新页（正文从 stdin）                |
| `gbrain delete <slug>`                                | 软删（72h 内可 `restore` 恢复）         |
| `gbrain restore <slug>`                               | 恢复软删页（清 `deleted_at`）           |
| `gbrain purge-deleted [--older-than 30d] [--dry-run]` | 硬删超过 N 小时的软删页（admin，local-only） |
| `gbrain history <slug>`                               | 页版本历史                           |
| `gbrain revert <slug> <version-id>`                   | 回滚到某版本                          |




#### 链接 / 标签 / 时间线 / 提取


| 命令                                                               | 用途                                         |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `gbrain link <from> <to>` / `unlink`                             | 建/删类型化链接（`--link-type` / `--link-source`）  |
| `gbrain link-sources`                                            | 列出在用的 provenance + 边数                      |
| `gbrain tags <slug>` / `tag <slug> <t>` / `untag <slug> <t>`     | 标签读/加/删                                    |
| `gbrain timeline [<slug>]` / `timeline-add <slug> <date> <text>` | 页时间线读/加                                    |
| `gbrain extract <links|timeline|all>`                            | 幂等抽取链接/时间线（`--source fs|db` / `--dry-run`） |
| `gbrain check-backlinks <check|fix> [dir]`                       | 找/补缺失反链                                    |
| `gbrain publish <page.md> [--password]`                          | 生成可分享 HTML（脱敏，可选 AES-256）                  |
| `gbrain report --type <name> --content …`                        | 存带时间戳的报告到 `reports/`                       |




### 4.3 检索、合成与查询


| 命令                                             | 用途                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `gbrain search <query>`                        | 关键词/全文检索（tsvector）                                                                   |
| `gbrain query <query>`（别名 `ask`）               | 混合检索（RRF + 扩展）；`--no-expand` / `--image <path>` / `--lang`                           |
| `gbrain think "<question>"`                    | 检索 + LLM 合成答案 + **证据缺口 gaps**；`--anchor <slug>` / `--rounds N` / `--save` / `--take` |
| `gbrain graph <slug> --depth N`                | 图遍历（节点）                                                                              |
| `gbrain graph-query <slug>`                    | 按边类型/方向遍历（`--type` / `--direction in|out|both` / `--depth`）                          |
| `gbrain graph-overview`                        | 无根整图概览（最连通页 + 其间边）                                                                   |
| `gbrain backlinks <slug>`                      | 入链                                                                                   |
| `gbrain get <slug>` / `list [--type T] [-n N]` | 读页 / 列页                                                                              |


```bash
gbrain search "项目架构决策" --limit 10
gbrain search modes
gbrain search tune --apply
gbrain think "项目背景是什么" --json
```



#### 4.3.1 发散、发现与专家路由（v0.29 / v0.37）

不带检索词、面向「当前状态 / 谁懂 X / 帮我想」的问题，用这些**专用命令**（比 semantic search 更准）：


| 命令                                         | 用途                                                |
| ------------------------------------------ | ------------------------------------------------- |
| `gbrain salience [--days N] [--kind P]`    | 按情感 + 活动显著度排序的「最近发生了什么 / 什么最热」（v0.29）             |
| `gbrain anomalies [--since D] [--sigma N]` | 按 tag/type 分组的统计异常（「最近什么反常」）                      |
| `gbrain whoknows <topic> [--explain]`      | 「谁懂 X」——按专长深度 + 关系新近度排序 person/company 页          |
| `gbrain transcripts recent [--days N]`     | 最近原始对话 transcript 摘要（**local-only**，远程拒绝）         |
| `gbrain brainstorm <question> [--save]`    | 双联想（bisociation）点子生成：hybrid + 远集 + judge          |
| `gbrain lsd <question> [--save]`           | Lateral Synaptic Drift——反向 judge，奖励「离奇 + 公理反转」的点子 |




#### 4.3.2 热记忆（facts）—— `recall` / `forget`

热记忆是页外、可衰减的短时事实层（事件/偏好/承诺/信念/事实）：

```bash
gbrain recall <entity>              # 某实体的事实
gbrain recall --today               # 今天（带 kind 图标的 markdown）
gbrain recall --since "8 hours ago" # 时间窗
gbrain recall --grep <text>         # 文本过滤
gbrain recall --as-context          # 可直接注入 prompt 的 markdown
gbrain recall --watch [SECONDS]     # 按间隔重绘
gbrain forget <fact-id>             # 过期某条事实（软删，写 valid_until）
```



#### 4.3.3 冲突与真理沉淀（进阶）


| 命令                                   | 用途                                              |
| ------------------------------------ | ----------------------------------------------- |
| `gbrain find-conflicts`              | 找出相互冲突/重叠的页组（Compiled Truth 工作台）                |
| `gbrain find-contradictions`         | 上次探测缓存的疑似矛盾（不重跑）                                |
| `gbrain compile-truth <slugs>`       | LLM 合并候选页为一份权威正文 + diff（仅提案，不落库）                |
| `gbrain adopt-compiled-truth <slug>` | 把合并正文落到页（重切块/embed；记 `compiled_from`），正文从 stdin |
| `gbrain find-trajectory <entity>`    | 实体主张的时间线轨迹（类型化指标、回归、漂移）                         |




### 4.4 Embedding 与索引


| 命令                                                | 用途                |
| ------------------------------------------------- | ----------------- |
| `gbrain embed --stale`                            | 重嵌 signature 漂移的页 |
| `gbrain embed --stale --pace=balanced`            | 带 DB 节奏控制         |
| `gbrain reindex`                                  | 重建索引              |
| `gbrain reindex-code`                             | 代码边索引             |
| `gbrain retrieval-upgrade --to <model> --reindex` | 换模型并重建            |




### 4.5 AI Provider

```bash
gbrain providers list
gbrain providers test --model ollama:qwen3-embedding:4b
gbrain models
gbrain models doctor
```



### 4.6 运维与质量


| 命令                                                  | 用途                                                 |
| --------------------------------------------------- | -------------------------------------------------- |
| `gbrain status [--json] [--section <n>]`            | 单屏状态盘（sync 新鲜度、上次 cycle、jobs）                      |
| `gbrain stats`                                      | brain 统计（页数、块数等）                                   |
| `gbrain health`                                     | 健康盘（embed 覆盖率、stale 页、孤儿）                          |
| `gbrain doctor [--scope=brain] [--fast]`            | 全量健康诊断                                             |
| `gbrain advisor [--json] [--apply <id>]`            | 只读「接下来该做什么」排序清单（版本漂移、迁移、卡住的 job；`--apply` 本机确认后执行） |
| `gbrain features [--json] [--auto-fix]`             | 扫描用量 + 推荐未用功能                                      |
| `gbrain storage status [--repo <p>] [--json]`       | 存储分层状态（git-tracked vs supabase-only）               |
| `gbrain cache stats|clear|prune`                    | 语义查询缓存管理                                           |
| `gbrain check-update [--json]`                      | 检查新版本（仅报 minor/major）                              |
| `gbrain frontmatter validate|generate|audit <path>` | Frontmatter 校验/生成/审计（`--fix`）                      |
| `gbrain quarantine list|scan|clear`                 | 内容体检隔离区（见 §2.7）                                    |
| `gbrain integrity`                                  | 数据完整性（`check` / `auto` / `review`）                 |
| `gbrain lint`                                       | 内容/链接检查                                            |
| `gbrain orphans`                                    | 孤儿页                                                |
| `gbrain repair-jsonb`                               | JSONB 修复                                           |
| `gbrain smoke-test`                                 | 8 项安装后自检                                           |
| `gbrain eval *`                                     | 检索评测（开发）                                           |
| `gbrain soul-audit`                                 | Agent 身份模板                                         |




### 4.7 Source / Brain 多轴

```bash
gbrain sources list                              # 看 local_path、页数、last sync
gbrain sources add <id> --path D:\path\to\repo   # 新 source + 落盘目录
gbrain sources current --json                    # 当前 --source 解析链
gbrain config get sync.repo_path                 # default source legacy 落盘根
gbrain mounts add <brain-id>
# 路由：--brain / GBRAIN_BRAIN_ID，--source / GBRAIN_SOURCE
```

详见 `docs/architecture/brains-and-sources.md`。

### 4.8 代码索引（把代码库当 source 时）

`gbrain sync --strategy code` 或 `import` 代码目录后，可做符号级检索：


| 命令                                                       | 用途             |
| -------------------------------------------------------- | -------------- |
| `gbrain code-def <symbol> [--lang l]`                    | 符号定义位置         |
| `gbrain code-refs <symbol>`                              | 所有引用（JSON 优先）  |
| `gbrain code-callers <symbol>` / `code-callees <symbol>` | 谁调用它 / 它调用谁    |
| `gbrain reindex-code [--source id] [--yes]`              | 显式重建代码页索引      |
| `gbrain query <q> --lang <l>` / `--symbol-kind <k>`      | 限定语言/符号类型的混合检索 |




### 4.9 生活编年与本体（Chronicle / Ontology，进阶）

面向「某天发生了什么 / 某实体最后一次出现 / 某维度当前取值」的时间性查询（多为 MCP agent-facing，CLI 亦可）：


| 命令                                                                 | 用途                                         |
| ------------------------------------------------------------------ | ------------------------------------------ |
| `gbrain day <date>` / `since <date>` / `on-this-day`               | 某天 / 某日起 / 历年同日的事件与时间线                     |
| `gbrain last-seen <entity>`                                        | 实体最后一次出现（日期、事件页、距今天数）                      |
| `gbrain orient`                                                    | 命名实体的近期时间线 + 当前本体（agent 定向，零 LLM）          |
| `gbrain ontology <entity>` / `ontology-add <entity> <dim> <value>` | 读/记实体本体维度（双时序、幂等、新值 supersede）             |
| `gbrain ontology-dimensions` / `ontology-contradictions`           | 全库维度 / 有分歧的维度                              |
| `gbrain chronicle-backfill [--dry-run]`                            | 把已有 meeting/conversation/calendar 页扫进时间线事件 |




### 4.10 常用全局参数


| 标志                | 作用          |
| ----------------- | ----------- |
| `--json`          | JSON 输出     |
| `--quiet`         | 减少 stderr   |
| `--brain <id>`    | 指定 brain    |
| `--source <id>`   | 指定 source   |
| `--progress-json` | 批量命令进度 JSON |


完整 CLI 列表：`gbrain --help` 或 `gbrain --tools-json`。

---



## 5. 维护指令操作



### 5.1 日常维护

```bash
gbrain doctor
gbrain status
gbrain sync
gbrain embed --stale
gbrain search stats
```

**Dream 隔夜维护周期（一次性，cron 友好）：** `gbrain dream` 跑一遍 6 阶段维护（lint / synthesize / patterns / …），`gbrain autopilot` 是它的常驻调度器（见 §7.1）。

```bash
gbrain dream                 # 完整 6 阶段
gbrain dream --dry-run        # 预览不写
gbrain dream --json           # CycleReport JSON（给 agent）
gbrain dream --phase lint     # 单阶段
gbrain dream --pull           # 顺带 git pull brain 仓库
# cron 例：0 2 * * * gbrain dream --json >> ~/gbrain-dream.log
```

**充实 thin 页（brain 内部合成，无外部查）：** `gbrain enrich` 把 stub 页（如只有名字的 person/company）用 brain 已知信息发展成有引用的实体页。

```bash
gbrain enrich --thin --types person,company --limit 50
gbrain enrich --model anthropic:claude-haiku-4-5 --max-usd 5   # 便宜批量，卡预算
```



### 5.2 备份


| 引擎       | 备份方式                                                           |
| -------- | -------------------------------------------------------------- |
| PGLite   | 复制整个 `brain.pglite/` 目录；`reinit-pglite` 自动留 `brain.pglite.bak` |
| Postgres | `pg_dump` / Supabase 控制台快照                                     |
| 配置       | 复制 `~/.gbrain/config.json`                                     |


```powershell
Copy-Item -Recurse $env:USERPROFILE\.gbrain\brain.pglite `
  "$env:USERPROFILE\.gbrain\brain.pglite.backup-$(Get-Date -Format yyyyMMdd)"
```



### 5.3 故障排查


| 现象           | 排查命令                                                         |
| ------------ | ------------------------------------------------------------ |
| 任意异常         | `gbrain doctor --json`                                       |
| Embedding 失败 | `gbrain providers test --model <model>`                      |
| 维度不匹配        | `gbrain doctor`（`embedding_width_consistency`）               |
| Schema 过旧    | `gbrain apply-migrations --yes`                              |
| Sync 卡住      | 查 `GBRAIN_SYNC_STALL_ABORT_SECONDS`；`doctor` 看 sync_failures |
| 队列积压         | `gbrain jobs stats`                                          |
| MCP 连不上      | `curl localhost:3131/health`                                 |


```bash
gbrain doctor --fix   # 自动修复（skills 目录只读时会拒绝）
```

#### resolver_health WARN vs `mcp.skills_dir`（两条不同的路径，勿混淆）

`gbrain doctor` 报 `resolver_health` WARN（"Could not find skills directory"）时，**先别急着去改 `mcp.skills_dir`**——这是两条完全独立的解析路径：

- **`resolver_health`**（以及 `gbrain check-resolvable` / `gbrain routing-eval`）走的是本地自动探测 `autoDetectSkillsDirReadOnly()`：
  优先级 `$GBRAIN_SKILLS_DIR` → `$OPENCLAW_WORKSPACE` → 从当前目录向上找 `skills/` → `~/.openclaw/workspace` → gbrain 仓库根目录 → `./skills`。**完全不读 `mcp.skills_dir` 这个 DB 配置键。**
- **`mcp.skills_dir`** 只在远程 MCP 的 `list_skills`/`get_skill` 两个操作里生效，服务对象是通过 MCP 连过来的 thin client（Claude Code、Cursor、Codex 等，参见§四接入方式）。未设置时它 **不是**完全等价于 `resolver_health` 的自动探测——两者共用同一个 `resolveSkillsDir`（[skill-catalog.ts:199](../../src/core/skill-catalog.ts)），但按 `ctx.remote` 分岔：只有 `ctx.remote === false`（本地直调）才会用带 install-path 兜底的只读版本；而**真正的 MCP 调用（Claude Code/Cursor 走 stdio）永远是 `ctx.remote = true`**（[mcp/server.ts:44](../../src/mcp/server.ts)），走的是**没有 install-path 兜底**的写路径版本（故意去掉——托管的 gbrain 不能把自己开发用的技能泄露给陌生远程客户端）。也就是说：不设置 `mcp.skills_dir` 时，MCP 调用只能靠 `$GBRAIN_SKILLS_DIR`/`$OPENCLAW_WORKSPACE`/**cwd 向上走**这几层，**不会**像 `resolver_health` 那样自动锚定到项目根目录——除非 MCP server 进程启动时的 cwd 恰好在项目树内（比如 `mcp.json` 里显式加了 `cwd` 字段，见§四）。两条路径只是"常因同一个根本原因（探测不到 skills 目录）而失败"，不是"修好一个另一个自动跟着好"。

**不修的影响：**

| 命令 | 影响 |
| --- | --- |
| `gbrain doctor`（默认 scope=all） | 仅 WARN，不影响 exit code；Overall health score −5，"Skill checks" 类目分数下降。不影响 `brain_score`（数据质量，两者正交） |
| `gbrain check-resolvable` | **exit 1**（硬失败，`no_skills_dir`）——只有你主动跑它（比如接进 CI）才会咬人 |
| `gbrain routing-eval` | 同上，评估不了路由准确率 |
| Dream/autopilot 的 `skillopt` 优化阶段 | 默认关闭（`cycle.skillopt.enabled=false`），找不到就静默 skip，零影响 |
| 日常 `query`/`think`/`sync`/`embed`/`capture` | **不受影响**，这些命令不读 skills 目录 |
| Claude Code 本身在这个项目里的技能路由 | **不受影响**——Claude Code 直接读 checkout 里的 `skills/*.md`，不走这条 auto-detect |

`mcp.publish_skills` 运行时代码默认值是 **false**，但 `gbrain init`（PGLite 和 Postgres 分支都一样）会在新装时把它写成 `true` 到 `~/.gbrain/config.json`（文件面配置优先于 DB 面默认值）。也就是说，**用 `gbrain init` 装出来的库，这个开关大概率已经是开的**——如果你的 Claude Code/Cursor 是照§四接进来的 MCP，`list_skills`/`get_skill` 实际是可达的，`mcp.skills_dir` 不设只是继承跟 doctor 一样的自动探测结果，不是"关掉了就没事"。

**修 `resolver_health` 的两个方案：**

```bash
# 方案 A（最省事）：直接指向本仓库自带的 skills/（已有 RESOLVER.md，79 个技能）
setx GBRAIN_SKILLS_DIR "C:\Users\<you>\Downloads\AI\gbrain\skills"   # 新终端生效
$env:GBRAIN_SKILLS_DIR = "C:\Users\<you>\Downloads\AI\gbrain\skills" # 当前会话立即生效

# 方案 B：独立一份到你自己的目录（比如挨着绑定的笔记目录）
gbrain skillpack scaffold --all --workspace "D:\MyBrain"
# 注意：scaffold 明确不碰 RESOLVER.md/AGENTS.md（v0.33 起的"host 自己管路由文件"契约），
# 跑完后 D:\MyBrain\skills\ 下没有 RESOLVER.md，resolver_health 仍会 WARN，
# 还要手动补一份：
Copy-Item "C:\Users\<you>\Downloads\AI\gbrain\skills\RESOLVER.md" "D:\MyBrain\skills\RESOLVER.md"
```

方案 A 更简单，代价是路由依赖这个开发 checkout 一直存在；方案 B 独立但多一步手动复制。只有在启用 `mcp.publish_advisor`/给远程 thin client 提供跟本地不同目录时才需要额外 `gbrain config set mcp.skills_dir <path>`（已在 `KNOWN_CONFIG_KEYS` 注册，不需要 `--force`）。

**根因更新（2026-07-16）：本仓库大多数情况下已不需要上面两个方案。** 深挖后发现这其实是 `src/core/path-confine.ts` 的 `isPathContained()` 里一个 **Windows 专属 bug**：分隔符硬编码成 `/`，而 `realpathSync()` 在 Windows 上返回反斜杠路径，导致对任何真实的父子目录关系都会误判成"不包含"——`resolver_health` 的每一层探测（`cwd_walk_up`/`repo_root`/`install_path`）因此全部被这道校验拦下，即便 `skills/RESOLVER.md` 就在当前目录下。已在本仓库修复（改用 `path.sep`），详见 `CUSTOM.md` "我修复的上游 Bug"一节（含修复前后的 `bun test test/path-confine.test.ts` 对比）。**修复后，在项目根目录下直接跑 `gbrain check-resolvable` 或 `gbrain doctor` 就应该能自动探测到 `skills/`，不需要再配置 `$GBRAIN_SKILLS_DIR` 或 scaffold 到别的目录**——上面方案 A/B 留作参考（比如你在别的机器上用的是未合并这个修复的上游版本，或者 skills 确实不放在这个项目里）。

### 5.4 性能调优

```bash
gbrain config set search.mode balanced
gbrain search modes --reset
gbrain embed --stale --pace=balanced
```

**Sync / Pace 环境变量：**


| 变量                                | 默认   | 说明                         |
| --------------------------------- | ---- | -------------------------- |
| `GBRAIN_SYNC_CHECKPOINT_EVERY`    | 1000 | 每 N 文件写检查点                 |
| `GBRAIN_SYNC_YIELD_EVERY`         | 64   | 事件循环让出                     |
| `GBRAIN_SYNC_STALL_ABORT_SECONDS` | 900  | 无进展超时                      |
| `GBRAIN_PACE_MODE`                | off  | gentle/balanced/aggressive |


详见 `docs/progress-events.md`（批量命令进度）。

### 5.5 升级与迁移

```bash
gbrain upgrade
gbrain upgrade --force-schema
gbrain retrieval-upgrade --to voyage:voyage-3-large --reindex
gbrain reinit-pglite --embedding-model ollama:qwen3-embedding:4b --embedding-dimensions 1024 --yes
```

发布流程见 `docs/RELEASING.md`。

---



## 6. Server 模式运行



### 6.1 stdio MCP（本地 Agent）

```powershell
bun run src/cli.ts serve
claude mcp add gbrain -- bun run src/cli.ts serve
```

- 无需 token、无需公网
- PGLite / Postgres 均可
- 可选：`--stdio-idle-timeout <秒>`

详见 `docs/tutorials/connect-coding-agent.md`。

### 6.2 HTTP MCP（远程客户端）

```bash
gbrain serve --http --port 3131 --bind 0.0.0.0 \
  --public-url https://your-brain.ngrok.app
```


| 端点                                        | 用途       |
| ----------------------------------------- | -------- |
| `/mcp`                                    | MCP 工具调用 |
| `/health`                                 | 存活探针     |
| `/admin`                                  | 管理 SPA   |
| `/admin/events`                           | SSE 活动流  |
| `/.well-known/oauth-authorization-server` | OAuth 发现 |


**常用标志：**


| 标志                      | 说明                                                     |
| ----------------------- | ------------------------------------------------------ |
| `--port N`              | 监听端口（默认 3131）                                          |
| `--bind 0.0.0.0`        | 接受非本机连接（ngrok 必需）                                      |
| `--public-url URL`      | OAuth issuer 公网地址                                      |
| `--token-ttl N`         | access token 有效期（秒，默认 3600）                            |
| `--enable-dcr`          | 动态客户端注册（DCR 客户端默认 authorization_code）                  |
| `--enable-dcr-insecure` | 额外允许绕过 consent 的 client_credentials（隐含 `--enable-dcr`） |
| `--log-full-params`     | 完整请求参数（勿用于多租户）                                         |


HTTP 服务相关 env（可选）：`GBRAIN_HTTP_CORS_ORIGIN`（CORS 白名单）、`GBRAIN_HTTP_TRUST_PROXY=1`（信任 X-Forwarded-For）、`GBRAIN_HTTP_RATE_LIMIT_IP` / `_TOKEN`（限流）、`GBRAIN_ADMIN_BOOTSTRAP_TOKEN`（Admin 登录 token）。

### 6.3 OAuth 与认证

```bash
gbrain auth register-client perplexity --grant-types client_credentials --scopes "read write"
gbrain auth create "claude-desktop"    # 遗留 Bearer（Postgres）
gbrain connect https://host/mcp --token gbrain_xxx --agent codex
```


| Scope   | 允许                             |
| ------- | ------------------------------ |
| `read`  | search、get_page、list_pages、图遍历 |
| `write` | put_page、delete_page、add_link  |
| `admin` | 客户端管理、token 撤销                 |


客户端配置见 `docs/mcp/` 目录下各文件。

### 6.4 ngrok 多服务共用

见 `recipes/ngrok-tunnel.md`：

```
https://your-brain.ngrok.app
  ├── /mcp    → gbrain serve --http (3131)
  └── /voice  → agent-voice server (8765)
```

v0.34+ `--http` 默认绑定 `127.0.0.1`，远程访问必须 `--bind 0.0.0.0`。

### 6.5 生命周期管理

```bash
gbrain serve --http --port 3131 --bind 0.0.0.0
curl http://localhost:3131/health
# 停止：Ctrl+C
```

Admin：`http://localhost:3131/admin`（启动时 stderr 的 bootstrap token 登录）。  
构建 Admin SPA：`bun run build:admin`。

**PGLite 单进程锁：** 同一 `brain.pglite` 同时只能一个进程可靠写入。`serve --http` 运行时，另开终端跑 `import` / `sources list` 可能超时 —— 批量写操作前先停 serve。

---



## 7. 特殊功能配置



### 7.1 Minions Worker

**要求：** 持久 worker **仅 Postgres**；PGLite 仅支持 `submit --follow` 内联执行。

```bash
gbrain jobs submit embed-backfill --params '{"source_id":"default"}'
gbrain jobs work --concurrency 4
gbrain jobs supervisor start --detach --json
gbrain jobs supervisor status --json
gbrain jobs supervisor stop
```

```bash
gbrain autopilot --install --repo /path/to/brain-repo
gbrain autopilot --uninstall
gbrain autopilot --status [--json]
```

> PGLite / `minion_mode=off` 时 autopilot 走 **inline** 回退（sync→extract→embed 内联），不 fork worker；Postgres 才是常驻 worker 模式。个人 PGLite 栈用 `gbrain dream`（§5.1）一次性跑更简单。



### 7.2 Admin 界面

- 访问：`gbrain serve --http` 后打开 `/admin`
- 功能：OAuth 客户端、请求日志、SSE、配置导出
- 源码：`admin/`



### 7.3 通知系统（Telegram / Slack / Discord）

**GBrain 核心没有统一的「通知频道」配置。** 通知通过 **技能 + Agent 平台 + Webhook** 实现：


| 能力            | 位置                          |
| ------------- | --------------------------- |
| Cron 定时任务     | `skills/cron-scheduler`     |
| Webhook 入站    | `skills/webhook-transforms` |
| Telegram 告警示例 | `recipes/restart-sweep.md`  |




### 7.4 语音服务（Twilio / WebRTC）

推荐：`recipes/agent-voice`（`twilio-voice-brain` 已废弃）。

```bash
gbrain integrations install agent-voice --target <host-repo>
```


| 变量                                         | 说明                  |
| ------------------------------------------ | ------------------- |
| `OPENAI_API_KEY`                           | OpenAI Realtime（必需） |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | 电话接入（可选）            |
| `NGROK_AUTHTOKEN`                          | 公网 webhook          |




### 7.5 其他集成

```bash
gbrain skillpack scaffold --all
gbrain skillpack-check
gbrain features
gbrain integrations install retrieval-reflex --target <host-repo>
```



### 7.6 Push-based context（主动上下文推送，v0.42/v0.43）

不等 agent 提问，brain 就从最近对话窗口**主动推送**相关页指针（置信度门控、零 LLM、默认每轮上限 3、最多 5）。三条通道共用一个内核（`src/core/context/volunteer.ts`）：


| 通道       | 入口                                                   | 说明                                              |
| -------- | ---------------------------------------------------- | ----------------------------------------------- |
| `reflex` | 自动（context engine 内）                                 | 插件宿主默认开；无需调用                                    |
| `op`     | `gbrain volunteer-context` / MCP `volunteer_context` | 无插件的 agent 每轮调一次                                |
| `watch`  | `gbrain watch`                                       | 把 transcript 持续喂进 stdin，volunteer 的页从 stdout 流出 |


```bash
# 一次性：把最近几轮（旧→新）管进去
printf 'user: 我在看 acme-example 的融资\n' | gbrain volunteer-context
# 流式：transcript 边流边出页
some-feed | gbrain watch --json --window-turns 4 --max-pages 3 --min-confidence 0.7
# 反馈环：volunteer 的页实际被打开的比例（近似）
gbrain volunteer-context --stats
```

相关键（文件/env 平面）：`retrieval_reflex`（总开关，默认开）、`retrieval_reflex_window_turns`（默认 4）、`retrieval_reflex_max_pointers`（默认 3）。

> **PGLite 单连接注意：** `gbrain watch` 会**整段会话占用**数据库连接，其间并发的 `gbrain serve` 或任何写操作会阻塞到 watch 退出。PGLite 上建议**分批跑**（管道输入到 EOF 即退），或依赖 ambient `reflex` 通道（走已运行 serve 的 resolve socket）。Postgres 不受影响。事件落 `context_volunteer_events`，90 天后由 dream 周期清理。详见 `docs/guides/push-context.md`。

---



## 8. 模型 Tier、可选升级与检索精排

本节汇总 **DeepSeek + Ollama 本机栈** 运维中易踩坑的配置：Tier 模型注入优先级、Subagent 网关循环、Schema Pack 升级、Takes 冷存储、Reranker 精排。代码入口：`src/core/model-config.ts`（`resolveModel`）、`src/core/ai/gateway.ts`（`reconfigureGatewayWithEngine`）、`src/core/search/mode.ts`（reranker bundle）。

### 8.1 四档 Tier 与任务映射

GBrain 用四档 **Tier** 给内部 LLM 调用分组；未单独配置的任务键会 **继承对应 Tier** 的解析结果。


| Tier          | 典型用途（Anthropic 默认） | 内部任务键（节选）                                                                           |
| ------------- | ------------------ | ----------------------------------------------------------------------------------- |
| **utility**   | 快、便宜（Haiku 档）      | `models.expansion`（查询扩展）、`models.dream.synthesize_verdict`（Dream 裁决）、矛盾探测 judge     |
| **reasoning** | 日常主力（Sonnet 档）     | `models.chat`（默认 chat）、`models.dream.synthesize` / `models.dream.patterns`、facts 抽取 |
| **deep**      | 贵、深推理（Opus 档）      | `models.think`、`models.auto_think`、SkillOpt optimizer                               |
| **subagent**  | 多轮 tool 循环         | `models.subagent`（`gbrain agent run` / minion subagent）                             |


查看当前解析结果：

```bash
gbrain models              # 人类可读路由表
gbrain models --json       # 机器可读（tiers + per_task）
```



### 8.2 DeepSeek + Ollama 推荐配对

**本机会话验证过的栈：** Embedding 走 Ollama，Chat / Expansion / Dream / Agent 走 DeepSeek V4。


| 角色                         | 推荐模型                                | 配置位置                                            |
| -------------------------- | ----------------------------------- | ----------------------------------------------- |
| Embedding                  | `ollama:qwen3-embedding:4b`（1024 维） | 文件平面 `embedding_model` / `embedding_dimensions` |
| Chat / 深推理 / Dream / Think | `deepseek:deepseek-v4-pro`          | DB `models.tier.reasoning` + `models.tier.deep` |
| 查询扩展 / utility             | `deepseek:deepseek-v4-flash`        | DB `models.tier.utility`                        |
| Subagent                   | `deepseek:deepseek-v4-pro`          | DB `models.tier.subagent` + **§8.4** 网关循环       |


**文件平面**（`~/.gbrain/config.json`）—— API Key 与初始 gateway 种子：

```json
{
  "deepseek_api_key": "sk-...",
  "chat_model": "deepseek:deepseek-v4-pro",
  "expansion_model": "deepseek:deepseek-v4-flash",
  "provider_base_urls": { "deepseek": "https://api.deepseek.com" }
}
```

**数据库平面**（连接 brain 后 **必须** 写入，否则 §8.3 会把 chat/expansion 打回 Anthropic 默认）：

```bash
gbrain config set models.tier.utility   deepseek:deepseek-v4-flash
gbrain config set models.tier.reasoning deepseek:deepseek-v4-pro
gbrain config set models.tier.deep      deepseek:deepseek-v4-pro
gbrain config set models.tier.subagent  deepseek:deepseek-v4-pro
gbrain config set agent.use_gateway_loop true
gbrain config set search.mode tokenmax
```

DeepSeek V4 自带服务端 **Context Caching**（账单字段 `prompt_cache_hit_tokens`）。canonical 定价在 `src/core/model-pricing.ts`：`input` = cache-miss，`input_cache_hit` = 命中价（Flash $0.0028/M，Pro $0.003625/M）。这与 recipe 里 `supports_prompt_cache: false`（指 Anthropic 式 cache 标记）不是同一概念。

### 8.3 模型解析与 Gateway 注入优先级

运维上须理解 **两阶段** gateway 配置：

```mermaid
flowchart LR
  A[config.json + env] --> B["configureGateway()"]
  B --> C["engine.connect()"]
  C --> D["reconfigureGatewayWithEngine()"]
  D --> E["resolveModel() 读 DB config"]
```



1. **启动初 stamp（同步）：** `buildGatewayConfig(config.json)` → `configureGateway`。此时 `chat_model` / `expansion_model` 来自文件平面。
2. **连接后 re-stamp（异步）：** 几乎每条需要 DB 的命令在 `engine.connect()` 之后都会调用 `reconfigureGatewayWithEngine()`，用 `resolveModel()` **覆盖** expansion / chat：
  - expansion → `models.expansion` 或 **utility** tier
  - chat → `models.chat` 或 **reasoning** tier

`resolveModel()` **优先级**（高 → 低；同 `src/core/model-config.ts`）：


| 顺序  | 来源                   | 说明                                                           |
| --- | -------------------- | ------------------------------------------------------------ |
| 1   | CLI `--model`        | 单次命令覆盖                                                       |
| 2   | 任务专用键                | 如 `models.chat`、`models.expansion`、`models.dream.synthesize` |
| 3   | 已废弃旧键                | 带 stderr 警告                                                  |
| 4   | `models.default`     | 全局锤子；**优先于** `models.tier.`*                                 |
| 5   | `models.tier.<tier>` | 四档 Tier 覆盖                                                   |
| 6   | `GBRAIN_MODEL` 环境变量  |                                                              |
| 7   | `TIER_DEFAULTS`      | 内置 Anthropic 默认（Haiku / Sonnet / Opus）                       |
| 8   | 调用方 fallback         | `reconfigureGatewayWithEngine` 传入的 `config.json` 值           |


**关键陷阱：** 当调用方指定了 `tier`（gateway re-stamp 始终指定），且 DB 里 **没有** `models.default`、`models.tier.`*、任务键时，**第 7 步** `TIER_DEFAULTS`**（Anthropic）会先于第 8 步** `config.json` **fallback 生效**。因此只改 `config.json` 的 `chat_model` / `expansion_model`，运行时仍可能显示 `claude-`*。

**Dream / autopilot / agent 与 Tier 的关系：**


| 能力                                   | 模型来源                                   | 备注                                             |
| ------------------------------------ | -------------------------------------- | ---------------------------------------------- |
| `gbrain search` expansion            | `models.expansion` → **utility** tier  | `tokenmax` 才强依赖                                |
| `gateway.chat()` / 默认对话              | `models.chat` → **reasoning** tier     |                                                |
| `gbrain dream` synthesize / patterns | `models.dream.*` → reasoning / utility | 未设则继承 tier                                     |
| `gbrain think`                       | **deep** tier                          |                                                |
| `gbrain agent run` / subagent job    | **subagent** tier                      | 非 Anthropic 须 §8.4                             |
| autopilot 夜间质量探测                     | 各 phase 自有键 + tier                     | 默认关闭 `autopilot.nightly_quality_probe.enabled` |


验证 re-stamp 是否生效：看 `gbrain models --json` 里 `tiers.reasoning.resolved` / `per_task` 中 `models.expansion`、`models.chat` 的 `resolved` 字段，而非仅读 `config.json`。

### 8.4 Subagent：`agent.use_gateway_loop`

Subagent 默认走 **Anthropic Messages API** 形态的 tool 循环。若 `models.tier.subagent` 解析为非 Anthropic（如 DeepSeek），须启用 **gateway-native tool loop**：

```bash
gbrain config set agent.use_gateway_loop true
```

- 未启用时：subagent job 会 stderr 警告并拒绝非 Anthropic 模型；`gbrain doctor` 可能出现 `subagent_capability` 相关 WARN。
- 该键 **不在** `KNOWN_CONFIG_KEYS` 白名单内；若 `gbrain config set` 拒绝，使用 `gbrain config set agent.use_gateway_loop true --force`。
- 仅 Chat（如 `gbrain think`）不依赖此开关；**后台 subagent / agent run** 依赖。



### 8.5 Schema Pack 升级（可选）

**背景：** Schema Pack 定义页的 **类型 taxonomy**（`pages.type`）、抽取规则、链接类型等。v0.42+ 新装默认 `gbrain-base-v2`（15 种规范类型）；仍在 `gbrain-base@1.x` 的旧 brain 可通过 `unify-types` 任务一次性迁移。

**现象：** `gbrain doctor` 或 `gbrain onboard --check` 出现 `pack_upgrade_available` WARN——当前 pack 为 `gbrain-base@1.x`，后继包 `gbrain-base-v2` 可用。


| 项    | 说明                                                        |
| ---- | --------------------------------------------------------- |
| 是否必须 | **否**。空库或页数很少时可忽略；类型混乱、搜索 `--type` 不准、enrichment 漏页时再升级   |
| 成本   | 纯 SQL 重类型 + 别名/链接表写入，**无 LLM 花费**；大库（~18 万页）约 **10 分钟**   |
| 自动化  | **不会**被 autopilot 自动执行（PROTECTED + manual_only）；须人工提交 job |




#### 路径 A：新装 — 直接用 v2（无需 migrate）

从未 import 过内容，或愿意 **重建 brain** 时：

```json
// ~/.gbrain/config.json
"schema_pack": "gbrain-base-v2"
```

或：

```bash
gbrain schema use gbrain-base-v2
gbrain schema active --json    # 确认 identity 含 gbrain-base-v2
```



#### 路径 B：已有 brain — 四步升级

**第 1 步：确认当前 pack**

```powershell
gbrain schema active --json
gbrain onboard --check
```

- 若 `identity` 已是 `gbrain-base-v2@...` → **无需升级**。
- 若出现 `pack_upgrade_available` WARN → 继续。

**第 2 步：干跑预览（不写入）**

```powershell
gbrain onboard --check --explain
```

输出会列出（dry-run）：

- 各 legacy 类型 → 规范类型的 **retype** 页数
- 将变为 **slug_aliases** 的重定向页数
- 将变为 **links** 表的边页数
- 未覆盖的长尾类型 → `note`（`frontmatter.legacy_type` 保留原值）

预览结果不合理时 **不要执行**；可 fork 自定义 pack 调整 `mapping_rules`（见 `docs/architecture/type-taxonomy.md`）。

**第 3 步：备份（强烈建议）**

```powershell
# PGLite：整目录复制
Copy-Item -Recurse $env:USERPROFILE\.gbrain\brain.pglite `
  "$env:USERPROFILE\.gbrain\brain.pglite.pre-unify-$(Get-Date -Format yyyyMMdd)"

Copy-Item $env:USERPROFILE\.gbrain\config.json `
  "$env:USERPROFILE\.gbrain\config.json.bak"
```

Postgres 团队库：用 `pg_dump` 或控制台快照。

**第 4 步：提交并执行** `unify-types`

```powershell
# PGLite：必须加 --follow（本机无常驻 worker，内联执行）
gbrain jobs submit unify-types `
  --params '{"target_pack":"gbrain-base-v2"}' `
  --follow

# Postgres：可 --follow，或由常驻 worker 消化
# gbrain jobs work --concurrency 2   # 另开终端
# gbrain jobs submit unify-types --params '{"target_pack":"gbrain-base-v2"}'
# gbrain jobs follow <job_id>
```

Handler 内部阶段（全程 stderr 进度）：

1. 预检 + 获取 `gbrain-unify` 库锁（60 分钟 TTL）
2. 按规则批量 **retype**（每批 1000 页，`legacy_type` 写入 frontmatter）
3. 长尾未知类型 → `note`
4. 边页 → **links** 行；重定向页 → **slug_aliases**（原页 soft-delete，72h 内可 restore）
5. 路径前缀补全未 typed 页
6. **自动切换** active pack → `gbrain-base-v2`（写 DB + `config.json`）
7. 校验 distinct type 数量并输出摘要

升级进行中 **不要** 并行跑 `sync` / `import` / 第二个 `unify-types`。

**第 5 步：验证**

```powershell
gbrain onboard --check          # pack_upgrade_available 应变 ok
gbrain schema active --json     # identity 应为 gbrain-base-v2
gbrain schema stats --json      # 查看类型分布
gbrain doctor --scope=brain
```



#### 回滚


| 场景                  | 操作                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| 仅想换回旧 pack 声明       | `gbrain schema use gbrain-base` 或 `gbrain schema downgrade --to gbrain-base`                                    |
| 恢复被 soft-delete 的页  | 72h 内：`gbrain restore <slug>`                                                                                   |
| 批量恢复 retype 前的 type | SQL：`UPDATE pages SET type = frontmatter->>'legacy_type' WHERE frontmatter ? 'legacy_type'`（Postgres；PGLite 同理） |
| 整库灾难                | 恢复第 3 步的 `brain.pglite` 目录备份                                                                                    |


`unify-types` **不会**改写正文 wikilink 文本；旧 slug 通过 `slug_aliases` 解析，一般无需手工改 markdown。

#### 相关命令速查


| 命令                                                         | 用途                    |
| ---------------------------------------------------------- | --------------------- |
| `gbrain schema list`                                       | 列出 bundled + 已安装 pack |
| `gbrain schema show`                                       | 打印当前 active pack 内容   |
| `gbrain schema active --json`                              | 解析链路与 pack identity   |
| `gbrain onboard --check [--explain]`                       | 发现升级建议 + 干跑           |
| `gbrain jobs submit unify-types --params '...' [--follow]` | 执行迁移                  |


详见 `docs/architecture/type-taxonomy.md`、`docs/architecture/pack-upgrade-mechanism.md`。

### 8.6 Takes 冷存储（可选）

Takes 是页内可评分 **主张（claims）** 的冷存储队列；**默认关闭**，空库 `takes_count: 0` 为正常 WARN。


| 键                         | 默认      | 作用                                                  |
| ------------------------- | ------- | --------------------------------------------------- |
| `takes.bootstrap_enabled` | `false` | **第一重门**：必须为 `true` 才允许任何 bootstrap / 从页抽取          |
| `takes.autopilot_allowed` | `false` | **第二重门**：autopilot 自动提交 takes-bootstrap remediation |


**手动开启抽取：**

```bash
# takes.* 不在 KNOWN_CONFIG_KEYS，config set 须加 --force（见 §2.3）
gbrain config set takes.bootstrap_enabled true --force
gbrain takes extract --from-pages --yes    # 仍须 --yes 确认
```

- 允许页类型：`concept`、`atom`、`lore`、`briefing`、`writing`、`originals`。
- 抽取模型继承 **reasoning** tier（`facts.extraction_model` 未设时）。
- `cycle.grade_takes.write_gstack_learnings` 等与 gstack 耦合的写入默认关闭，外部用户一般保持 `false`。

**何时需要：** 要用 Takes 校准、Dream pattern 跨 take 主题、contradiction 类 eval 时再开；纯检索 + 笔记库可不开。

### 8.7 Reranker 精排配置

Cross-encoder reranker 插在 hybrid 流水线 **去重之后、token budget 之前**；失败 **fail-open**（保持原 RRF 顺序，写 audit JSONL）。

**按搜索模式的 bundle 默认**（`src/core/search/mode.ts`）：


| `search.mode`  | `search.reranker.enabled` | 默认模型                     |
| -------------- | ------------------------- | ------------------------ |
| `conservative` | **off**                   | —                        |
| `balanced`     | **on**                    | `zeroentropyai:zerank-2` |
| `tokenmax`     | **on**                    | `zeroentropyai:zerank-2` |


**常用 DB 键：**


| 键                                        | 说明                                                        |
| ---------------------------------------- | --------------------------------------------------------- |
| `search.reranker.enabled`                | 总开关；关闭用 `false`，**不要**设 `reranker_model none`             |
| `search.reranker.model`                  | 如 `zeroentropyai:zerank-2`                                |
| `search.reranker.top_n_in` / `top_n_out` | 送入 rerank 的候选数 / 截断（bundle 通常与 `search.limit_default` 对齐） |
| `search.reranker.timeout_ms`             | 超时；本地 CPU reranker 可适当加大                                  |


**本机 Ollama 栈建议：**


| 方案                         | 配置                                                                                                                             | 说明                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **关闭精排**（省 Key / 纯本地）      | `gbrain config set search.reranker.enabled false`                                                                              | `conservative` 等价体验；balanced/tokenmax 需显式关                               |
| **ZeroEntropy 云**          | 文件或 env 配 `ZEROENTROPY_API_KEY` + 保持 bundle 默认                                                                                 | 未配 Key 时 rerank fail-open，doctor 里 ZeroEntropy auth 失败可忽略                |
| **本地 llama-server rerank** | 另起 `--reranking` 进程，设 `LLAMA_SERVER_RERANKER_BASE_URL`，`gbrain config set search.reranker.model llama-server-reranker:<alias>` | Ollama **不提供** rerank API；见 `docs/ai-providers/llama-server-reranker.md` |


**与 tokenmax 的搭配：** `tokenmax` 已开 expansion + 大 payload，reranker 对 50 条候选重排收益最大；本机无 ZE Key 且不想起 llama rerank 时，可 `tokenmax` + `search.reranker.enabled false` 仍保留 expansion。

**诊断：**

```bash
gbrain search modes                    # 看 reranker 各旋钮归因
gbrain doctor --scope=brain          # reranker_health（enabled 时看近期 fail audit）
```

**检索：**

```bash
gbrain query "你的问题" --limit 50
# 或
gbrain search "你的问题" --limit 50
```



### 8.8 推荐验证序列（DeepSeek 栈）

```powershell
gbrain config show
gbrain models --json
gbrain providers test --model ollama:qwen3-embedding:4b
gbrain doctor --scope=brain
gbrain search modes
gbrain onboard --check                 # 可选：pack / takes WARN
```

**CLI 说明：** `gbrain models doctor` 用于对各 chat/expansion/rerank 面做 ~1 token 探测；若子命令未进入 doctor 模式，以 `gbrain models --json` 与 `gbrain providers test` 为准。

---



## 9. 指令速查总表（按场景）

> 完整参数：`gbrain <命令> --help` 或 `gbrain --tools-json`（MCP 操作契约）。



### 9.1 安装与引擎


| 指令                                                                  | 作用                     |
| ------------------------------------------------------------------- | ---------------------- |
| `gbrain init --pglite --embedding-model … --embedding-dimensions N` | 初始化 PGLite + embedding |
| `gbrain reinit-pglite … --yes`                                      | 换 embedding 模型/维度（破坏性） |
| `gbrain upgrade` / `apply-migrations --yes`                         | 版本升级 + schema 迁移       |
| `gbrain doctor [--scope=brain] [--fast]`                            | 健康检查                   |
| `gbrain config show` / `set` / `get` / `unset`                      | DB 平面运行时配置             |
| `gbrain status`                                                     | brain 概要状态             |




### 9.2 入库、落盘、页面


| 指令                                             | 作用                                |
| ---------------------------------------------- | --------------------------------- |
| `gbrain import <dir>`                          | 导入 markdown + 设置 `sync.repo_path` |
| `gbrain sync [--repo <dir>] [--all]`           | 磁盘与 DB 同步                         |
| `gbrain capture "text"` / `--file` / `--stdin` | 单条写入 inbox                        |
| `gbrain export --dir <out>`                    | 导出全部页为 .md                        |
| `gbrain list [--type T] [-n N]`                | 列 slug                            |
| `gbrain get <slug>`                            | 读页正文                              |
| `gbrain put <slug>`                            | 写页（高级）                            |
| `gbrain sources list`                          | source 与 **local_path**           |
| `gbrain config get sync.repo_path`             | 是否已绑定落盘目录                         |
| `gbrain files list [slug]`                     | 附件索引                              |




### 9.3 检索与合成


| 指令                                                                 | 作用          |
| ------------------------------------------------------------------ | ----------- |
| `gbrain search "q" [--limit N] [--json]`                           | 关键词检索       |
| `gbrain query "q"`（别名 `ask`）                                       | 混合检索        |
| `gbrain think "q" [--save] [--json]`                               | 合成答案 + gaps |
| `gbrain graph <slug> --depth N` / `graph-query` / `graph-overview` | 知识图谱遍历      |
| `gbrain search modes` / `stats` / `tune`                           | 搜索模式与调参     |




### 9.4 Embedding 与索引


| 指令                                   | 作用                   |
| ------------------------------------ | -------------------- |
| `gbrain embed --stale [--pace=mode]` | 补/重算向量               |
| `gbrain reindex` / `reindex-code`    | 重建索引                 |
| `gbrain providers test --model …`    | 探测 embedding/chat 可达 |
| `gbrain models` / `models doctor`    | 模型路由表                |




### 9.5 任务队列（PGLite 须 `--follow`）


| 指令                                                          | 作用             |
| ----------------------------------------------------------- | -------------- |
| `gbrain jobs list [--status S]`                             | 列 job          |
| `gbrain jobs submit inbox_enrich --params '{…}' --follow`   | Inbox 结构化      |
| `gbrain jobs submit embed-backfill --params '{…}' --follow` | 批量 embed       |
| `gbrain jobs submit unify-types --params '{…}' --follow`    | Schema pack 升级 |




### 9.6 服务与管理界面


| 指令                                | 作用                                 |
| --------------------------------- | ---------------------------------- |
| `gbrain serve`                    | stdio MCP（Cursor / Claude Code）    |
| `gbrain serve --http --port 3131` | HTTP MCP + **Admin SPA**（`/admin`） |
| `bun run build:admin`             | 构建 Admin 前端（Fork 开发）               |


Admin 常用路由：`#/inbox` 内容入库 · `#/ask` 精准检索 · `#/graph` 知识网络 · `#/jobs` 后台调度。

### 9.7 运维与质量


| 指令                                      | 作用             |
| --------------------------------------- | -------------- |
| `gbrain lint` / `orphans` / `integrity` | 内容与数据质量        |
| `gbrain quarantine list|scan|clear`     | 内容体检隔离区        |
| `gbrain status` / `stats` / `health`    | 状态盘 / 统计 / 健康盘 |
| `gbrain advisor` / `features`           | 下一步建议 / 未用功能推荐 |
| `gbrain storage status` / `cache stats` | 存储分层 / 查询缓存    |
| `gbrain smoke-test`                     | 安装后 8 项自检      |
| `gbrain schema active --json`           | 当前 schema pack |
| `gbrain onboard --check [--explain]`    | 升级建议 / 干跑      |
| `gbrain eval *`                         | 检索评测（开发）       |




### 9.8 发现、记忆、发散与推送


| 指令                                                                                | 作用                          |
| --------------------------------------------------------------------------------- | --------------------------- |
| `gbrain salience [--days N]`                                                      | 「最近什么最热/最显著」（v0.29）         |
| `gbrain anomalies [--since D]`                                                    | 按 tag/type 分组的统计异常          |
| `gbrain whoknows <topic> [--explain]`                                             | 「谁懂 X」专家路由                  |
| `gbrain transcripts recent [--days N]`                                            | 最近原始 transcript（local-only） |
| `gbrain recall <entity>` / `recall --today` / `forget <id>`                       | 热记忆事实 读/今日/过期               |
| `gbrain brainstorm <q>` / `lsd <q>`                                               | 双联想 / 反向 judge 点子生成         |
| `gbrain dream [--dry-run] [--json]`                                               | 隔夜维护周期（一次性）                 |
| `gbrain enrich --thin`                                                            | 用 brain 已知信息充实 stub 页       |
| `gbrain watch` / `volunteer-context`                                              | Push-based 上下文（见 §7.6）      |
| `gbrain find-conflicts` / `compile-truth <slugs>` / `adopt-compiled-truth <slug>` | 冲突发现 → 真理沉淀                 |
| `gbrain day <date>` / `since` / `last-seen <entity>` / `ontology <entity>`        | 生活编年 / 本体查询                 |


---



## 10. 端到端最佳实践（标准工作流）

面向本机 **PGLite + Ollama(qwen3-embedding 1024) + DeepSeek V4** 个人栈的一条采集→落盘→检索→运维闭环。贯穿原则:**先绑定落盘,一切写操作前停** `serve`**,PGLite 的 job 一律** `--follow`。

### 10.0 一次性地基（只做一次）

```powershell
gbrain init --pglite --embedding-model ollama:qwen3-embedding:4b --embedding-dimensions 1024
gbrain import D:\MyBrain                          # ★ 立刻绑定落盘根,写 sync.repo_path
gbrain config set search.mode balanced           # 日常;省资源用 conservative
gbrain config set models.tier.reasoning deepseek:deepseek-v4-pro
gbrain config set models.tier.utility   deepseek:deepseek-v4-flash
```

不绑定 `import` 目录,内容只在 DB 里、资源管理器看不到 `.md`(见 §2.6)。这是"能否用 Git/Obsidian 管"的前提。

### 10.1 采集（Capture）— 按来源选入口

原始输入**先进** `inbox/`**,采集阶段不纠结分类**(分类交给 §10.3 的 enrichment)。


| 场景              | 命令                                       |
| --------------- | ---------------------------------------- |
| 一句话想法 / 剪贴内容    | `gbrain capture "…"`                     |
| 现成 `.md` / 导出文件 | `gbrain capture --file D:\x.md`          |
| 管道 / 脚本产物       | `… | gbrain capture --stdin`             |
| 一批已有笔记          | `gbrain import D:\notes`                 |
| 快捷方式丢文件         | 丢进 `%USERPROFILE%\.gbrain\inbox\`(文件夹监听) |




### 10.2 入库落盘（Sync + Embed）— 每次采集后的收尾

```powershell
# sync 要求目标目录是 Git 仓库（要有 .git）。
#先把 MyBrain 做成 Git 仓库，再带 --repo 显式指定路径：
cd ..\MyBrain
git init
git add .
git commit -m "initial notes"
cd ..\gbrain
gbrain sync --repo ..\MyBrain
# gbrain sync                          # 磁盘 ↔ DB 双向增量
gbrain embed --stale                 # 只补 signature 漂移页,不重嵌全库(幂等)
gbrain doctor --scope=brain --fast   # ~10 秒确认没坏
```

> **写操作前必停** `serve`:PGLite 单进程锁,`serve --http` 运行时另开终端 `sync`/`import` 会连接超时。



### 10.3 结构化与充实（周期性）

```powershell
# Inbox 条目 → 结构化(PGLite 必须 --follow)
gbrain jobs submit inbox_enrich --params '{"slug":"inbox/2026-07-15-xxxxx"}' --follow
# 隔夜维护:lint / 合成 / 模式发现,一次跑完(比常驻 autopilot 更适合本机)
gbrain dream --json                  # 先 --dry-run 预览
# stub 页(person/company)→ 有引用的实体页
gbrain enrich --thin --types person,company --limit 50
```

`dream` 是这套栈的"变聪明"步骤,建议每周一次或积累一批新内容后跑。

### 10.4 日常检索（Retrieval）— 问题类型决定命令


| 你想问的           | 用这个(别用 `search`)                          |
| -------------- | ----------------------------------------- |
| 找具体内容/事实       | `gbrain query "…"`                        |
| 要有理有据的答案       | `gbrain think "…" --json`(合成 + 证据缺口 gaps) |
| "最近在忙什么/什么最热"  | `gbrain salience --days 14`               |
| "最近什么反常"       | `gbrain anomalies`                        |
| "谁懂 X / 该找谁"   | `gbrain whoknows "<topic>" --explain`     |
| "上次说过什么/今天记了啥" | `gbrain recall --today`                   |
| 想发散点子          | `gbrain brainstorm "<q>"`                 |


**开放式"当前状态"问题走** `salience`**/**`anomalies`**,不要用语义 search**——它们无需检索词即可浮出反常与热点。

### 10.5 运维节奏（Cadence）

**每次开工:** `ollama list` → `gbrain doctor --scope=brain --fast`
**每天收尾(三板斧):** `gbrain sync` → `gbrain embed --stale` → `gbrain status`
**每周(或大批新内容后):**

```powershell
gbrain dream --json
gbrain advisor                       # "接下来该做什么"排序清单
gbrain doctor --scope=brain          # 全量(非 --fast)
Copy-Item -Recurse "$env:USERPROFILE\.gbrain\brain.pglite" `
  "$env:USERPROFILE\.gbrain\brain.pglite.backup-$(Get-Date -Format yyyyMMdd)"
```



### 10.6 必记坑（实测)

- **停** `serve` **再写**:`serve`/`watch` 整段占用 PGLite 连接,与写操作互斥。
- **PGLite 的 job 一律** `--follow`:本机无常驻 worker,否则 job 不被消化。
- **恢复软删是** `gbrain restore <slug>`(不是 `pages restore`);软删有 72h 窗口。
- **换 embedding 模型/维度不能热改**:必须 `gbrain reinit-pglite …`(破坏性,自动 `.bak`,见 §六 / §5.5)。
- **写** `takes.`* **/** `agent.use_gateway_loop` **/** `pace.`* **要加** `--force`(不在配置白名单,见 §2.3)。
- `embed --stale` **≠** `--all`:日常只补漂移页;换模型后才 reindex 全库。

**一句话闭环:** `capture/import` → `sync` + `embed --stale` →(周期)`inbox_enrich --follow` / `dream` → 日常 `query`/`think` + `salience`/`whoknows` →(每周)`advisor` + 备份。

---



## 相关文档索引


| 文档                                                   | 主题                        |
| ---------------------------------------------------- | ------------------------- |
| `docs/INSTALL.md`                                    | 安装三路径                     |
| `admin/docs/INBOX_API.zh.md`                         | Inbox MCP 契约与 frontmatter |
| `docs/ENGINES.md`                                    | PGLite / Postgres 引擎      |
| `docs/integrations/embedding-providers.md`           | Embedding 提供商             |
| `docs/embedding-migrations.md`                       | 换模型/维度                    |
| `docs/operations/spend-controls.md`                  | 花费门                       |
| `docs/operations/headless-install.md`                | Docker/CI                 |
| `docs/operations/OPS_CHECKLIST.windows-ollama.zh.md` | Windows + Ollama 个人清单     |
| `docs/architecture/type-taxonomy.md`                 | Schema Pack / unify-types |
| `docs/ai-providers/llama-server-reranker.md`         | 本地 reranker               |
| `docs/guides/search-modes.md`                        | 搜索模式与 reranker bundle     |
| `docs/mcp/DEPLOY.md`                                 | HTTP MCP 部署               |
| `docs/TESTING.md`                                    | 测试与 CI                    |
| `docs/RELEASING.md`                                  | 发布流程                      |


