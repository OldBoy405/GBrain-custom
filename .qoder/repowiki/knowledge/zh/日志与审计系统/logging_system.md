该仓库采用**分层、多通道**的日志与输出架构，严格区分**用户数据输出**（stdout）、**操作进度/状态**（stderr）和**结构化审计追踪**（JSONL 文件）。系统未使用第三方日志框架（如 Winston/Pino），而是基于 Node.js/Bun 原生流与自定义抽象构建，强调**机器可读性**、**并发安全性**和**故障隔离**。

### 1. 核心架构与通道

*   **标准输出分离 (Stdout/Stderr Separation)**:
    *   **Stdout**: 仅用于输出结构化数据（JSON）或命令结果，确保可被管道或 Agent 解析。严禁写入日志或进度信息。
    *   **Stderr**: 用于所有人类可读的日志、进度条、警告和错误提示。支持 TTY 检测以自动切换渲染模式（TTY 下使用 `` 刷新，非 TTY 下逐行输出）。

*   **结构化审计 (Audit Trail)**:
    *   关键操作（如重排序失败、Shell 任务、监督器事件）通过 `src/core/audit/audit-writer.ts` 写入 ISO-8601 周轮转的 JSONL 文件（默认位于 `~/.gbrain/audit/`）。
    *   **容错设计**: 审计写入采用“尽力而为”策略，失败仅向 stderr 输出警告，绝不阻断主业务流程。
    *   **环境变量**: 支持通过 `GBRAIN_AUDIT_DIR` 自定义审计目录。

*   **进度报告 (Progress Reporting)**:
    *   `src/core/progress.ts` 提供统一的进度Reporter，支持 `human`、`json`、`quiet` 和 `auto` 模式。
    *   **信号处理**: 全局监听 `SIGINT`/`SIGTERM`，在进程退出前向所有活跃阶段发送 `abort` 事件，确保进度状态的一致性。
    *   **JSON 模式**: 输出标准化的 NDJSON 事件（`start`, `tick`, `heartbeat`, `finish`, `abort`），便于外部监控系统集成。

### 2. 关键模块与约定

*   **上下文日志注入 (`Logger` Interface)**:
    *   在 `OperationContext` 中注入 `logger` 对象（`info`, `warn`, `error`）。
    *   **守护进程场景**: `IngestionDaemon` 为每个数据源包装独立的 Logger，自动添加 `[ingestion:<sourceId>]` 前缀，实现多源日志隔离。

*   **并发前缀注入 (`console-prefix.ts`)**:
    *   利用 `AsyncLocalStorage` 实现线程/协程局部的日志前缀。
    *   **API**: `withSourcePrefix(id, fn)` 包裹异步函数，内部调用 `slog`/`serr` 时自动 prepend `[id] `。
    *   **用途**: 解决 `gbrain sync --parallel` 等多源并发场景下的日志交错问题。

*   **结构化错误 (`StructuredAgentError`)**:
    *   `src/core/errors.ts` 定义了面向 Agent 的错误信封（Envelope），包含 `class`, `code`, `message`, `hint`。
    *   **序列化**: `serializeError` 确保所有抛出值（包括普通 Error）都能转换为标准化的 JSON 结构，便于 Agent 进行重试决策或用户提示。

*   **远程 MCP 错误标准化**:
    *   `src/core/mcp-client.ts` 将网络、认证、工具执行等异常统一映射为 `RemoteMcpError`，并通过 exhaustive switch 在 CLI 层转换为 actionable 的用户提示。

### 3. 开发者规则

1.  **严禁混用 Stdout/Stderr**: 
    *   业务数据/JSON 结果 → `process.stdout.write()` 或 `console.log()`（仅在确认无进度干扰时）。
    *   日志/进度/错误 → `process.stderr.write()` 或 `console.error()`。
2.  **优先使用结构化原语**:
    *   长耗时操作必须使用 `createProgress()` 而非手动 `console.log`。
    *   关键状态变更应通过 `createAuditWriter` 记录到 JSONL，而非仅依赖控制台输出。
3.  **并发日志使用前缀**:
    *   在可能并发执行的上下文中（如 Sync），必须使用 `slog`/`serr` 并包裹在 `withSourcePrefix` 中，禁止直接使用 `console.log`。
4.  **错误抛出规范**:
    *   操作层错误应抛出 `OperationError` 或 `StructuredAgentError`，携带明确的 `code` 以便上层分类处理。
5.  **静默失败原则**:
    *   审计写入、后台心跳、非关键遥测数据的失败不应抛出异常，而应记录到 stderr 并继续执行。