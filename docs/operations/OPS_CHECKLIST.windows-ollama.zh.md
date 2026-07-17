# GBrain 个人运维清单（Windows + Ollama + Qwen3）

> 面向本机 PGLite + `ollama:qwen3-embedding:4b` @ **1024 维** 的日常运维速查。  
> 完整说明见 [`OPS_MANUAL.zh.md`](OPS_MANUAL.zh.md)（**§2.6 入库落盘 · §3.4 绑定目录 · §9 指令总表**）。  
> DeepSeek Chat、Tier 注入优先级、Schema Pack / Takes / Reranker 见手册 [**§8**](OPS_MANUAL.zh.md#8-模型-tier可选升级与检索精排)。  
> 本机四层配置快照 + Ask/dream/embed 模型路由见 [`CONFIG_PLANES_AND_MODEL_ROUTING.zh.md`](CONFIG_PLANES_AND_MODEL_ROUTING.zh.md)。

---

## 环境快照

| 项 | 值 |
|----|-----|
| OS | Windows 10/11 |
| 运行时 | Bun |
| 引擎 | PGLite（`%USERPROFILE%\.gbrain\brain.pglite`） |
| Embedding | `ollama:qwen3-embedding:4b` |
| 向量维度 | **1024**（Matryoshka 截断；≤2000 可走 HNSW） |
| Ollama 地址 | `http://localhost:11434/v1`（默认） |
| Fork 仓库 | `C:\Users\GOBAO\Downloads\AI\gbrain` |
| 全局 CLI | `%USERPROFILE%\.bun\bin\gbrain.cmd`（Bun shim，见 §1.2） |
| 开发备用 | `bun run src/cli.ts <命令>`（与 shim 等价） |

本 Fork 已对 Ollama 支持：**任意模型 + 可配置维度**（`src/core/ai/dims.ts`、`src/core/embedding-dim-check.ts`）。

> **PGLite + Windows 不要用 `bun build --compile`**：`--compile` 产物无法正确释放 `pglite.data` WASM，会报 `$$bunfs/root` / `pglite.data` ENOENT（[#1340](https://github.com/garrytan/gbrain/issues/1340)）。PGLite 场景用 §1.2 的 **Bun shim**。
>
> **Windows Fork 不要用 `bun link -g`**：易把全局 `gbrain` 链到空目录。标准装法见 §1.2。

---

## 标准工作流（闭环速览）

> 完整版见手册 [`OPS_MANUAL.zh.md`](OPS_MANUAL.zh.md) §10。贯穿原则:**先绑定落盘,写操作前停 `serve`,PGLite 的 job 一律 `--follow`**。

```
① 地基(一次)  init --pglite → import D:\MyBrain(绑定落盘) → config set search.mode/models.tier
② 采集        capture "…" / capture --file / import <dir>        # 原始输入先进 inbox/,不纠结分类
③ 入库落盘    sync → embed --stale → doctor --scope=brain --fast
④ 结构化(周期) jobs submit inbox_enrich --follow / dream / enrich --thin
⑤ 检索        query / think --json ·「状态」问题走 salience / whoknows / recall --today
⑥ 运维        每天: sync + embed --stale + status ｜ 每周: dream + advisor + 备份
```

| 问题类型 | 用这个（别用 `search`） |
|---------|------------------------|
| 找内容 / 要答案 | `query "…"` / `think "…" --json`（含 gaps） |
| 最近在忙什么 / 什么反常 | `salience --days 14` / `anomalies` |
| 谁懂 X | `whoknows "<topic>" --explain` |
| 今天记了啥 | `recall --today` |

---

## 一、首次安装（一次性）

推荐顺序：**§1.1 依赖 → §1.2 全局 CLI → §1.3 初始化 brain**。

### 1.1 安装依赖

```powershell
# 1. 安装 Ollama 并拉模型
ollama pull qwen3-embedding:4b

# 2. 进入 Fork 仓库并装依赖（必须 --ignore-scripts，见 §1.2 说明）
cd C:\Users\GOBAO\Downloads\AI\gbrain
bun install --ignore-scripts
```

### 1.2 Windows Fork 全局 CLI（标准装法 · PGLite）

PGLite 必须走 **`bun run src/cli.ts`**，不能 `bun build --compile`（WASM 无法打进 exe）。在 PATH 里放一个 **cmd shim**，让 `gbrain` 命令转发到 Fork 源码即可（含 Ollama 维度补丁）。

```powershell
cd C:\Users\GOBAO\Downloads\AI\gbrain
$Repo = (Get-Location).Path
$Bin  = "$env:USERPROFILE\.bun\bin"

# 1. 若曾编译或 bun link -g，先删掉损坏的 gbrain.exe（.exe 优先于 .cmd，必须移除）
Remove-Item "$Bin\gbrain.exe" -ErrorAction SilentlyContinue
bun remove -g gbrain

# 2. 写入 shim（把 $Repo 换成你的 Fork 绝对路径）
@"
@echo off
bun run "$Repo\src\cli.ts" %*
"@ | Set-Content -Encoding ASCII "$Bin\gbrain.cmd"

# 3. 验证（必须能连 PGLite，不能报 pglite.data / bunfs）
gbrain --version
gbrain config show
Get-Command gbrain | Select-Object Source
# 预期：Source = ...\.bun\bin\gbrain.cmd，config show 正常输出
```

**为何 `bun install` 要加 `--ignore-scripts`？**  
`postinstall` 会调用 PATH 里的 `gbrain apply-migrations`。全局 CLI 未就绪或损坏时 postinstall 失败。完成 §1.2 后仍建议 `--ignore-scripts`，避免误触发迁移。

**升级 Fork 后**：`git pull` + `bun install --ignore-scripts` 即可；shim 路径不变，无需重装。

### 1.3 初始化 brain 与验证

```powershell
# 3. 初始化 brain（需先完成 §1.2）
gbrain init --pglite `
  --embedding-model ollama:qwen3-embedding:4b `
  --embedding-dimensions 1024

# 4. 验证（用 --scope=brain 判断个人 brain 健康）
gbrain doctor --scope=brain
gbrain providers test --model ollama:qwen3-embedding:4b
gbrain config show
```

**预期：**

- `config.json` 中 `embedding_model` = `ollama:qwen3-embedding:4b`
- `embedding_dimensions` = `1024`
- `doctor --scope=brain` **无 FAIL**（WARN 如 `embeddings` 空库、`pgvector` PGLite 限制可忽略）
- `Weighted brain score` 接近 100/100 即 brain 数据侧正常
- `providers test` 显示探测成功（注意：探测可能显示 recipe 默认维 768，**真实 embed 以 config 的 1024 为准**）
- `gbrain --version` 正常；`gbrain config show` 能连 PGLite（不报 `pglite.data`）

> **为何用 `--scope=brain`？** 在 gbrain **源码仓库**内跑完整 `doctor` 会扫描 `skills/RESOLVER.md`，触发 `resolver_health` FAIL，拉低 Overall 分（常见 ~45/100），与个人 `~/.gbrain` 无关。个人运维以 `doctor --scope=brain` 为准。

> **§1.2 未完成前**：把上面 `gbrain` 换成 `bun run src/cli.ts` 即可继续 init/doctor。

### 1.4 绑定笔记目录（入库落盘 · init 后建议立即做）

仅 `init --pglite` 时，内容默认 **只在** `%USERPROFILE%\.gbrain\brain.pglite\`（数据库），**资源管理器里看不到 `.md`**。要用文件夹 / Git / Obsidian 管理笔记，须绑定落盘根目录：

```powershell
# 1. 建 brain 仓库根（可为空目录）
New-Item -ItemType Directory -Force D:\MyBrain

# 2. import 会写入 sync.repo_path，并把目录内已有 .md 灌进 DB
gbrain import D:\MyBrain

# 3. 验证
gbrain config get sync.repo_path    # 应输出 D:\MyBrain
gbrain sources list                 # default · N pages
explorer D:\MyBrain\inbox           # capture 后可见 inbox\*.md
```

| 检查项 | 已落盘 | 仅 DB（你当前可能的状态） |
|--------|--------|---------------------------|
| `config get sync.repo_path` | 有路径 | `Config key not found` |
| `sources list` | 有 `local_path` 或已 sync | `never synced`、无路径列 |
| 资源管理器 | `{路径}\inbox\*.md` | 只有 `brain.pglite` 目录 |

**已有 DB 内容、尚未落盘：** `gbrain import D:\MyBrain` 绑定路径后 `gbrain sync --repo D:\MyBrain`，或 `gbrain export --dir D:\MyBrain-export` 一次性导出。

**PGLite：** `gbrain serve --http` 运行时，另开终端 CLI 可能 **连接超时** —— 写操前先停 serve。

详见手册 [**§2.6 / §3.4 / §9.2**](OPS_MANUAL.zh.md#26-入库落盘syncrepo_path-与-sourceslocal_path)。

---

## 二、每次开机 / 开始工作前

```powershell
# 1. 确认 Ollama 在跑（另开终端或系统托盘）
ollama list
# 若无服务：启动 Ollama 应用，或 ollama serve

# 2. 快速健康检查（~10 秒；--scope=brain 跳过源码 skill 检查）
gbrain doctor --scope=brain --fast

# 3. 可选：探测 embedding 可达性
bun -e "fetch('http://localhost:11434/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen3-embedding:4b',input:'ping',dimensions:1024})}).then(r=>r.json()).then(j=>console.log('dims=',j.data?.[0]?.embedding?.length))"
# 预期输出：dims= 1024
```

---

## 三、日常导入、入库与检索

```powershell
# ── 落盘绑定（首次，见 §1.4）──
gbrain import D:\MyBrain

# ── 单条入库 ──
gbrain capture "要记住的想法"
gbrain capture --file D:\notes\today.md

# ── 增量同步（已绑定 Git 笔记库时）──
gbrain sync

# ── 补 embedding ──
gbrain embed --stale

# ── 检索 / 合成 ──
gbrain search "你的问题"
gbrain think "你的问题" --json          # 含 gaps 证据缺口

# ── 查看已入库（CLI）──
gbrain list
gbrain get inbox/2026-07-15-xxxxx

# ── 仅 DB、要在资源管理器看：导出 ──
gbrain export --dir D:\MyBrain-export
explorer D:\MyBrain-export
```

**推荐顺序：** `import`（§1.4）→ `capture` / Admin 采集 → `sync` →（必要时）`embed --stale` → `search` / `think`

**Admin 界面（Fork 开发联调，可选）：**

```powershell
# 终端 1
bun run src/cli.ts serve --http --port 3131
# 终端 2
cd admin; bun run dev
# 浏览器：http://localhost:5173/admin/#/inbox  或  http://127.0.0.1:3131/admin/#/inbox
```

---

## 四、接入 Cursor / Claude Code（本地 MCP）

模式：**stdio**，无需 token / OAuth。Brain 数据在 `%USERPROFILE%\.gbrain\`。

> **前置**：brain 已 `init --pglite`；§1.2 shim 或 `bun run src/cli.ts` 可用。**勿**用 `bin\gbrain.exe`（PGLite WASM 会失败）。

### 4.1 Cursor（推荐）

#### 方式 A：编辑 `mcp.json`（推荐）

**全局**（所有项目）：新建 `%USERPROFILE%\.cursor\mcp.json`  
**项目级**（仅本仓库）：新建 `C:\Users\GOBAO\Downloads\AI\gbrain\.cursor\mcp.json`

```json
{
  "mcpServers": {
    "gbrain": {
      "type": "stdio",
      "command": "C:\\Users\\GOBAO\\.bun\\bin\\bun.exe",
      "args": [
        "run",
        "C:\\Users\\GOBAO\\Downloads\\AI\\gbrain\\src\\cli.ts",
        "serve"
      ]
    }
  }
}
```

若 §1.2 已装 `gbrain.cmd` 且终端里 `gbrain serve` 正常，可简化为：

```json
{
  "mcpServers": {
    "gbrain": {
      "type": "stdio",
      "command": "C:\\Users\\GOBAO\\.bun\\bin\\gbrain.cmd",
      "args": ["serve"]
    }
  }
}
```

保存后 **`Ctrl+Shift+P` → Reload Window**，或在 **Settings → MCP** 确认 `gbrain` 为已连接（绿点）。

#### 方式 B：Cursor 设置界面

1. **Cursor Settings**（`Ctrl+,`）→ **MCP**
2. **Add new MCP server**
3. Type = `stdio`；Command = `C:\Users\GOBAO\.bun\bin\bun.exe`
4. Args（分行或空格）：`run` `C:\Users\GOBAO\Downloads\AI\gbrain\src\cli.ts` `serve`
5. Reload Window

#### 验证

```powershell
# 终端自测（应挂起等待 stdin，Ctrl+C 退出）
bun run C:\Users\GOBAO\Downloads\AI\gbrain\src\cli.ts serve
```

在 Cursor 对话中试：`搜索 brain 里关于 xxx 的内容`。  
连不上时：`Ctrl+Shift+U` → Output → 选 MCP 相关通道看日志。

| 现象 | 处理 |
|------|------|
| `spawn ENOENT` | `command` 改用 `bun.exe` / `gbrain.cmd` **绝对路径** |
| `pglite.data` / `$$bunfs` | 配置里不要用 `gbrain.exe`，改用 `bun run ...\src\cli.ts serve` |
| 改配置不生效 | Reload Window；必要时完全退出 Cursor 再开 |

### 4.2 Claude Code

```powershell
# 推荐：§1.2 shim 后
claude mcp add gbrain -- gbrain serve

# 备用：直接 Bun 跑源码
claude mcp add gbrain -- bun run C:\Users\GOBAO\Downloads\AI\gbrain\src\cli.ts serve
```

移除：`claude mcp remove gbrain`

---

## 五、配置微调（无需重建 brain）

以下用 `gbrain config set`，**不要**用来改 `embedding_model` / `embedding_dimensions`。

```powershell
# 省资源搜索（本机 Ollama 推荐）
gbrain config set search.mode conservative

# 查看当前搜索模式
gbrain search modes

# 本地 embedding 无云 API 花费压力时可放宽花费门（可选）
gbrain config set spend.posture tokenmax

# 查看全部配置
gbrain config show
```

**关闭检索反射（文件平面，须编辑 config.json）：**

```json
"retrieval_reflex": false
```

或环境变量：`$env:GBRAIN_RETRIEVAL_REFLEX = "false"`

---

## 六、换 Embedding 模型或维度

`gbrain config set embedding_model` **不可用**。必须重建 PGLite schema：

```powershell
# 确认 Ollama 模型已拉取
ollama pull qwen3-embedding:4b

# 破坏性重建（会备份到 brain.pglite.bak）
gbrain reinit-pglite `
  --embedding-model ollama:qwen3-embedding:4b `
  --embedding-dimensions 1024 `
  --yes

# 若 .bak 已存在需先移走
Remove-Item -Recurse -Force $env:USERPROFILE\.gbrain\brain.pglite.bak -ErrorAction SilentlyContinue
```

**维度建议：**

| 维度 | HNSW | 说明 |
|------|------|------|
| 768 / 1024 | ✅ | 推荐；检索更快 |
| 2560 | ❌（exact scan） | Qwen3 原生维；数据量大时变慢 |

---

## 七、备份与恢复

```powershell
$g = "$env:USERPROFILE\.gbrain"

# 备份
Copy-Item -Recurse "$g\brain.pglite" "$g\brain.pglite.backup-$(Get-Date -Format yyyyMMdd-HHmm)"
Copy-Item "$g\config.json" "$g\config.json.backup-$(Get-Date -Format yyyyMMdd)"

# 恢复（先停掉所有 gbrain 进程）
Remove-Item -Recurse -Force "$g\brain.pglite"
Copy-Item -Recurse "$g\brain.pglite.backup-YYYYMMDD" "$g\brain.pglite"
```

---

## 八、升级 gbrain 版本

```powershell
cd C:\Users\GOBAO\Downloads\AI\gbrain
git pull
bun install --ignore-scripts

# 应用 schema 迁移
gbrain upgrade
# 或
gbrain apply-migrations --yes

gbrain doctor --scope=brain
```

Fork 二次开发后建议跑：`bun run typecheck` + `bun test test/embedding-dim-check.test.ts test/ai/gateway.test.ts`

---

## 九、故障速查

| 现象 | 处理 |
|------|------|
| `model "qwen3-embedding:4b" not found` | `ollama pull qwen3-embedding:4b` |
| `Refusing to init: ... custom dimensions` | 升级本 Fork 代码（需 Ollama 维度补丁）或改用 768 且接受 Qwen3 不匹配 |
| `returned 2560 but schema expects 1024` | 未应用 Ollama `dimensions` 传参补丁；或 reinit 维度与 config 不一致 |
| `The system cannot find the path specified`（init 后） | Windows 上 GStack 检测无害警告，可忽略 |
| `reinit-pglite` 报 `bak_exists` | 删除或移走 `brain.pglite.bak` |
| `reinit-pglite` 报 `no_brain` | 用 `init --force --pglite ...` 代替 |
| Ollama 未启动 | 打开 Ollama 应用；`curl http://localhost:11434/api/tags` |
| schema 过旧 | `gbrain apply-migrations --yes` |
| 搜索无结果 | `gbrain embed --stale`；确认已 `import` |
| `doctor` Overall ~45/100 + `resolver_health` FAIL | 在源码仓库跑全量 doctor 的正常现象；改用 `doctor --scope=brain` |
| `bun install` postinstall 报 `Module not found .../global/node_modules/gbrain/src/cli.ts` | 全局 `gbrain` 损坏；`bun install --ignore-scripts`，再按 §1.2 编译 + `Copy-Item` |
| `bun link -g gbrain` 报 `FileNotFound` / `EPERM` | Windows 上勿用；改用 §1.2 shim |
| `PGLite failed... pglite.data` / `$$bunfs/root` | 用了 `bun build --compile` 的 exe；删 `gbrain.exe`，改 §1.2 shim |
| `gbrain` 仍是上游版、无 Ollama 1024 维 | shim 路径指错仓库；检查 `gbrain.cmd` 内 `bun run ...\src\cli.ts` |
| **`config get sync.repo_path` 找不到** | 未 `import` 绑定目录；内容仅在 DB，见 §1.4 |
| **`sources list` 显示 never synced** | 未绑定 `local_path` / 未跑过 sync；先 §1.4 再 `sync` |
| **资源管理器找不到 inbox/*.md** | 同上；或 `export --dir` 导出查看 |
| **`sources list` / CLI 连接超时** | `serve --http` 占用 PGLite；停 serve 后再跑 CLI |
| **`resolver_health` WARN：`Could not find skills directory`**（不在源码仓库内跑 doctor 时） | 跟上面那条源码仓库内的 `resolver_health` FAIL 是**两种不同场景**；见下方说明，别去改 `mcp.skills_dir`（不相关） |

**`resolver_health` WARN vs `mcp.skills_dir`：两条不同的路径，勿混淆**

- `resolver_health`（以及 `check-resolvable`/`routing-eval`）走本地自动探测：`$GBRAIN_SKILLS_DIR` → `$OPENCLAW_WORKSPACE` → 向上找 `skills/` → `~/.openclaw/workspace` → gbrain 仓库根 → `./skills`。**不读 `mcp.skills_dir`。**
- `mcp.skills_dir` 只影响远程 MCP 的 `list_skills`/`get_skill`（给 Claude Code/Cursor 等 thin client 用，见§四）；**不设置时不等于跟 `resolver_health` 一样自动兜底**——真正的 MCP 调用永远被当成 `ctx.remote=true`，走的是**没有** install-path 兜底的探测版本，落不落到项目根 `skills/` 完全取决于 MCP server 进程的 cwd（需要在 `mcp.json` 里显式加 `cwd` 才保证，见§四）。两条路径只是常因同一个根本原因失败，不是"修好一个另一个自动跟着好"。
- **不修的影响：** `doctor`（scope=all）只扣 5 分不影响 exit code；`check-resolvable`/`routing-eval` 会 exit 1（只有主动跑它们才碰到）；日常 `query`/`sync`/`embed` 不受影响；Claude Code 在本项目里的技能路由不受影响（直接读 checkout 里的文件，不走这条探测）。
- **两个修复方案：**
  ```powershell
  # A（省事）：直接指向本仓库自带的 skills/
  setx GBRAIN_SKILLS_DIR "C:\Users\<you>\Downloads\AI\gbrain\skills"
  # B（独立）：scaffold 到自己的目录后，还要手动补一份 RESOLVER.md（scaffold 不碰路由文件）
  gbrain skillpack scaffold --all --workspace "D:\MyBrain"
  Copy-Item "...\gbrain\skills\RESOLVER.md" "D:\MyBrain\skills\RESOLVER.md"
  ```
- **根因更新（2026-07-16）：本仓库已修好了，大多数情况下上面两个方案都不需要。** 这其实是 Windows 上的一个真 bug——`path-confine.ts` 的 `isPathContained()` 分隔符硬编码成 `/`，Windows 的 `realpathSync()` 返回反斜杠路径，导致 `skills/` 明明就在当前目录下也被判定"找不到"。已修复（改用 `path.sep`），详见 `CUSTOM.md`。**修复后项目根目录下直接跑 `gbrain check-resolvable`/`gbrain doctor` 就应该自动探测到，不用再配 `$GBRAIN_SKILLS_DIR` 或 scaffold。**
- 完整版（含 `mcp.publish_skills` 新装默认值说明）见手册 [`OPS_MANUAL.zh.md`](OPS_MANUAL.zh.md) §5.3。

**诊断命令：**

```powershell
# 个人 brain 健康（推荐）
gbrain doctor --scope=brain
gbrain doctor --scope=brain --json

# 完整 doctor（含 skill 路由；在源码仓库内常有 resolver_health FAIL，勿当作 brain 故障）
# gbrain doctor

gbrain providers test --model ollama:qwen3-embedding:4b
gbrain models doctor
```

---

## 十、清理测试数据 / 重置空库

```powershell
$g = "$env:USERPROFILE\.gbrain"
Remove-Item -Recurse -Force "$g\brain.pglite", "$g\brain.pglite.bak" -ErrorAction SilentlyContinue

cd C:\Users\GOBAO\Downloads\AI\gbrain
gbrain init --force --pglite `
  --embedding-model ollama:qwen3-embedding:4b `
  --embedding-dimensions 1024
# 预期：0 pages
```

---

## 十一、本环境不需要 / 可选的操作

| 能力 | 原因 |
|------|------|
| `gbrain serve --http` + OAuth（远程 MCP） | 个人本机 Cursor 用 **stdio** `gbrain serve` 即可 |
| **`serve --http` + Admin** | **可选**：Fork 开发 Admin 联调时用（§三）；非远程 MCP 必需 |
| `gbrain jobs work` 常驻 | 需 Postgres；PGLite 用 `jobs submit --follow` |
| `gbrain migrate --to supabase` | 仅当笔记 >1000 或需多机共享时再考虑 |
| 云 API Key（OpenAI 等） | 纯 Ollama embed 可不配；think/expansion 需 DeepSeek 等（见手册 §8） |

---

## 十二、每日三板斧（复制即用）

```powershell
gbrain doctor --scope=brain --fast
gbrain sync                              # 或 capture / import（见 §1.4 是否已落盘）
gbrain search "今天要查的内容"
# 可选：gbrain think "..." --json
```

---

## 十三、常用指令速查（Windows 个人栈）

| 指令 | 作用 |
|------|------|
| `gbrain doctor --scope=brain [--fast]` | 个人 brain 健康 |
| `gbrain config show` / `config get sync.repo_path` | 配置 / 是否已落盘 |
| `gbrain sources list` | source 与页数、同步状态 |
| `gbrain import <dir>` | 绑定落盘目录 + 导入 |
| `gbrain capture "…"` / `--file` | 单条入库 inbox |
| `gbrain sync [--repo <dir>]` | 磁盘 ↔ DB |
| `gbrain export --dir <out>` | 导出 .md 到资源管理器 |
| `gbrain list` / `get <slug>` | 列页 / 读页 |
| `gbrain search "q"` / `think "q"` | 检索 / 合成+gaps |
| `gbrain embed --stale` | 补向量 |
| `gbrain status` / `stats` / `health` | 状态盘 / 统计 / 健康盘 |
| `gbrain advisor` | 「接下来该做什么」只读建议 |
| `gbrain jobs submit inbox_enrich --params '{…}' --follow` | Inbox 结构化（PGLite） |
| `gbrain serve` | Cursor stdio MCP |
| `bun run src/cli.ts serve --http --port 3131` | Admin + HTTP MCP（开发） |

完整分场景表见 [`OPS_MANUAL.zh.md` §9](OPS_MANUAL.zh.md#9-指令速查总表按场景)。

---

## 十四、进阶个人能力（发现 · 记忆 · 发散 · 维护）

超出「导入→检索」的日常之外，这些命令是 gbrain 的高价值个人能力，PGLite 本机可直接用：

| 指令 | 什么时候用 |
|------|-----------|
| `gbrain salience [--days N]` | 「我最近在忙什么 / 什么最热」——不给检索词的当前状态问题 |
| `gbrain anomalies [--since D]` | 「最近什么反常」——按 tag/type 分组的统计异常 |
| `gbrain whoknows <topic> [--explain]` | 「谁懂 X / 该找谁聊」——person/company 专家路由 |
| `gbrain recall <entity>` / `recall --today` / `forget <id>` | 热记忆事实：某实体 / 今日 / 过期一条 |
| `gbrain brainstorm <q>` / `lsd <q>` | 基于 brain 的点子发散（双联想 / 反向 judge） |
| `gbrain think "q" --json` | 检索 + 合成答案 + **证据缺口 gaps** |
| `gbrain enrich --thin --limit 50` | 把只有名字的 stub 页充实成有引用的实体页（brain 内部合成） |
| `gbrain dream [--dry-run] [--json]` | 一次性隔夜维护周期（lint / 合成 / 模式）；比常驻 autopilot 更适合本机 |
| `gbrain quarantine list` / `clear <slug>` | 看/放行被内容体检隔离的页 |
| `gbrain restore <slug>` | 恢复 72h 内软删的页（**注意**：是 `restore`，不是 `pages restore`） |
| `gbrain history <slug>` / `revert <slug> <ver>` | 页版本历史 / 回滚 |
| `gbrain transcripts recent [--days N]` | 最近原始对话 transcript 摘要（local-only） |
| `gbrain check-update` | 检查新版本 |

**Push-based 上下文（v0.42/v0.43）：** `gbrain watch` 把对话喂进 stdin、主动流出相关页指针。PGLite 下 `watch` 会**整段占用**数据库连接（与 `serve` / 写操作互斥），建议分批跑或依赖 ambient reflex。详见手册 [`OPS_MANUAL.zh.md`](OPS_MANUAL.zh.md) §7.6。

> **写未登记配置键需 `--force`：** `takes.*`、`agent.use_gateway_loop`、`pace.*` 不在白名单，`gbrain config set … --force` 才能写入（详见手册 §2.3 / §8）。

---

## 相关文件

| 路径 | 说明 |
|------|------|
| `%USERPROFILE%\.gbrain\config.json` | 主配置（引擎、embedding、API Key） |
| `%USERPROFILE%\.gbrain\brain.pglite\` | **数据库**（非 markdown 笔记目录） |
| **`sync.repo_path` 所指目录** | **Markdown 落盘根**（`gbrain import` 后才有；见 §1.4） |
| `{sync.repo_path}\inbox\*.md` | 采集条目在资源管理器中的位置 |
| `%USERPROFILE%\.gbrain\inbox\` | 可选：文件夹监听丢文件的入口 |
| `docs/operations/OPS_MANUAL.zh.md` | 完整运维手册（§2.6 落盘 · §9 指令总表） |
| `admin/docs/INBOX_API.zh.md` | Inbox 工作流 API |
| `docs/integrations/embedding-providers.md` | Ollama 提供商说明 |
| `bin/gbrain.exe` | `bun build --compile` 产物；**PGLite 场景勿用** |
| `CUSTOM.md` | 本 Fork 改动记录 |
