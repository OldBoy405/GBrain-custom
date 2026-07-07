# GBrain 个人运维清单（Windows + Ollama + Qwen3）

> 面向本机 PGLite + `ollama:qwen3-embedding:4b` @ **1024 维** 的日常运维速查。  
> 完整说明见 [`OPS_MANUAL.zh.md`](OPS_MANUAL.zh.md)。  
> DeepSeek Chat、Tier 注入优先级、Schema Pack / Takes / Reranker 见手册 [**§8**](OPS_MANUAL.zh.md#8-模型-tier可选升级与检索精排)。

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

## 三、日常导入与检索

```powershell
# 导入笔记目录（首次或增量）
gbrain import D:\path\to\notes

# 若笔记在 Git 仓库且已绑定 source
gbrain sync

# 补 embedding（换模型后或 signature 漂移）
gbrain embed --stale

# 搜索
gbrain search "你的问题"
gbrain search "你的问题" --json
```

**推荐顺序：** `import` 或 `sync` →（必要时）`embed --stale` → `search`

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

## 十一、本环境不需要的操作

| 能力 | 原因 |
|------|------|
| `gbrain serve --http` + OAuth | PGLite 上 HTTP MCP 能力受限；个人本机用 stdio 即可 |
| `gbrain jobs work` 常驻 | 需 Postgres；PGLite 用 `jobs submit --follow` |
| `gbrain migrate --to supabase` | 仅当笔记 >1000 或需多机共享时再考虑 |
| 云 API Key（OpenAI 等） | 纯 Ollama 本地 embed 可不配；expansion/chat 功能才需要 |

---

## 十二、每日三板斧（复制即用）

```powershell
gbrain doctor --scope=brain --fast
gbrain sync          # 或 import <dir>
gbrain search "今天要查的内容"
```

---

## 相关文件

| 路径 | 说明 |
|------|------|
| `%USERPROFILE%\.gbrain\config.json` | 主配置 |
| `%USERPROFILE%\.gbrain\brain.pglite\` | 数据库目录 |
| `docs/operations/OPS_MANUAL.zh.md` | 完整运维手册 |
| `docs/integrations/embedding-providers.md` | Ollama 提供商说明 |
| `bin/gbrain.exe` | `bun build --compile` 产物；**PGLite 场景勿用** |
| `CUSTOM.md` | 本 Fork 改动记录 |
