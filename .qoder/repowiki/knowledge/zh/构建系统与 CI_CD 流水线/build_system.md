## 1. 核心构建体系
项目采用 **Bun** 作为唯一的运行时、包管理器及构建工具。核心架构围绕 TypeScript 编写，通过 `bun build --compile` 生成原生二进制文件，并利用 Docker Compose 实现高度隔离的本地与 CI 测试环境。

### 关键工具链
- **Runtime & Bundler**: Bun (>=1.3.10)
- **Language**: TypeScript
- **Containerization**: Docker Compose (用于多实例 Postgres/pgvector 集群)
- **CI Platform**: GitHub Actions
- **Security Scanning**: Gitleaks ( secrets detection)

## 2. 构建与打包流程
### 二进制编译
项目通过 `bun build --compile` 将 CLI 入口 (`src/cli.ts`) 编译为单文件原生可执行文件。支持跨平台交叉编译：
- **Darwin ARM64**: `bin/gbrain-darwin-arm64`
- **Linux x64**: `bin/gbrain-linux-x64`

### 管理控制台嵌入 (Admin Embedding)
由于 Bun 编译器不直接支持嵌入任意资源目录，项目采用**代码生成**策略：
1. 使用 Vite 构建 React 管理界面至 `admin/dist/`。
2. 运行 `scripts/build-admin-embedded.ts` 扫描产物，生成 `src/admin-embedded.ts`。
3. 该脚本利用 Bun 的 `import ... with { type: 'file' }` 特性，将静态资源以 ESM 导入形式硬编码进二进制文件中，确保全局安装后 `/admin` 路由可用。

## 3. 测试架构与分片策略
测试套件规模庞大，采用了精细的**分片 (Sharding)** 与**隔离 (Isolation)** 机制以优化并行效率并消除竞态条件。

### 单元测试 (Unit Tests)
- **并行分片**: 使用 `scripts/run-unit-parallel.sh` 根据 CPU 核心数（默认 4 片）自动分配测试文件。
- **权重感知调度**: 通过 `scripts/sharding.ts` 和 `scripts/test-weights.json` 实现基于历史运行时间的 LPT (Longest Processing Time) 负载均衡，避免长耗时测试阻塞整体进度。
- **串行测试**: 标记为 `.serial.test.ts` 的文件在并行阶段后单独以 `--max-concurrency=1` 运行，防止全局 Mock 或环境变量污染。

### 端到端测试 (E2E Tests)
- **数据库隔离**: 为解决多个测试文件共享同一 Postgres 导致的 `TRUNCATE CASCADE` 竞态问题，CI 环境启动 **4 个独立的 pgvector 容器** (ports 5434-5437)。
- **分片执行**: `scripts/run-e2e.sh` 支持 `SHARD=N/M` 环境变量，将 36+ 个 E2E 测试文件均匀分配至 4 个数据库实例并行执行。
- **环境净化**: 测试运行前强制重置 `HOME` 和 `GBRAIN_HOME` 至临时目录，并清除所有操作者上下文环境变量（如 `CONDUCTOR_*`, `MCP_*`），确保测试的绝对幂等性。

## 4. CI/CD 流水线 (GitHub Actions)
### 智能缓存门禁 (Cache-based Gate)
- **内容哈希校验**: `cache-check` 任务计算除文档外所有跟踪文件的哈希值。若命中 `actions/cache`，则直接跳过所有测试任务并报告成功，显著减少文档更新或微小改动时的 CI 耗时。
- **写回机制**: 仅当所有测试任务成功后，`cache-write` 才会更新缓存条目，防止错误状态被固化。

### 任务矩阵
- **Verify**: 并行运行 20+ 项自定义检查脚本（隐私合规、JSONB 模式、WASM 嵌入等）及 TypeScript 类型检查。
- **Test Matrix**: 10 个并行分片运行单元测试。
- **Heavy/Slow Tests**: 超长耗时测试（如 LongMemEval, Entity Resolve Perf）被剥离出主矩阵，在独立 Runner 中运行以避免拖累整体吞吐。

## 5. 开发者规范
- **本地 CI 模拟**: 必须使用 `bun run ci:local` 在本地复现完整的 CI 门禁。该命令会在 Docker 中拉起 4 个 Postgres 实例并运行全量分片测试。
- **增量测试**: 使用 `bun run ci:local:diff` 可根据 Git 差异智能跳过纯文档变更的测试流程。
- **Admin 同步**: 修改 `admin/` 源码后，必须重新运行 `bun run build:admin` 以更新嵌入式资源，否则 CI 中的 `check-admin-embedded` 门禁将失败。