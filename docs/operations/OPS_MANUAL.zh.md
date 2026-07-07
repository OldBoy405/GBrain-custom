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

---

## 1. 环境搭建与运行

### 1.1 前置要求

| 组件 | 要求 |
|------|------|
| 运行时 | **Bun**（项目标准运行时） |
| 本地默认引擎 | **PGLite**（嵌入式 Postgres WASM，零配置） |
| 生产/大规模 | **Postgres + pgvector**（Supabase 或自托管） |
| 本地 Embedding（可选） | **Ollama**（如 `qwen3-embedding:4b`） |
| 远程 MCP | **ngrok** 或公网主机（HTTP + OAuth） |

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

**常用环境变量（运行时覆盖 `config.json`）：**

| 变量 | 作用 |
|------|------|
| `GBRAIN_HOME` | 配置/数据父目录（实际路径为 `$GBRAIN_HOME/.gbrain`） |
| `DATABASE_URL` / `GBRAIN_DATABASE_URL` | Postgres 连接串（设置后强制 `engine=postgres`） |
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `ZEROENTROPY_API_KEY` | ZeroEntropy |
| `VOYAGE_API_KEY` | Voyage |
| `OLLAMA_BASE_URL` | 默认 `http://localhost:11434/v1` |
| `DEEPSEEK_API_KEY` | DeepSeek Chat / Expansion（可被 config 覆盖，见下） |
| `DEEPSEEK_BASE_URL` | DeepSeek API 根地址（如 `https://api.deepseek.com` 或 `.../v1`） |
| `GBRAIN_EMBEDDING_MODEL` | 覆盖 embedding 模型 |
| `GBRAIN_EMBEDDING_DIMENSIONS` | 覆盖向量维度 |
| `GBRAIN_RETRIEVAL_REFLEX` | `false`/`0` 关闭检索反射 |
| `GBRAIN_INIT_SKIP_EMBED_CHECK` | `1` 跳过 init 时 embed 探测 |

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

| 模式 | 命令 | 数据库 | 适用场景 |
|------|------|--------|----------|
| **PGLite 嵌入** | `gbrain init --pglite` | `~/.gbrain/brain.pglite` | 个人本机、<1000 文件、零运维 |
| **Postgres 外部** | `gbrain init --supabase` / `--url` | 远程 Postgres | 多用户、大库、HTTP MCP、Minion 常驻 |
| **Thin Client** | `gbrain init --mcp-only` | 无本地库 | 只连远程 `gbrain serve --http` |
| **MCP stdio** | `gbrain serve` | 沿用已配置引擎 | Claude Code / Cursor 本地子进程 |
| **MCP HTTP** | `gbrain serve --http` | 建议 Postgres | ChatGPT、Perplexity、远程团队 |

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

| 平面 | 存储位置 | 修改方式 | 典型用途 |
|------|----------|----------|----------|
| **文件平面** | `~/.gbrain/config.json` | 直接编辑 / `gbrain init` | 引擎、DB 路径、embedding 模型/维度、API Key |
| **数据库平面** | DB `config` 表 | `gbrain config set <key> <value>` | 搜索模式、spend、dream、autopilot 等运行时旋钮 |

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

| 字段 | 含义 | 默认/典型值 |
|------|------|-------------|
| `engine` | `pglite` \| `postgres` | init 时选定 |
| `database_path` | PGLite 目录 | `~/.gbrain/brain.pglite` |
| `database_url` | Postgres 连接串 | Supabase 初始化写入 |
| `embedding_model` | `provider:model` | 如 `ollama:qwen3-embedding:4b` |
| `embedding_dimensions` | 向量维度 | 须与模型/schema 一致 |
| `embedding_disabled` | 延迟 embedding 配置 | `gbrain init --no-embedding` |
| `deepseek_api_key` | DeepSeek API Key（文件平面） | 注入 `DEEPSEEK_API_KEY`；也可用环境变量 |
| `openai_api_key` / `anthropic_api_key` / `zeroentropy_api_key` | 各云厂商 Key | 同上，文件平面 → gateway |
| `expansion_model` | 查询扩展模型 | 如 `deepseek:deepseek-v4-flash`（tokenmax 模式） |
| `chat_model` | 默认对话模型 | 如 `deepseek:deepseek-v4-pro` |
| `chat_fallback_chain` | 静默降级链 | `provider:model` 数组 |
| `provider_base_urls` | 各 provider 自定义 base URL | 如 Ollama 代理地址 |
| `schema_pack` | 类型/抽取规则包 | `gbrain-base-v2` |
| `retrieval_reflex` | 每轮注入实体指针 | 默认 **开启**（缺省=true） |
| `retrieval_reflex_max_pointers` | 每轮最大指针数 | 默认 3 |
| `remote_mcp` | Thin Client 远程 MCP 配置 | `issuer_url`、`mcp_url`、`oauth_client_id` |
| `mcp.publish_skills` | 远程 MCP 是否发布技能目录 | 新装默认 true |
| `mcp.publish_advisor` | 远程 MCP 是否暴露 advisor | 默认 false |
| `self_upgrade.mode` | `notify` \| `auto` \| `off` | 自升级策略 |

