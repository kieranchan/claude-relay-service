# 开发指南

## 常用命令

### 基础命令

```bash
# 安装依赖和初始化
npm install
npm run setup                  # 生成配置和管理员凭据
npm run install:web           # 安装 Web 界面依赖

# 开发和运行
npm run dev                   # 开发模式（热重载）
npm start                     # 生产模式
npm test                      # 运行测试
npm run lint                  # 代码检查

# 服务管理
npm run service:start:daemon  # 后台启动（推荐）
npm run service:status        # 查看状态
npm run service:logs          # 查看日志
npm run service:stop          # 停止服务

# 数据库 (PostgreSQL/Prisma)
# 注意：务必在独立的终端中手动运行
prisma dev                    # 启动本地开发数据库 (端口 51214)

npx prisma generate           # 生成客户端
npx prisma db push            # 同步 Schema
npx prisma studio             # 打开数据库管理界面
npx prisma migrate dev        # 创建迁移
```

## 环境配置

### 必需变量
- `JWT_SECRET`: 32 字符以上的随机字符串。
- `ENCRYPTION_KEY`: 32 字符的固定长度密钥。
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`。

### 重要可选变量
- `USER_MANAGEMENT_ENABLED`: 启用用户系统（默认 false）。
- `WEBHOOK_ENABLED`: 启用 Webhook。
- `DEBUG_HTTP_TRAFFIC`: 启用 HTTP 调试日志（仅开发环境）。
- `PROXY_USE_IPV4`: 强制代理使用 IPv4。
- `METRICS_WINDOW`: 实时统计窗口（分钟）。

### AWS Bedrock 配置
- `CLAUDE_CODE_USE_BEDROCK=1`
- `AWS_REGION`, `ANTHROPIC_MODEL` 等。

## 最佳实践

### 代码格式化
- **必须使用 Prettier**。
- 后端: `npx prettier --write <file>`
- 前端: `npx prettier --write <file>` (使用 Tailwind 插件)
- 检查: `npx prettier --check <file>` 或 `npm run format`

### 前端开发
- **响应式**: 使用 Tailwind 前缀 (`sm:`, `md:`, `lg:`, `xl:`)。
- **暗黑模式**: 必须支持双模式，使用 `dark:` 前缀。
- **主题**: 使用 `stores/theme.js` 中的 `useThemeStore()`。

### 测试
- 运行 `npm test` (Jest + SuperTest)。
- 运行 `npm run lint`。
- 使用 `npm run cli status` 验证。
- **清理**: 测试后务必杀死 node 进程 (`taskkill /F /IM node.exe`)。

## 重要端点 (Endpoints)

### 转发端点 (Relay)
- `POST /api/v1/messages` (Claude)
- `POST /gemini/v1/models/:model:generateContent` (Gemini)
- `POST /openai/v1/chat/completions` (OpenAI 兼容)
- `POST /droid/...` (Factory.ai)

### 管理端点 (Admin)
- `POST /admin/claude-accounts/generate-auth-url`
- `GET /health`
- `GET /metrics`
- `GET /admin/dashboard`

## 故障排查 (Troubleshooting)

### OAuth 问题
1. **代理错误**: 检查代理配置；OAuth Token 交换也需要代理。
2. **无效代码**: 确保复制了完整的授权码 (Auth Code)。
3. **刷新失败**: 检查 Refresh Token 有效性。

### 常见开发问题
- **Redis 连接**: 检查 host/port/password。
- **管理员登录**: 检查 `data/init.json`。
- **API Key 格式**: 必须以 `cr_` 开头（或配置的前缀）。
- **粘性会话失效**: 检查 `STICKY_SESSION_TTL_HOURS`；Nginx 需要配置 `underscores_in_headers on;`。
- **队列超时**: 检查 `concurrentRequestQueueTimeoutMs` 与代理超时时间的设置。

## CLI 工具
```bash
npm run cli keys list
npm run cli status
npm run cli accounts list
npm run data:export
npm run data:debug
```
