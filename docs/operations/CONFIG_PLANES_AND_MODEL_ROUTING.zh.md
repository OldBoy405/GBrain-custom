# GBrain 配置平面与模型路由（本机）

> 整理日期：2026-07-16  
> 适用：Windows + PGLite + Ollama embedding + DeepSeek chat  
> 相关：`[OPS_MANUAL.zh.md](OPS_MANUAL.zh.md)` §2 / §8 · `[OPS_CHECKLIST.windows-ollama.zh.md](OPS_CHECKLIST.windows-ollama.zh.md)`

**运行时优先级（高 → 低）：**

```
环境变量 > ~/.gbrain/config.json > PGLite config 表 > 代码默认值
```

密钥一律脱敏；不要把 API Key 提交进 git。  
**本机配置现状与建议以 §1.7 全量表为准**（含「当前是否已配」）。

---

## 1. 配置平面

### 1.1 四层怎么看


| 平面    | 位置                                                  | 怎么看                                          | 谁会改它                                                          |
| ----- | --------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| 环境变量  | 进程 `process.env`                                    | `Get-ChildItem Env:GBRAIN_*, Env:OLLAMA_*` 等 | 系统/用户环境变量、当前终端 `$env:`；Bun 也可能把 cwd `.env` 合进进程（**不是**正式配置平面） |
| 文件平面  | `%USERPROFILE%\.gbrain\config.json`                 | `gbrain config show`                         | `gbrain init`、手改 JSON                                         |
| DB 平面 | PGLite `config` 表                                   | `gbrain config get <key>`                    | `gbrain config set/unset`                                     |
| 代码默认  | `model-config.ts` / `search/mode.ts` / `gateway.ts` | 读源码                                          | 发版才变                                                          |


旁路：`~\.gbrain\preferences.json`（如 `minion_mode`）不算主配置平面。

### 1.2 查 DB 全量键（PowerShell）

不要用多行 `bun -e`（易截断）。用脚本，且连接参数必须是 `database_path`**（下划线）**：

```ts
// list-db-config.ts — 仓库根: bun run list-db-config.ts
import { join } from 'path';
import { loadConfig } from './src/core/config.ts';
import { PGLiteEngine } from './src/core/pglite-engine.ts';

const dbPath =
  loadConfig()?.database_path ??
  join(process.env.USERPROFILE ?? '', '.gbrain', 'brain.pglite');

const e = new PGLiteEngine();
await e.connect({ database_path: dbPath }); // 不是 databasePath

const rows = await e.executeRaw<{ key: string; value: string }>(
  `SELECT key, value FROM config ORDER BY key`,
);
for (const r of rows) {
  const v = /key|secret|token|password/i.test(r.key) ? '***' : r.value;
  console.log(`${r.key} = ${v}`);
}
await e.disconnect();
```

`relation "config" does not exist` → 多半写了 `databasePath`，连到了空内存库。

### 1.3 `reinit-pglite` 会清什么


| 保留                   | 清空                                                     |
| -------------------- | ------------------------------------------------------ |
| `config.json`、系统 Env | 全部页面 / chunks / takes                                  |
|                      | **DB** `config` **表**（`models.tier.`*、`search.mode` 等） |


旧库 → `brain.pglite.bak`（已有 `.bak` 时须先挪走）。清库后按 §1.5 B 重写 DB 旋钮。  
备份请同时带走：`config.json` **+ DB 配置（或整份** `brain.pglite`**）**。

### 1.4 为何不能「只进文件」或「只进 DB」


| 做法                                                 | 行不行                                |
| -------------------------------------------------- | ---------------------------------- |
| 引擎 / embedding / API Key / `chat_model` 种子 → 文件    | 可以                                 |
| `models.tier.*`、`search.mode`、think 路由 **只写 JSON** | **不行**（`resolveModel` 只读 DB）       |
| 引擎路径 / embedding 定宽 / Key / reflex **只写 DB**       | **不行**（连库前读不到；定宽 `config set` 会被拒） |
| 消灭 Env 与代码默认                                       | **不行**                             |


要点：

- 连库前：`engine` / `database_path` / Key / gateway 种子 → **文件或 Env**
- 连库后：`models.tier.*` / `search.*` / dream·takes 门控 → **DB**
- `retrieval_reflex*`、`self_upgrade.*` → **文件或 Env only**（`config set` 无效）
- `gbrain config set` 写入 DB；`config show` **看不到**这些键，要用 `config get`

