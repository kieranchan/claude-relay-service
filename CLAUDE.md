# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作提供指导。

> **📚 文档索引**:
> - **架构与组件**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> - **开发指南与命令**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
> - **工作流规范**: [.agent/workflows/](.agent/workflows/)

## ⚠️ 核心规则 (必需遵守)

### 1. 命令行执行 (Windows)
> 参考: 全局命令执行标准 (Global Command Execution)
- **严禁** 直接使用 `run_command` 执行具体命令（例如 `npm run dev`）。
- **必须** 使用两步走流程：
  1. `run_command(CommandLine="cmd", ...)` 启动终端。
  2. `send_command_input(...)` 发送实际命令。

### 2. 新功能开发工作流
> 参考: `.agent/workflows/feature-development.md`
- **严格遵循 7 阶段工作流** 进行所有新功能开发。
- **服务模块化**：必须在 `src/services/<feature>/` 中创建模块化服务。**禁止** 创建巨型单文件服务。
- **API 文档**：必须创建 `docs/api/<feature>/openapi.yaml` 和 `README.md`。

### 3. 数据库操作
> 参考: `.agent/workflows/database-operations.md`
- **严禁** 尝试在后台自动启动 `prisma dev`。
- **必须** 请求用户手动使用 `prisma dev` 启动数据库。
- **仅在** 用户确认数据库运行后，才可执行 `npx prisma db push` 或迁移命令。

### 4. 进程清理
- **强制要求**：测试/验证完成后，**必须** 关闭所有启动的后台进程。
- 使用 `tasklist | findstr node` 检查。
- 使用 `taskkill /F /IM node.exe` (或指定 PIDs) 强制关闭。

---

## 🛠️ 统一工作流标准 (Unified Workflow Standards)

- **工作流选择**: 始终选择针对性最强的工作流。
- **// turbo**: 标记此注释的步骤可自动执行。
- **// turbo-all**: 文件顶部如有此标记，则全流程步骤均可自动执行。
- **环境稳定性**: 不要在环境中留下脏状态（残留进程等）。

---

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
