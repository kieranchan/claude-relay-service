---
description: 开发服务器启动和管理
---

# 开发服务器工作流

## 启动开发服务

// turbo
开发模式（热重载）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## 服务管理

后台启动（推荐）：
```bash
npm run service:start:daemon
```

查看服务状态：
```bash
npm run service:status
```

// turbo
查看日志：
```bash
npm run service:logs
```

停止服务：
```bash
npm run service:stop
```

## Docker 部署

基本部署：
```bash
docker-compose up -d
```

包含监控：
```bash
docker-compose --profile monitoring up -d
```

## 进程清理

**重要：测试完成后必须关闭所有启动的程序！**

检查残留进程：
```bash
tasklist | findstr node
```

强制关闭：
```bash
taskkill /F /PID <pid>
```

## 健康检查

访问健康检查端点：
- `GET /health` - 系统状态
- `GET /metrics` - 系统指标

## 日志位置

- 应用主日志：`logs/claude-relay-*.log`
- Token 刷新错误：`logs/token-refresh-error.log`
- Webhook 日志：`logs/webhook-*.log`
- HTTP 调试日志：`logs/http-debug-*.log`
