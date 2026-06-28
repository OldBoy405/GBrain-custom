GBrain 项目采用 **Bun** 作为核心的包管理器、运行时和构建工具，通过 `bun.lock` 实现确定性的依赖解析。项目采用多工作区（Monorepo-lite）结构，将核心后端逻辑与管理控制台前端（Admin）的依赖分离管理。

### 1. 核心依赖管理系统
- **包管理器**: 统一使用 `bun` (v1.3.13+)。根目录的 `package.json` 定义了 CLI 和核心引擎的依赖，而 `admin/package.json` 独立管理基于 React/Vite 的前端依赖。
- **锁定文件**: 使用 `bun.lock` (Lockfile v1) 确保依赖版本的确定性。根目录和 `admin` 目录下各有一个独立的 lock 文件，表明两者在依赖安装上是解耦的。
- **版本策略**: 
  - 核心依赖如 `@electric-sql/pglite` 被严格锁定为特定版本 (`0.4.3`)，以确保嵌入式数据库行为的一致性。
  - AI SDK 相关依赖（如 `@ai-sdk/anthropic`, `ai`）使用较新的语义化版本范围，以获取最新的功能支持。
  - `trustedDependencies` 中显式声明了 `@electric-sql/pglite`，允许其在安装时执行必要的构建脚本（如 WASM 编译或二进制下载）。

### 2. 依赖隔离与构建
- **前端隔离**: `admin` 目录作为一个独立的模块，拥有自己的 `node_modules` 作用域（通过独立的 `package.json` 和 `bun.lock`）。这避免了前端庞大的 UI 依赖污染后端 CLI 的运行环境。
- **构建集成**: `package.json` 中的 `build:admin` 脚本展示了依赖的构建流程：先在 `admin` 目录下执行 `bun run build`，然后通过 `scripts/build-admin-embedded.ts` 将构建产物嵌入到主应用中，实现了前后端产物的最终合并。

### 3. CI/CD 中的依赖缓存与优化
- **智能缓存**: GitHub Actions (`.github/workflows/test.yml`) 引入了基于内容哈希的缓存机制 (`ci-cache-hash.sh`)。如果代码变更仅涉及文档等非代码文件，CI 会直接跳过依赖安装和测试阶段。
- **依赖缓存**: 使用 `actions/cache` 缓存 `~/.bun/install/cache`，缓存键基于 `bun.lock` 的哈希值。这显著减少了 `bun install` 在网络受限或高负载环境下的执行时间。
- **并行分片**: 测试阶段通过 `scripts/test-shard.sh` 将测试任务分片，每个分片独立运行 `bun install` 和测试，利用 Bun 的快速启动特性优化并行效率。

### 4. 开发者规范
- **安装命令**: 必须使用 `bun install` 而非 `npm install` 或 `yarn`，以确保 `bun.lock` 的正确更新和原生模块（如 PGLite）的正确构建。
- **版本同步**: 修改 `package.json` 后必须提交更新后的 `bun.lock`。CI 会通过 `--frozen-lockfile` 模式（在 `scripts/ci-local.sh` 中体现）验证锁文件的一致性。
- **环境一致性**: `bunfig.toml` 配置了全局测试超时和预加载脚本，确保所有开发者和 CI 环境在相同的依赖初始化状态下运行测试。