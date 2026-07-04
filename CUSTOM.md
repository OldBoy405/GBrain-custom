# GBrain 二次开发记录

## 基本信息
- 官方仓库：https://github.com/garrytan/gbrain
- 二开仓库：https://github.com/OldBoy405/GBrain-custom
- 主开发分支：custom/main
- 产品名：（待填写）
- 是否对外分发：（是/否，待填写）

## 我改过的文件
| 文件/目录 | 改了什么 | 日期 |
|-----------|----------|------|
| `AGENTS.md` | 重构为 Qoder 开发者专用文档，补充 Windows 环境下的构建与运行说明 | 2025-06-25 |
| `package.json` | `postinstall` 脚本从 bash 内联命令改为 `bun run scripts/postinstall.ts`，解决 Windows PowerShell 下 `bun install` 报错 | 2025-06-25 |
| `scripts/postinstall.ts` | 新增跨平台 postinstall 脚本，使用 Node `spawnSync` 替代 bash 语法（`command -v`、`>/dev/null` 等） | 2025-06-25 |
| `CUSTOM.md` | 新增二开记录文件，记录所有定制化改动 | 2025-06-25 |
| `src/core/ai/dims.ts` | `dimsProviderOptions()` 新增可选第 5 参 `providerId`；`providerId==='ollama'` 时对任意模型返回 `{ openaiCompatible: { dimensions } }`，使 Ollama 支持自定义/Matryoshka 维度 | 2026-07-03 |
| `src/core/ai/gateway.ts` | `embed()` 调用 `dimsProviderOptions(...)` 时传入 `recipe.id`，让 Ollama embed 请求带上 `dimensions` | 2026-07-03 |
| `src/core/embedding-dim-check.ts` | `isCustomDimValidForProvider()` 放行 Ollama 以及 `user_provided_models`（llama-server/litellm）recipe 的显式自定义维度（`1..pgvector 列上限`） | 2026-07-03 |
| `test/ai/gateway.test.ts` | 新增 Ollama 维度传参 + `providerId` 向后兼容用例 | 2026-07-03 |
| `test/embedding-dim-check.test.ts` | 新增 Ollama / llama-server / litellm 显式维度通过、超列上限拒绝用例 | 2026-07-03 |
| `docs/integrations/embedding-providers.md` | 更新 Ollama / llama-server / LiteLLM 小节，说明任意模型 + 自定义维度用法与 fail-loud 行为 | 2026-07-03 |
| `docs/architecture/KEY_FILES.md` | 更新 `dims.ts` / `gateway.ts` 条目以反映 `dimsProviderOptions` 5 参签名与 Ollama 分支 | 2026-07-03 |
| `docs/operations/OPS_MANUAL.zh.md` | 新增 GBrain 项目运维手册（环境/配置/CLI/维护/MCP/特殊功能） | 2026-07-03 |
| `docs/operations/OPS_CHECKLIST.windows-ollama.zh.md` | 新增 Windows + Ollama + Qwen3 个人运维速查清单 | 2026-07-03 |
| `docs/operations/OPS_CHECKLIST.windows-ollama.zh.md` | 健康检查改用 `doctor --scope=brain`（避免源码仓库 `resolver_health` 误报）；§1.2 全局 CLI 改为 `%USERPROFILE%\.bun\bin\gbrain.cmd` shim（`bun run src/cli.ts` 转发）；明确禁用 `bun link -g` 与 PGLite 场景下的 `bun build --compile`（#1340 `pglite.data`）；补充 postinstall / bunfs 故障速查；全文命令统一为 `gbrain`（经 shim） | 2026-07-04 |

## 我新增的能力
| 能力 | 位置 | 说明 |
|------|------|------|
| 项目知识库 | `.qoder/` | Qoder 知识模块与仓库 wiki，辅助 AI 理解项目架构 |
| 架构讲解页面 | `gbrain-architecture.html` | 可视化项目架构文档（HTML） |
| 开发者指南 | `AGENTS.md` | 面向 AI 开发者的项目说明与规范 |
| Windows 全局 CLI shim | `%USERPROFILE%\.bun\bin\gbrain.cmd` | PGLite 下不能用编译 exe；cmd 转发到 Fork 的 `bun run src/cli.ts`，见 OPS_CHECKLIST §1.2 |

## 我故意删除或禁用的内容
| 路径/配置 | 原因 |
|-----------|------|
| Windows PGLite 使用 `bun build --compile` 作全局 CLI | 编译产物无法释放 `pglite.data` WASM（`$$bunfs/root` ENOENT，上游 #1340）；改用 cmd shim 或 `bun run src/cli.ts` |
| Windows 使用 `bun link -g gbrain` | 易链到空 `global/node_modules/gbrain`，导致 `Module not found .../src/cli.ts` 与 postinstall 失败 |

## 合并官方记录
| 日期 | 官方版本/commit | 有没有冲突 | 备注 |
|------|----------------|------------|------|
| | | | |