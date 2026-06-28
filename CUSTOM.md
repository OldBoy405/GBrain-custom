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

## 我新增的能力
| 能力 | 位置 | 说明 |
|------|------|------|
| 项目知识库 | `.qoder/` | Qoder 知识模块与仓库 wiki，辅助 AI 理解项目架构 |
| 架构讲解页面 | `gbrain-architecture.html` | 可视化项目架构文档（HTML） |
| 开发者指南 | `AGENTS.md` | 面向 AI 开发者的项目说明与规范 |

## 我故意删除或禁用的内容
| 路径/配置 | 原因 |
|-----------|------|
| | |

## 合并官方记录
| 日期 | 官方版本/commit | 有没有冲突 | 备注 |
|------|----------------|------------|------|
| | | | |