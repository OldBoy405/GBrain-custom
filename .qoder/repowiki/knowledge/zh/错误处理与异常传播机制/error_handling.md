gbrain 采用分层、结构化的错误处理架构，旨在区分可重试的瞬时故障、用户配置错误和程序逻辑错误，并为自动化代理（Agent）提供机器可读的错误上下文。

### 1. 核心错误类型体系
代码库定义了三种主要的错误抽象，分别服务于不同的调用场景：

*   **`GBrainError` (src/core/types.ts)**:
    *   **用途**: 核心引擎层的基础错误类型，用于表示系统级或配置级故障。
    *   **结构**: 包含 `problem` (问题摘要), `cause_description` (原因描述), `fix` (修复建议) 和可选的 `docs_url`。
    *   **场景**: 数据库连接失败 (`No database connection`)、配置缺失等。它通过构造函数生成人类可读的消息，同时保留结构化字段供 CLI 或 UI 展示修复指南。

*   **`StructuredAgentError` (src/core/errors.ts)**:
    *   **用途**: 专为 Agent 消费设计的错误信封（Envelope）。
    *   **结构**: 包含 `class` (错误类名), `code` (机器可读的稳定代码，如 `cost_preview_requires_yes`), `message`, `hint` (操作提示) 和 `docs_url`。
    *   **场景**: CLI 命令输出 JSON 时，Agent 需要区分“可重试”与“致命”错误，或获取具体的恢复指令（例如“请传递 --yes 以继续”）。`serializeError` 工具函数负责将未知异常标准化为此格式。

*   **`OperationError` (src/core/operations.ts)**:
    *   **用途**: MCP 服务器和操作层（Operations）的标准错误。
    *   **结构**: 继承自 `Error`，包含 `code` (开放联合类型 `ErrorCode`)，`suggestion` 和 `docs`。
    *   **场景**: 参数校验失败 (`invalid_params`)、页面未找到 (`page_not_found`)、权限拒绝等。它实现了 `toJSON()` 方法，确保在 MCP 协议中传输时保持结构一致。

### 2. 重试与瞬时故障处理
针对数据库连接和批量写入中的瞬时故障，gbrain 实现了精细的重试机制：

*   **错误分类 (`src/core/retry-matcher.ts`)**:
    *   `isRetryableConnError`: 识别连接重置、池化器重启、认证竞争等 transient 错误（匹配 SQLSTATE `08xxx` 或特定消息模式）。
    *   `isStatementTimeoutError`: 识别语句超时（SQLSTATE `57014`），通常不视为连接错误，需不同退避策略。
    *   `isConnectionEndedError`: 专门识别 postgres.js 的 `CONNECTION_ENDED` 库级错误。

*   **通用重试包装器 (`src/core/retry.ts`)**:
    *   `withRetry(fn, opts)`: 支持指数退避（Exponential Backoff）和去相关抖动（Decorrelated Jitter）。
    *   **Supavisor 调优**: 默认配置 `BULK_RETRY_OPTS` (3次重试, 1s-10s 延迟) 专门针对 Supabase Supavisor 池化器的电路断路器恢复窗口（5-10s）进行了优化。
    *   **重连钩子**: 支持 `reconnect` 回调，在重试前尝试重建连接池，若重连失败则直接抛出真实原因而非掩盖为“无连接”。

*   **同步失败账本 (`src/core/sync-failure-ledger.ts`)**:
    *   对于文件导入中的持久性错误（如 YAML 解析失败、Slug 不匹配），系统不再无限重试，而是记录到 `~/.gbrain/sync-failures.jsonl`。
    *   **自动跳过**: 连续失败 N 次（默认 3 次）的文件会被自动标记为 `auto_skipped`，防止单个损坏文件阻塞整个索引进程，同时通过 `gbrain doctor` 向用户报告。

### 3. 超时与资源管理
*   **操作超时 (`src/core/timeout.ts`)**:
    *   `withTimeout(promise, ms, label)`: 使用 `Promise.race` 实现用户态超时，抛出 `OperationTimeoutError`。
    *   **注意**: 该超时仅限制等待时间，不取消底层异步操作（如 AI SDK 调用或 DB 查询），依赖进程退出或 `AbortSignal` 进行真正的资源清理。

*   **连接池安全关闭 (`src/core/db.ts`)**:
    *   `endPoolBounded`: 在断开数据库连接时设置硬上限（默认 2.5s），防止因 PgBouncer 事务模式下的挂起连接导致 CLI 退出时阻塞或截断输出。

### 4. 迁移与架构漂移
*   **迁移错误 (`src/core/migrate.ts`)**:
    *   `MigrationDriftError`: 当迁移后的 schema 状态与预期不符时抛出，要求用户使用 `--skip-verify` 强制运行。
    *   `MigrationRetryExhausted`: 在多次重试后仍被锁阻塞时抛出，并提供终止后端进程的 SQL 建议。

### 5. 开发者规范
*   **禁止裸抛**: 在新 v0.18+ 表面（如 repos, code-def, sync）应优先使用 `errorFor` 或 `buildError` 创建结构化错误，而非直接 `throw new Error()`。
*   **重试去重**: 引擎层的批量原语（如 `addLinksBatch`）已内置 `withRetry`，调用方**严禁**再次包裹重试逻辑，以免产生指数级重试放大负载。
*   **错误序列化**: 所有面向 Agent 的 JSON 输出必须通过 `serializeError` 处理，确保错误字段的一致性。