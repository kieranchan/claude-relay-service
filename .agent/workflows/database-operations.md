---
description: 数据库操作和 Prisma 命令
---

# 数据库操作工作流

## 启动数据库

**重要：Claude Code 无法自动启动数据库，需要用户手动执行：**
```bash
cd F:\WorkSpace\WebStorm\claude-relay-service
prisma dev
```

启动后按 `h` 或 `t` 可查看配置信息。

## Prisma 常用命令

// turbo
生成 Prisma 客户端：
```bash
npx prisma generate
```

// turbo
同步 schema 到数据库：
```bash
npx prisma db push
```

打开数据库管理界面：
```bash
npx prisma studio
```

创建并应用迁移：
```bash
npx prisma migrate dev
```

## 订单系统测试

1. 用户启动数据库：`prisma dev`
2. 启动服务：`npm run dev`
3. 运行订单测试：`npm run test:orders`

测试脚本位置：`scripts/test-orders-api.js`

## 数据库连接配置

开发环境需要：
- `pgbouncer=true&connection_limit=1` 避免 prepared statement 冲突
- `SKIP_EMAIL_VERIFICATION=true` 跳过邮箱验证
