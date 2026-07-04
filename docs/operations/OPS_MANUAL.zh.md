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
| `expansion_model` | 查询扩展模型 | 如 `anthropic:claude-haiku-4-5` |
| `chat_model` | 默认对话模型 | 如 `anthropic:claude-sonnet-4-6` |
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

**模型分层（`models.*`）：**

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

**场景 A：本机 Ollama + 省资源搜索**

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

**场景 B：Supabase 团队 Brain + 远程 MCP**

```json
{
  "engine": "postgres",
  "database_url": "postgresql://...",
  "embedding_model": "openai:text-embedding-3-large",
  "embedding_dimensions": 1536,
  "mcp": { "publish_skills": true, "publish_advisor": false }
}
```

**场景 C：Thin Client（仅远程）**

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
| `docs/mcp/DEPLOY.md` | HTTP MCP 部署 |
| `docs/TESTING.md` | 测试与 CI |
| `docs/RELEASING.md` | 发布流程 |