`retrieval_reflex` 等项为**文件平面**：须编辑 `config.json` 或设 `GBRAIN_RETRIEVAL_REFLEX`，`gbrain config set` 写入 DB 平面**无效**。

### 2.3 数据库平面常用键（`gbrain config set`）

完整列表见 `src/core/config.ts` 的 `KNOWN_CONFIG_KEYS` 与 `KNOWN_CONFIG_KEY_PREFIXES`。

**搜索模式（`search.*`）：** 详见 `docs/guides/search-modes.md`

| 键 | 含义 | conservative | balanced | tokenmax |
|----|------|--------------|----------|----------|
| `search.mode` | 模式名 | ✓ | ✓（默认） | ✓ |
| `search.token_budget` | 返回 token 上限 | 4000 | 12000 | off |
| `search.expansion` | LLM 多查询扩展 | off | off | on |
| `search.relationalRetrieval` | 关系图召回 | off | on | on |
| `search.limit_default` | 默认结果数 | 10 | 25 | 50 |

**花费控制：** 详见 `docs/operations/spend-controls.md`

| 键 | 默认 | 说明 |
|----|------|------|
| `spend.posture` | `gated` | `tokenmax` = 所有花费门仅提示不阻断 |
| `sync.cost_gate_min_usd` | `0.50` | sync 内联 embed 花费门槛 |
| `embed.backfill_max_usd_per_source_24h` | `25` | 每 source 24h 回填上限 |
| `embed.backfill_max_usd` | `10` | 单次 backfill 任务上限 |

