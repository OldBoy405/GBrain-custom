GBrain 采用**三层混合配置架构**，将静态文件、环境变量与动态数据库存储相结合，以支持从本地 CLI 到远程 MCP 服务的多种部署拓扑。其核心设计目标是实现“文件定义基础、环境提供逃逸、数据库驱动运行时”的灵活性与安全性。

### 1. 配置层级与优先级
系统遵循严格的优先级顺序（从高到低）：
1. **环境变量 (Environment Variables)**：作为最高优先级的“操作员逃逸舱口”。支持通用变量（如 `OPENAI_API_KEY`）和命名空间变量（如 `GBRAIN_DATABASE_URL`）。
2. **文件配置 (`~/.gbrain/config.json`)**：持久化的机器级配置，由 `gbrain init` 或 `gbrain config set` 生成。包含引擎选择、API 密钥及默认模型。
3. **数据库配置 (DB Plane)**：存储在 Postgres/PGLite 的 `config` 表中。用于运行时动态调整的开关（如搜索模式、内容完整性阈值、多模态标志）。
4. **代码默认值**：当上述层级均未定义时使用的硬编码默认值。

### 2. 核心组件与逻辑
- **`src/core/config.ts`**：配置系统的中枢。
  - `loadConfig()`：同步加载文件与环境变量。实现了 **#427 防护机制**，自动忽略当前工作目录 `.env` 文件中定义的 `DATABASE_URL`，防止在开发其他 Web 应用时意外连接到错误的数据库。
  - `loadConfigWithEngine()`：异步加载，在引擎连接后从数据库读取配置并合并到文件/环境配置中。
  - `saveConfig()`：将配置写入 `~/.gbrain/config.json`，并自动确保该目录下的 `.gitignore` 存在以防止敏感数据泄露。
  - `GBRAIN_HOME`：支持通过环境变量自定义配置根目录，便于多租户或测试隔离。
- **`src/commands/config.ts`**：CLI 交互层。
  - 提供 `show`, `get`, `set`, `unset` 命令。
  - **安全红act**：自动检测并隐藏敏感字段（如 `api_key`, `secret`），防止密钥在终端历史或截图中泄露。
  - **严格校验**：对 `embedding_model` 等影响 Schema 大小的关键字段禁止通过 DB 平面修改，强制要求重新初始化；对未知配置键提供 Levenshtein 距离建议。
- **`gbrain.yml`**：项目级存储策略配置。定义哪些目录受版本控制（`db_tracked`），哪些仅由数据库持久化（`db_only`），指导 `gbrain sync` 的行为。

### 3. 关键约定与规则
- **敏感信息处理**：API 密钥应优先通过环境变量注入。若存入 `config.json`，CLI 展示时会自动脱敏。
- **Schema  sizing 字段**：`embedding_model` 和 `embedding_dimensions` 属于“文件平面”配置。修改它们不会立即生效，必须通过 `gbrain init` 重新初始化数据库以调整列类型。
- **远程客户端配置**：支持 `remote_mcp` 块，允许将本地 CLI 配置为远程 GBrain 服务的瘦客户端，此时本地不再维护数据库连接。
- **内容完整性 (Content Sanity)**：通过 `content_sanity` 块配置页面大小警告阈值、垃圾内容处置方式（隔离或拒绝）等，支持通过环境变量 `GBRAIN_NO_SANITY=1` 全局禁用检查。