手册：[§8.3](OPS_MANUAL.zh.md#83-模型解析与-gateway-注入优先级)。

### 1.5 推荐配置方案（DeepSeek + Ollama）

原则：**文件 = 是谁 / 连哪 / Key；DB = 怎么搜 / 哪档模型；Env = Ollama 服务或临时覆盖。**  
勿用仓库 `.env` 当个人 brain 配置中心。逐项现状见 **§1.7**。

#### A. 文件平面模板

```json
{
  "engine": "pglite",
  "database_path": "C:\\Users\\YOU\\.gbrain\\brain.pglite",
  "embedding_model": "ollama:qwen3-embedding:4b",
  "embedding_dimensions": 1024,
  "schema_pack": "gbrain-base-v2",
  "chat_model": "deepseek:deepseek-v4-pro",
  "expansion_model": "deepseek:deepseek-v4-flash",
  "provider_base_urls": {
    "deepseek": "https://api.deepseek.com"
  },
  "deepseek_api_key": "sk-...",
  "mcp": { "publish_skills": true },
  "self_upgrade": { "mode": "notify", "mode_prompted": true }
}
```



#### B. DB 平面一次性写入

```powershell
cd C:\Users\GOBAO\Downloads\AI\gbrain
# 先停 serve

gbrain config set models.tier.utility deepseek:deepseek-v4-flash
gbrain config set models.tier.reasoning deepseek:deepseek-v4-pro
gbrain config set models.tier.deep deepseek:deepseek-v4-pro
gbrain config set models.tier.subagent deepseek:deepseek-v4-pro
gbrain config set agent.use_gateway_loop true
gbrain config set search.mode tokenmax
gbrain config set search.reranker.enabled false
gbrain config set mcp.skills_dir C:\Users\GOBAO\Downloads\AI\gbrain\skills
gbrain config set mcp.publish_skills true
gbrain config set mcp.publish_advisor true

# 可选：落盘 / takes
# gbrain import ..\MyBrain
# gbrain config set takes.bootstrap_enabled true
# gbrain takes extract --from-pages
```



#### C. Env


| 建议放                           | 不必放                                         |
| ----------------------------- | ------------------------------------------- |
| `OLLAMA_*`（Ollama 进程）         | 日常 `DEEPSEEK_API_KEY` / `GBRAIN_*`（已有文件+DB） |
| 临时覆盖、CI、`GBRAIN_DATABASE_URL` | 仓库 `.env` 当长期配置                             |


`OLLAMA_HOST` / `MODELS` / `GPU_LAYER` **勿写入** `config.json`（Ollama 服务读，gbrain 不认）。

### 1.6 为啥 `chat_model` 放文件，`models.tier.*` 放 DB？

两套读路径，不是随意分工：


| 键                                | 何时读                         | 平面     |
| -------------------------------- | --------------------------- | ------ |
| `chat_model` / `expansion_model` | 启动同步 → `configureGateway()` | **文件** |
| `models.tier.*`                  | 连库后 → `resolveModel()`      | **DB** |


```text
loadConfig() → configureGateway()（文件种子）
    → engine.connect()
    → resolveModel() / reconfigureGatewayWithEngine()（读 DB）
```

- JSON 里写 `models.tier.deep` **无效**。  
- 只改文件 `chat_model`、DB 无 tier → Ask/dream 仍可能显示 Opus。  
- 记法：文件 ≈「默认聊什么」；DB tier ≈「任务档位用什么」。



### 1.7 全量配置对照表（本机 · 2026-07-16）

> 状态以当日 `config.json` + PGLite `config` 表 + 进程 Env 实测为准。  
> 「当前是否已配」：✓ 已配 · ✗ 未配 · △ 用代码/包默认（等同未显式配置）。


| 配置项                                        | 不配的影响                                                                                                                                                  | 当前是否已配                   | 建议平面                                  | 本机 DeepSeek 栈建议                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`                                   | 无法判断 PGLite/Postgres                                                                                                                                   | ✓ 文件（及 DB 镜像）            | **文件**                                | 保持 `pglite`（或迁 Postgres 时改）                                                                                                            |
| `database_path`                            | 不知打开哪份 PGLite                                                                                                                                          | ✓ 文件                     | **文件**                                | 保持 `~\.gbrain\brain.pglite`                                                                                                            |
| `database_url` / `GBRAIN_DATABASE_URL`     | 仅 Postgres 需要                                                                                                                                          | ✗                        | **文件或 Env**                           | 继续 PGLite 则**不必配**                                                                                                                     |
| `embedding_model`                          | 无向量 / init 失败                                                                                                                                          | ✓ 文件（及 DB 镜像）            | **文件**                                | 保持 `ollama:qwen3-embedding:4b`                                                                                                         |
| `embedding_dimensions`                     | 维度错则向量不可用                                                                                                                                              | ✓ `1024`                 | **文件**                                | 保持 1024；换维需 `reinit-pglite`                                                                                                            |
| `schema_pack`                              | 回落旧/默认 pack                                                                                                                                            | ✓ `gbrain-base-v2`       | **文件**（DB 可镜像）                        | 保持 v2                                                                                                                                  |
| `deepseek_api_key`                         | DeepSeek chat/expansion 失败                                                                                                                             | ✓ 文件                     | **文件**                                | 必留文件；不必再设 Env                                                                                                                          |
| `provider_base_urls.deepseek`              | 可能打错 API 根地址                                                                                                                                           | ✓ 文件                     | **文件**                                | 保持 `https://api.deepseek.com`                                                                                                          |
| `openai_api_key` / `ANTHROPIC_API_KEY`     | 用对应云厂商时失败                                                                                                                                              | ✗                        | **文件或 Env**                           | DeepSeek 栈**可不配**                                                                                                                      |
| `ZEROENTROPY_API_KEY`                      | reranker 鉴权失败                                                                                                                                          | ✗                        | **Env 或文件**                           | 无 ZE → **不配**，并关 reranker                                                                                                              |
| Gateway `chat_model`                       | 默认 Anthropic Sonnet                                                                                                                                    | ✓ 文件 `deepseek-v4-pro`   | **文件**                                | **必配** pro                                                                                                                             |
| Gateway `expansion_model`                  | 默认 Haiku；tokenmax 扩展异常                                                                                                                                 | ✓ 文件 `deepseek-v4-flash` | **文件**                                | **必配** flash                                                                                                                           |
| `mcp.publish_skills`（文件）                   | MCP 不暴露 skills                                                                                                                                         | ✓ `true`                 | **文件**                                | 保持开（开发 Admin/MCP 时）                                                                                                                    |
| `self_upgrade.mode`                        | 升级提示行为默认                                                                                                                                               | ✓ `notify`               | **文件**                                | 保持即可                                                                                                                                   |
| `retrieval_reflex*`                        | 缺省=开反射                                                                                                                                                 | △ 未写（默认开）                | **文件或 Env**                           | 一般保持默认；勿 `config set`                                                                                                                  |
| `models.tier.utility`                      | 默认 Anthropic Haiku                                                                                                                                     | ✓ DB flash               | **DB**                                | **必配** flash                                                                                                                           |
| `models.tier.reasoning`                    | 默认 Sonnet                                                                                                                                              | ✓ DB pro                 | **DB**                                | **必配** pro                                                                                                                             |
| `models.tier.deep`                         | 默认 Opus；Ask think 走 Opus                                                                                                                               | ✓ DB pro                 | **DB**                                | **必配** pro                                                                                                                             |
| `models.tier.subagent`                     | 默认 Sonnet；dream/agent 易失败                                                                                                                              | ✓ DB pro                 | **DB**                                | **必配** pro                                                                                                                             |
| `models.default`                           | 无全局锤子；靠各 tier                                                                                                                                          | ✗                        | **DB**（可选）                            | DeepSeek 栈**可不配**（四档已够）                                                                                                                |
| `models.think`                             | 回落 `models.tier.deep`                                                                                                                                  | ✗                        | **DB**（可选）                            | **可不配**（已有 deep）                                                                                                                       |
| `models.dream.synthesize` 等任务键             | 回落对应 tier                                                                                                                                              | ✗                        | **DB**（可选）                            | **可不配**                                                                                                                                |
| `models.expansion` / `models.chat`         | re-stamp 时回落 tier/文件 fallback                                                                                                                          | ✗                        | **DB**（可选）                            | **可不配**（文件+tier 已齐）                                                                                                                    |
| `agent.use_gateway_loop`                   | 非 Anthropic 时 subagent 拒跑                                                                                                                              | ✓ DB `true`              | **DB**                                | **必配** `true`                                                                                                                          |
| `search.mode`                              | 默认 `balanced`                                                                                                                                          | ✓ DB `tokenmax`          | **DB**                                | 保持 tokenmax；省钱改 balanced                                                                                                               |
| `search.reranker.enabled`                  | 跟 mode 包：tokenmax 默认开                                                                                                                                  | ✓ DB `false`             | **DB**                                | **保持 false**（无 ZE）                                                                                                                     |
| `search.reranker.model` 等                  | 用包内默认 zerank                                                                                                                                           | △                        | **DB**（可选）                            | 关 reranker 后**不必配**                                                                                                                    |
| `search.cache.*` / `search.token_budget` 等 | 用 mode 包默认                                                                                                                                             | △                        | **DB**（可选）                            | 一般**不手调**                                                                                                                              |
| `takes.bootstrap_enabled`                  | 默认 false → 0 takes 从页面正文里抽出的、可评分「主张 / claims」（冷存储队列），给校准、部分 dream/eval 用，**不是**普通检索必需。键为 `true` 时，才允许：`gbrain takes extract --from-pages`（从页批量抽 takes） | ✗（=关）                    | **DB**                                | 要 takes 再 `true` + extract。开启示例：gbrain config set takes.bootstrap_enabled true --force抽取takesgbrain takes extract --from-pages --yes |
| `sync.repo_path`                           | 无落盘路径；sync 可能失败                                                                                                                                        | ✗                        | **DB**（`import` 写）                    | 有 MyBrain 时再 `import`                                                                                                                  |
| `mcp.skills_dir`                           | skills 自动探测可能失败                                                                                                                                        | ✓ DB                     | **DB**                                | 保持仓库 `skills` 绝对路径                                                                                                                     |
| `mcp.publish_skills`（DB）                   | 与文件叠加；以解析为准                                                                                                                                            | ✓ DB `true`              | **DB 或文件**                            | 已开即可                                                                                                                                   |
| `mcp.publish_advisor`                      | 默认 off；MCP advisor 不可用                                                                                                                                 | ✓ DB `true`              | **DB**                                | 需要 advisor 时保持                                                                                                                         |
| `chunk_strategy`                           | 分块策略默认                                                                                                                                                 | ✓ DB `semantic`          | **DB**                                | 保持即可                                                                                                                                   |
| `version`（schema）                          | 迁移版本号                                                                                                                                                  | ✓ `123`                  | 系统写入                                  | **勿手改**                                                                                                                                |
| `GBRAIN_HOME`                              | 默认 `%USERPROFILE%\.gbrain`                                                                                                                             | ✗                        | **Env**（可选）                           | **不必配**                                                                                                                                |
| `GBRAIN_CHAT_MODEL` 等                      | 临时盖过文件模型                                                                                                                                               | ✗                        | **Env**（临时）                           | **不必配**                                                                                                                                |
| `DEEPSEEK_API_KEY`（Env）                    | 与文件 Key 二选一即可                                                                                                                                          | ✗                        | **Env 或文件**                           | 已有文件 → **不必配 Env**                                                                                                                     |
| `OLLAMA_HOST`                              | Ollama 监听地址                                                                                                                                            | ✓ Env `0.0.0.0`          | **系统 Env**（Ollama）                    | 保持；**勿写入 config.json**                                                                                                                 |
| `OLLAMA_MODELS`                            | Ollama 模型目录                                                                                                                                            | ✓ Env                    | **系统 Env**（Ollama）                    | 保持；**勿写入 config.json**                                                                                                                 |
| `OLLAMA_GPU_LAYER`                         | Ollama GPU                                                                                                                                             | ✓ Env `cuda`             | **系统 Env**（Ollama）                    | 保持；**勿写入 config.json**                                                                                                                 |
| `OLLAMA_BASE_URL`                          | gbrain 连 Ollama 的 HTTP 根                                                                                                                               | ✗（默认 localhost:11434/v1） | **Env 或** `provider_base_urls.ollama` | 本机默认即可，**可不配**                                                                                                                         |
| 仓库 `.env` / `.env.testing`                 | 仅测试注入 process.env                                                                                                                                      | ✗（个人未用）                  | 测试专用                                  | **勿当个人配置中心**                                                                                                                           |
| 代码 `TIER_DEFAULTS`                         | Anthropic 四档兜底                                                                                                                                         | △ 始终存在                   | 代码                                    | 用 DB tier **盖住**即可                                                                                                                     |
| 代码 `DEFAULT_SEARCH_MODE`                   | `balanced`                                                                                                                                             | △                        | 代码                                    | 用 DB `search.mode` 盖住                                                                                                                  |




**读表提示：**

- ✓ 且建议「必配」的项：清库/`reinit` 后务必按 §1.5 B 写回。  
- ✗ 且建议「可不配」的项：保持现状即可，不是缺陷。  
- Ollama 三项是**服务进程**环境变量，与 GBrain 文件/DB 平面无关。  
- Reranker 需 cross-encoder（ZeroEntropy 或本地 `llama-server-reranker` / Qwen3-Reranker GGUF）；**DeepSeek Flash、DashScope 云 API 不能当 reranker**。



### 1.8 可执行配置包（按推荐平面 · 含本机已有项）

> 按 §1.7「建议平面」整理。含你当前已配的全部有效项。  
> **Key 勿提交 git**：下面 JSON 用占位符；粘贴时保留你机器上已有的 `deepseek_api_key`。



#### A. 文件平面 — 整份写入 `%USERPROFILE%\.gbrain\config.json`

覆盖保存（或与现文件合并）。路径按你本机已核对：

```json
{
  "engine": "pglite",
  "database_path": "C:\\Users\\GOBAO\\.gbrain\\brain.pglite",
  "embedding_model": "ollama:qwen3-embedding:4b",
  "embedding_dimensions": 1024,
  "schema_pack": "gbrain-base-v2",
  "chat_model": "deepseek:deepseek-v4-pro",
  "expansion_model": "deepseek:deepseek-v4-flash",
  "provider_base_urls": {
    "deepseek": "https://api.deepseek.com"
  },
  "deepseek_api_key": "sk-把你现有的Key粘在这里",
  "mcp": {
    "publish_skills": true
  },
  "self_upgrade": {
    "mode": "notify",
    "mode_prompted": true
  }
}
```

对应已有文件项：`engine`、`database_path`、`embedding_*`、`schema_pack`、`chat_model`、`expansion_model`、`provider_base_urls`、`deepseek_api_key`、`mcp.publish_skills`、`self_upgrade.*`。

改完后重启 `gbrain serve`（若在跑）。

#### B. DB 平面 — PowerShell 一次性执行

先停掉占用 PGLite 的 `serve`，在仓库根执行：

```powershell
cd C:\Users\GOBAO\Downloads\AI\gbrain

# —— 模型四档（已有）——
gbrain config set models.tier.utility deepseek:deepseek-v4-flash
gbrain config set models.tier.reasoning deepseek:deepseek-v4-pro
gbrain config set models.tier.deep deepseek:deepseek-v4-pro
gbrain config set models.tier.subagent deepseek:deepseek-v4-pro

# —— 非 Anthropic 跑 dream/agent（已有）——
gbrain config set agent.use_gateway_loop true --force

# —— 检索（已有）——
gbrain config set search.mode conservative|balanced|tokenmax
gbrain config set search.reranker.enabled false

# —— 抽取Takes（已有）——
gbrain config set takes.bootstrap_enabled true --force

# —— MCP / skills（已有）——
gbrain config set mcp.skills_dir C:\Users\GOBAO\Downloads\AI\gbrain\skills
gbrain config set mcp.publish_skills true
gbrain config set mcp.publish_advisor true

# —— 其它本机 DB 已有项 ——
gbrain config set schema_pack gbrain-base-v2   # 在文件平面配置
gbrain config set chunk_strategy semantic --force  # 当前不生效
```

**不要**用 `gbrain config set` 写 `embedding_model` / `embedding_dimensions` / `engine`（定宽与引擎属文件平面；`config set embedding_`* 会被拒绝）。init/reinit 后它们可能出现在 DB 镜像里，以**文件**为准即可。

**不要**手改 `version`（迁移系统写入）。

验证：

```powershell
gbrain config show
gbrain config get models.tier.deep
gbrain config get search.mode
gbrain config get search.reranker.enabled
gbrain config get agent.use_gateway_loop
gbrain config get mcp.skills_dir
gbrain config get chunk_strategy
gbrain config get schema_pack
```



#### C. 系统 Env（Ollama · 非 gbrain 文件/DB）

你当前已有，保持即可（**不要**写进 `config.json`）：

```powershell
# 若重装系统后需补回（用户环境变量或当前会话）：
[System.Environment]::SetEnvironmentVariable('OLLAMA_HOST', '0.0.0.0', 'User')
[System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\OllamaCache', 'User')
[System.Environment]::SetEnvironmentVariable('OLLAMA_GPU_LAYER', 'cuda', 'User')
# 新开终端后生效
```



#### D. 本机刻意未配（保持现状即可）


| 项                                            | 说明                             |
| -------------------------------------------- | ------------------------------ |
| `models.think`                               | 回落 `models.tier.deep`          |
| `takes.bootstrap_enabled`                    | 默认关；要用再开                       |
| `sync.repo_path`                             | 需要时 `gbrain import ..\MyBrain` |
| `ANTHROPIC_*` / `ZEROENTROPY_*` / `GBRAIN_*` | DeepSeek+Ollama 栈不需要           |
| `retrieval_reflex*`                          | 默认开，可不写                        |


---



## 2. 模型解析链：Admin Ask / dream / embed



### 2.1 三条机制


| 机制                      | 读哪里                                                                                         | 用途                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A.** `resolveModel()` | DB（`--model` > 任务键 > `models.default` > `models.tier.`* > `GBRAIN_MODEL` > `TIER_DEFAULTS`） | think / dream 多数 LLM                                    |
| **B. Gateway 文件平面**     | `config.json` + env                                                                         | `chat_model` / `expansion_model` / `embedding_model` 种子 |
| **C. Embed**            | 文件 `embedding_model`                                                                        | `gbrain embed` / dream embed（换维用 `reinit-pglite`）       |




### 2.2 本机实际路由


| 入口            | 阶段                   | 能力        | 解析                                    | **本机实际**                    |
| ------------- | -------------------- | --------- | ------------------------------------- | --------------------------- |
| Admin Ask     | `query`              | Embedding | 文件                                    | `ollama:qwen3-embedding:4b` |
| Admin Ask     | `query`              | Expansion | 文件（tokenmax）                          | `deepseek-v4-flash`         |
| Admin Ask     | `query`              | Reranker  | DB 已关                                 | **跳过**                      |
| Admin Ask     | `think`              | Chat      | `models.tier.deep`                    | `deepseek-v4-pro`           |
| dream         | `embed`              | Embedding | 文件                                    | 同上 Ollama                   |
| dream         | `synthesize`         | Chat      | `models.tier.reasoning`               | DeepSeek pro                |
| dream         | synthesize verdict   | Chat      | `models.tier.utility`                 | DeepSeek flash              |
| dream         | `patterns` / `drift` | Chat      | `models.tier.reasoning`               | DeepSeek pro                |
| dream         | `auto_think`（若开）     | Chat      | `models.tier.deep`                    | DeepSeek pro                |
| dream / agent | subagent             | 多轮        | `models.tier.subagent` + gateway loop | pro + **开**                 |
| embed CLI     | —                    | Embedding | 文件                                    | Ollama 1024d                |


```text
Admin Ask
├─ query: embedQuery / expand /（rerank 关）
└─ think: resolveModel → models.tier.deep → deepseek-v4-pro
```



### 2.3 易混淆

1. 文件 `chat_model` ≠ Ask `think`（think 看 DB tier.deep）。
2. embed **只**走 Ollama embedding，不走 DeepSeek chat。
3. doctor「缺口 · N 页 / 0 takes」是检索元数据，不是「LLM 配置丢了」。
4. DeepSeek / 千问 **chat** API ≠ reranker；本地可用 Qwen3-Reranker + llama-server。



### 2.4 常用改法

```powershell
gbrain config set models.tier.deep deepseek:deepseek-v4-pro
gbrain config set models.think deepseek:deepseek-v4-pro   # 可选，仅盖 think
# expansion：改 config.json 的 expansion_model
gbrain config set takes.bootstrap_enabled true
gbrain takes extract --from-pages
```

---



## 3. 与 doctor 告警


| doctor 项                                 | 含义                           | 与本机                  |
| ---------------------------------------- | ---------------------------- | -------------------- |
| `takes_count`                            | 0 takes                      | 未开 bootstrap → 预期    |
| `graph_signals_coverage` / `brain_score` | 链接/结构分低                      | 内容侧；`extract all` 等  |
| `reranker_health`                        | ZE 失败审计                      | 已关 reranker → 可忽略旧记录 |
| `resolver_health`                        | skills 路径                    | 已设 `mcp.skills_dir`  |
| `subagent_capability`                    | 非 Anthropic / 无 prompt cache | 预期；已开 gateway loop   |


---



## 4. 维护

- 改 DB：`gbrain config get <key>`；改文件后重启 `serve`。  
- 不能单平面收齐全部键（§1.4）；推荐落地 §1.5；现状总表 §1.7；**可复制执行包 §1.8**；路由 §2。
- 大改配置后重跑 §1.2 / 更新 §1.7「当前是否已配」。  
- 完整手册仍以 `OPS_MANUAL.zh.md` §2 / §8 为准。

