# Gemini 规则 (Gemini Rules)

本文件为 Gemini (或其他 AI Agent) 在此代码库中工作提供指导。

## 🚨 核心规则 (必需遵守)

### 1. 命令行执行 (Windows)
> 参考: `.agent/workflows/command-execution.md`
- **严禁** 直接使用 `run_command` 执行具体命令（例如 `npm run dev`）。
- **必须** 使用两步走流程：
  1. `run_command(CommandLine="cmd", ...)` 启动终端。
  2. `send_command_input(...)` 发送实际命令。
- **原因**: Windows 下 `run_command` 经常只打开终端而不执行命令。

### 2. 新功能开发工作流
> 参考: `.agent/workflows/feature-development.md`
- **严格遵循 7 阶段工作流** 进行所有新功能开发。
- **服务模块化**：
  - **必须** 在 `src/services/<feature>/` 中创建模块化服务（如 core, stats, formatter, index.js）。
  - **禁止** 创建巨型单文件服务。
- **API 文档**：
  - **必须** 创建 `docs/api/<feature>/openapi.yaml` 和 `README.md`。

### 3. 数据库操作
- **严禁** 尝试在后台自动启动 `prisma dev`。
- **必须** 请求用户手动使用 `prisma dev` 启动数据库。
- **仅在** 用户确认数据库运行后，才可执行 `npx prisma db push` 或迁移命令。

### 4. 进程清理
- **强制要求**：测试/验证完成后，**必须** 关闭所有启动的后台进程。
- 使用 `tasklist | findstr node` 检查。
- 使用 `taskkill /F /IM node.exe` (或指定 PIDs) 强制关闭。

---

## 📋 统一工作流标准 (Universal Workflow Standards)

这些标准适用于 `.agent/workflows/` 下定义的所有工作流：

1.  **工作流选择机制**:
    - 始终选择针对性最强的工作流（例如做新功能时选 `/feature-development` 而不是只选 `/git-commit`）。
    - 如果用户指定 Slash 命令（如 `/code-quality`），则严格执行。

2.  **执行完整性 (Execution Integrity)**:
    - **// turbo**: 标记此注释的步骤可自动执行 (设置 `SafeToAutoRun: true`)。
    - **// turbo-all**: 文件顶部如有此标记，则全流程步骤均可自动执行。
    - **默认安全**: 如果没有 turbo 标记，涉及状态变更的命令默认需要用户批准。

3.  **环境稳定性**:
    - 不要在环境中留下脏状态（如残留进程）。
    - 始终根据核心规则 #4 进行清理。

---

## 📚 文档索引

> **无需重复造轮子**：关于项目架构和详细开发指南，请直接参考以下中文文档。

- **系统架构与组件**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **开发指南与常用命令**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

**PostgreSQL 数据库启动命令：**
```bash
cd F:\WorkSpace\WebStorm\claude-relay-service
prisma dev
```

**订单支付系统测试流程：**
```bash
prisma dev              # 1. 启动数据库（用户手动执行）
npm run dev             # 2. 启动服务
npm run test:orders     # 3. 运行订单 API 测试
```