**模型分层（`models.*`）：** 四档 Tier 与解析优先级见 [§8](#8-模型-tier可选升级与检索精排)。仅改 `config.json` 的 `chat_model` / `expansion_model` **不足以**覆盖运行时路由，必须在 DB 平面写入 `models.tier.*`（或 `models.default` / 各任务键）。

```bash
gbrain config set models.tier.subagent anthropic:claude-sonnet-4-6
gbrain config set models.tier.utility anthropic:claude-haiku-4-5
```

**Autopilot（`autopilot.*`）：**

| 键 | 默认 | 说明 |
|----|------|------|
| `autopilot.nightly_quality_probe.enabled` | false | 夜间质量探测（耗 API） |
| `autopilot.auto_drain.enabled` | true | 自动消化 extract_atoms 积压 |

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

### 3.2 选项选择依据

| 决策 | 建议 |
|------|------|
| PGLite vs Postgres | <1000 md 文件 → PGLite；团队/HTTP MCP/大库 → Postgres |
| 搜索模式 | 成本敏感 → `conservative`；日常 → `balanced`；深度研究 → `tokenmax` |
| Embedding 维度 | ≤2000 可走 HNSW；Ollama Matryoshka 可截断（如 Qwen3→1024） |
| expansion 模型 | 默认 Haiku 即可；tokenmax 模式才强依赖 |
| `spend.posture` | 个人本机 Ollama 可 `tokenmax`；云 API 保持 `gated` |

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

| 命令 | 用途 |
|------|------|
| `gbrain init` | 初始化 brain |
| `gbrain reinit-pglite` | PGLite 换模型/维度（破坏性，会 `.bak`） |
| `gbrain upgrade` | 自升级 + schema 迁移 |
| `gbrain apply-migrations --yes` | 仅跑迁移 |
| `gbrain migrate --to supabase\|pglite` | 引擎迁移 |
| `gbrain doctor` | 健康诊断 |
| `gbrain config show/set/unset` | 配置管理 |

### 4.2 内容导入与同步

| 命令 | 用途 | 典型场景 |
|------|------|----------|
| `gbrain import <dir>` | 批量导入 markdown | 首次灌库 |
| `gbrain sync` | Git 仓库增量同步 | 笔记仓库持续更新 |
| `gbrain sync --watch` | 监听变更 | 开发时实时同步 |
| `gbrain sync --all` | 多 source 同步 | 多仓库 brain |
| `gbrain export` | 导出 | 备份/迁移 |
| `gbrain files` | 文件平面操作 | 附件管理 |

**推荐顺序：** `init` → `import`（或 `sync`）→ `embed --stale`（若需补 embed）→ `search`/`query`

### 4.3 检索与查询

| 命令 | 用途 |
|------|------|
| `gbrain search <query>` | 混合检索 |
| `gbrain query` | 同 search（MCP 对齐名） |
| `gbrain graph <slug> --depth N` | 图遍历 |
| `gbrain recall` / `gbrain forget` | 热记忆 facts 管理 |

```bash
gbrain search "项目架构决策" --limit 10
gbrain search modes
gbrain search tune --apply
```

### 4.4 Embedding 与索引

| 命令 | 用途 |
|------|------|
| `gbrain embed --stale` | 重嵌 signature 漂移的页 |
| `gbrain embed --stale --pace=balanced` | 带 DB 节奏控制 |
| `gbrain reindex` | 重建索引 |
| `gbrain reindex-code` | 代码边索引 |
| `gbrain retrieval-upgrade --to <model> --reindex` | 换模型并重建 |

### 4.5 AI Provider

```bash
gbrain providers list
gbrain providers test --model ollama:qwen3-embedding:4b
gbrain models
gbrain models doctor
```

### 4.6 运维与质量

| 命令 | 用途 |
|------|------|
| `gbrain integrity` | 数据完整性 |
| `gbrain lint` | 内容/链接检查 |
| `gbrain orphans` | 孤儿页 |
| `gbrain repair-jsonb` | JSONB 修复 |
| `gbrain smoke-test` | 8 项安装后自检 |
| `gbrain eval *` | 检索评测 |
| `gbrain soul-audit` | Agent 身份模板 |

### 4.7 Source / Brain 多轴

```bash
gbrain sources list
gbrain sources add <path>
gbrain mounts add <brain-id>
# 路由：--brain / GBRAIN_BRAIN_ID，--source / GBRAIN_SOURCE
```

详见 `docs/architecture/brains-and-sources.md`。

### 4.8 常用全局参数

| 标志 | 作用 |
|------|------|
| `--json` | JSON 输出 |
| `--quiet` | 减少 stderr |
| `--brain <id>` | 指定 brain |
| `--source <id>` | 指定 source |
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

### 5.2 备份

| 引擎 | 备份方式 |
|------|----------|
| PGLite | 复制整个 `brain.pglite/` 目录；`reinit-pglite` 自动留 `brain.pglite.bak` |
| Postgres | `pg_dump` / Supabase 控制台快照 |
| 配置 | 复制 `~/.gbrain/config.json` |

```powershell
Copy-Item -Recurse $env:USERPROFILE\.gbrain\brain.pglite `
  "$env:USERPROFILE\.gbrain\brain.pglite.backup-$(Get-Date -Format yyyyMMdd)"
```

### 5.3 故障排查

| 现象 | 排查命令 |
|------|----------|
| 任意异常 | `gbrain doctor --json` |
| Embedding 失败 | `gbrain providers test --model <model>` |
| 维度不匹配 | `gbrain doctor`（`embedding_width_consistency`） |
| Schema 过旧 | `gbrain apply-migrations --yes` |
| Sync 卡住 | 查 `GBRAIN_SYNC_STALL_ABORT_SECONDS`；`doctor` 看 sync_failures |
| 队列积压 | `gbrain jobs stats` |
| MCP 连不上 | `curl localhost:3131/health` |

```bash
gbrain doctor --fix   # 自动修复（skills 目录只读时会拒绝）
```

### 5.4 性能调优

```bash
gbrain config set search.mode balanced
gbrain search modes --reset
gbrain embed --stale --pace=balanced
```

**Sync / Pace 环境变量：**

| 变量 | 默认 | 说明 |
|------|------|------|
| `GBRAIN_SYNC_CHECKPOINT_EVERY` | 1000 | 每 N 文件写检查点 |
| `GBRAIN_SYNC_YIELD_EVERY` | 64 | 事件循环让出 |
| `GBRAIN_SYNC_STALL_ABORT_SECONDS` | 900 | 无进展超时 |
| `GBRAIN_PACE_MODE` | off | gentle/balanced/aggressive |

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

| 端点 | 用途 |
|------|------|
| `/mcp` | MCP 工具调用 |
| `/health` | 存活探针 |
| `/admin` | 管理 SPA |
| `/admin/events` | SSE 活动流 |
| `/.well-known/oauth-authorization-server` | OAuth 发现 |

**常用标志：**

| 标志 | 说明 |
|------|------|
| `--port N` | 监听端口（默认 3131） |
| `--bind 0.0.0.0` | 接受非本机连接（ngrok 必需） |
| `--public-url URL` | OAuth issuer 公网地址 |
| `--enable-dcr` | 动态客户端注册 |
| `--log-full-params` | 完整请求参数（勿用于多租户） |

### 6.3 OAuth 与认证

```bash
gbrain auth register-client perplexity --grant-types client_credentials --scopes "read write"
gbrain auth create "claude-desktop"    # 遗留 Bearer（Postgres）
gbrain connect https://host/mcp --token gbrain_xxx --agent codex
```

| Scope | 允许 |
|-------|------|
| `read` | search、get_page、list_pages、图遍历 |
| `write` | put_page、delete_page、add_link |
| `admin` | 客户端管理、token 撤销 |

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
gbrain autopilot status
```

### 7.2 Admin 界面

- 访问：`gbrain serve --http` 后打开 `/admin`
- 功能：OAuth 客户端、请求日志、SSE、配置导出
- 源码：`admin/`

### 7.3 通知系统（Telegram / Slack / Discord）

**GBrain 核心没有统一的「通知频道」配置。** 通知通过 **技能 + Agent 平台 + Webhook** 实现：

| 能力 | 位置 |
|------|------|
| Cron 定时任务 | `skills/cron-scheduler` |
| Webhook 入站 | `skills/webhook-transforms` |
| Telegram 告警示例 | `recipes/restart-sweep.md` |

### 7.4 语音服务（Twilio / WebRTC）

推荐：`recipes/agent-voice`（`twilio-voice-brain` 已废弃）。

```bash
gbrain integrations install agent-voice --target <host-repo>
```

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI Realtime（必需） |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | 电话接入（可选） |
| `NGROK_AUTHTOKEN` | 公网 webhook |

### 7.5 其他集成

```bash
gbrain skillpack scaffold --all
gbrain skillpack-check
gbrain features
gbrain integrations install retrieval-reflex --target <host-repo>
```

---

## 8. 模型 Tier、可选升级与检索精排

本节汇总 **DeepSeek + Ollama 本机栈** 运维中易踩坑的配置：Tier 模型注入优先级、Subagent 网关循环、Schema Pack 升级、Takes 冷存储、Reranker 精排。代码入口：`src/core/model-config.ts`（`resolveModel`）、`src/core/ai/gateway.ts`（`reconfigureGatewayWithEngine`）、`src/core/search/mode.ts`（reranker bundle）。

### 8.1 四档 Tier 与任务映射

GBrain 用四档 **Tier** 给内部 LLM 调用分组；未单独配置的任务键会 **继承对应 Tier** 的解析结果。

| Tier | 典型用途（Anthropic 默认） | 内部任务键（节选） |
|------|---------------------------|-------------------|
| **utility** | 快、便宜（Haiku 档） | `models.expansion`（查询扩展）、`models.dream.synthesize_verdict`（Dream 裁决）、矛盾探测 judge |
| **reasoning** | 日常主力（Sonnet 档） | `models.chat`（默认 chat）、`models.dream.synthesize` / `models.dream.patterns`、facts 抽取 |
| **deep** | 贵、深推理（Opus 档） | `models.think`、`models.auto_think`、SkillOpt optimizer |
| **subagent** | 多轮 tool 循环 | `models.subagent`（`gbrain agent run` / minion subagent） |

查看当前解析结果：

```bash
gbrain models              # 人类可读路由表
gbrain models --json       # 机器可读（tiers + per_task）
```

### 8.2 DeepSeek + Ollama 推荐配对

**本机会话验证过的栈：** Embedding 走 Ollama，Chat / Expansion / Dream / Agent 走 DeepSeek V4。

| 角色 | 推荐模型 | 配置位置 |
|------|----------|----------|
| Embedding | `ollama:qwen3-embedding:4b`（1024 维） | 文件平面 `embedding_model` / `embedding_dimensions` |
| Chat / 深推理 / Dream / Think | `deepseek:deepseek-v4-pro` | DB `models.tier.reasoning` + `models.tier.deep` |
| 查询扩展 / utility | `deepseek:deepseek-v4-flash` | DB `models.tier.utility` |
| Subagent | `deepseek:deepseek-v4-pro` | DB `models.tier.subagent` + **§8.4** 网关循环 |

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

**`resolveModel()` 优先级**（高 → 低；同 `src/core/model-config.ts`）：

| 顺序 | 来源 | 说明 |
|------|------|------|
| 1 | CLI `--model` | 单次命令覆盖 |
| 2 | 任务专用键 | 如 `models.chat`、`models.expansion`、`models.dream.synthesize` |
| 3 | 已废弃旧键 | 带 stderr 警告 |
| 4 | **`models.default`** | 全局锤子；**优先于** `models.tier.*` |
| 5 | **`models.tier.<tier>`** | 四档 Tier 覆盖 |
| 6 | `GBRAIN_MODEL` 环境变量 | |
| 7 | **`TIER_DEFAULTS`** | 内置 Anthropic 默认（Haiku / Sonnet / Opus） |
| 8 | 调用方 fallback | `reconfigureGatewayWithEngine` 传入的 `config.json` 值 |

**关键陷阱：** 当调用方指定了 `tier`（gateway re-stamp 始终指定），且 DB 里 **没有** `models.default`、`models.tier.*`、任务键时，**第 7 步 `TIER_DEFAULTS`（Anthropic）会先于第 8 步 `config.json` fallback 生效**。因此只改 `config.json` 的 `chat_model` / `expansion_model`，运行时仍可能显示 `claude-*`。

**Dream / autopilot / agent 与 Tier 的关系：**

| 能力 | 模型来源 | 备注 |
|------|----------|------|
| `gbrain search` expansion | `models.expansion` → **utility** tier | `tokenmax` 才强依赖 |
| `gateway.chat()` / 默认对话 | `models.chat` → **reasoning** tier | |
| `gbrain dream` synthesize / patterns | `models.dream.*` → reasoning / utility | 未设则继承 tier |
| `gbrain think` | **deep** tier | |
| `gbrain agent run` / subagent job | **subagent** tier | 非 Anthropic 须 §8.4 |
| autopilot 夜间质量探测 | 各 phase 自有键 + tier | 默认关闭 `autopilot.nightly_quality_probe.enabled` |

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

**背景：** Schema Pack 定义页的 **类型 taxonomy**（`pages.type`）、抽取规则、链接类型等。v0.42+ 新装默认 `gbrain-base-v2`（15 种规范类型）；仍在 **`gbrain-base@1.x`** 的旧 brain 可通过 `unify-types` 任务一次性迁移。

**现象：** `gbrain doctor` 或 `gbrain onboard --check` 出现 `pack_upgrade_available` WARN——当前 pack 为 `gbrain-base@1.x`，后继包 `gbrain-base-v2` 可用。

| 项 | 说明 |
|----|------|
| 是否必须 | **否**。空库或页数很少时可忽略；类型混乱、搜索 `--type` 不准、enrichment 漏页时再升级 |
| 成本 | 纯 SQL 重类型 + 别名/链接表写入，**无 LLM 花费**；大库（~18 万页）约 **10 分钟** |
| 自动化 | **不会**被 autopilot 自动执行（PROTECTED + manual_only）；须人工提交 job |

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

**第 4 步：提交并执行 `unify-types`**

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
3. 长尾未知类型 → **`note`**
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

| 场景 | 操作 |
|------|------|
| 仅想换回旧 pack 声明 | `gbrain schema use gbrain-base` 或 `gbrain schema downgrade --to gbrain-base` |
| 恢复被 soft-delete 的页 | 72h 内：`gbrain pages restore <slug>` |
| 批量恢复 retype 前的 type | SQL：`UPDATE pages SET type = frontmatter->>'legacy_type' WHERE frontmatter ? 'legacy_type'`（Postgres；PGLite 同理） |
| 整库灾难 | 恢复第 3 步的 `brain.pglite` 目录备份 |

`unify-types` **不会**改写正文 wikilink 文本；旧 slug 通过 `slug_aliases` 解析，一般无需手工改 markdown。

#### 相关命令速查

| 命令 | 用途 |
|------|------|
| `gbrain schema list` | 列出 bundled + 已安装 pack |
| `gbrain schema show` | 打印当前 active pack 内容 |
| `gbrain schema active --json` | 解析链路与 pack identity |
| `gbrain onboard --check [--explain]` | 发现升级建议 + 干跑 |
| `gbrain jobs submit unify-types --params '...' [--follow]` | 执行迁移 |

详见 `docs/architecture/type-taxonomy.md`、`docs/architecture/pack-upgrade-mechanism.md`。

### 8.6 Takes 冷存储（可选）

Takes 是页内可评分 **主张（claims）** 的冷存储队列；**默认关闭**，空库 `takes_count: 0` 为正常 WARN。

| 键 | 默认 | 作用 |
|----|------|------|
| `takes.bootstrap_enabled` | `false` | **第一重门**：必须为 `true` 才允许任何 bootstrap / 从页抽取 |
| `takes.autopilot_allowed` | `false` | **第二重门**：autopilot 自动提交 takes-bootstrap remediation |

**手动开启抽取：**

```bash
gbrain config set takes.bootstrap_enabled true
gbrain takes extract --from-pages --yes    # 仍须 --yes 确认
```

- 允许页类型：`concept`、`atom`、`lore`、`briefing`、`writing`、`originals`。
- 抽取模型继承 **reasoning** tier（`facts.extraction_model` 未设时）。
- `cycle.grade_takes.write_gstack_learnings` 等与 gstack 耦合的写入默认关闭，外部用户一般保持 `false`。

**何时需要：** 要用 Takes 校准、Dream pattern 跨 take 主题、contradiction 类 eval 时再开；纯检索 + 笔记库可不开。

### 8.7 Reranker 精排配置

Cross-encoder reranker 插在 hybrid 流水线 **去重之后、token budget 之前**；失败 **fail-open**（保持原 RRF 顺序，写 audit JSONL）。

**按搜索模式的 bundle 默认**（`src/core/search/mode.ts`）：

| `search.mode` | `search.reranker.enabled` | 默认模型 |
|---------------|---------------------------|----------|
| `conservative` | **off** | — |
| `balanced` | **on** | `zeroentropyai:zerank-2` |
| `tokenmax` | **on** | `zeroentropyai:zerank-2` |

**常用 DB 键：**

| 键 | 说明 |
|----|------|
| `search.reranker.enabled` | 总开关；关闭用 `false`，**不要**设 `reranker_model none` |
| `search.reranker.model` | 如 `zeroentropyai:zerank-2` |
| `search.reranker.top_n_in` / `top_n_out` | 送入 rerank 的候选数 / 截断（bundle 通常与 `search.limit_default` 对齐） |
| `search.reranker.timeout_ms` | 超时；本地 CPU reranker 可适当加大 |

**本机 Ollama 栈建议：**

| 方案 | 配置 | 说明 |
|------|------|------|
| **关闭精排**（省 Key / 纯本地） | `gbrain config set search.reranker.enabled false` | `conservative` 等价体验；balanced/tokenmax 需显式关 |
| **ZeroEntropy 云** | 文件或 env 配 `ZEROENTROPY_API_KEY` + 保持 bundle 默认 | 未配 Key 时 rerank fail-open，doctor 里 ZeroEntropy auth 失败可忽略 |
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

## 相关文档索引

| 文档 | 主题 |
|------|------|
| `docs/INSTALL.md` | 安装三路径 |
| `docs/ENGINES.md` | PGLite / Postgres 引擎 |
| `docs/integrations/embedding-providers.md` | Embedding 提供商 |
| `docs/embedding-migrations.md` | 换模型/维度 |
| `docs/operations/spend-controls.md` | 花费门 |
| `docs/operations/headless-install.md` | Docker/CI |
| `docs/operations/OPS_CHECKLIST.windows-ollama.zh.md` | Windows + Ollama 个人清单 |
| `docs/architecture/type-taxonomy.md` | Schema Pack / unify-types |
| `docs/ai-providers/llama-server-reranker.md` | 本地 reranker |
| `docs/guides/search-modes.md` | 搜索模式与 reranker bundle |
| `docs/mcp/DEPLOY.md` | HTTP MCP 部署 |
| `docs/TESTING.md` | 测试与 CI |
| `docs/RELEASING.md` | 发布流程 |
