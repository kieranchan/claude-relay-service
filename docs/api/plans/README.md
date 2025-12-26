# 套餐管理 API

套餐管理系统提供套餐的 CRUD 操作，支持订阅制和一次性套餐。

## 环境变量配置

套餐管理功能需要 PostgreSQL 数据库。请在 `.env` 中配置以下变量：

```bash
# PostgreSQL 配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=claude_relay
DB_USER=crs_user
DB_PASSWORD=your_secure_password
DATABASE_URL=postgresql://crs_user:your_secure_password@localhost:5432/claude_relay
```

## 数据库初始化

### 使用 Prisma（推荐）

```bash
# 生成 Prisma Client
npm run db:generate

# 推送 Schema 到数据库
npm run db:push

# 填充示例数据
npm run db:seed:plans
```

### 使用原生 SQL

```bash
psql -U crs_user -d claude_relay -f scripts/create-plans-table.sql
```

## API 端点

### 公开接口（无需认证）

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/plans` | 获取套餐列表 |
| GET | `/api/v1/plans/:id` | 获取套餐详情 |

### 管理员接口（需要认证）

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/plans/admin/list` | 获取所有套餐（含下架） |
| POST | `/api/v1/plans/admin` | 创建套餐 |
| PUT | `/api/v1/plans/admin/:id` | 更新套餐 |
| DELETE | `/api/v1/plans/admin/:id` | 删除套餐 |
| POST | `/api/v1/plans/admin/:id/toggle` | 上下架套餐 |
| GET | `/api/v1/plans/admin/:id/stats` | 获取套餐统计 |

## 使用示例

### 获取套餐列表

```bash
curl http://localhost:3000/api/v1/plans
```

响应：

```json
{
  "success": true,
  "data": [
    {
      "id": "basic_monthly",
      "name": "基础版",
      "price": 49.00,
      "billing_cycle": "monthly",
      "features": {...}
    }
  ],
  "meta": {
    "total": 5
  }
}
```

### 创建套餐（管理员）

```bash
curl -X POST http://localhost:3000/api/v1/plans/admin \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "pro_monthly",
    "name": "专业版",
    "type": "subscription",
    "price": 99,
    "billing_cycle": "monthly",
    "features": {
      "quota": {
        "daily_requests": 300,
        "monthly_tokens": 5000000
      },
      "services": {
        "claude_code": true,
        "gemini_cli": true
      }
    }
  }'
```

### 更新套餐

```bash
curl -X PUT http://localhost:3000/api/v1/plans/admin/pro_monthly \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 79,
    "is_popular": true
  }'
```

### 上下架套餐

```bash
# 下架
curl -X POST http://localhost:3000/api/v1/plans/admin/pro_monthly/toggle \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "inactive"}'

# 上架
curl -X POST http://localhost:3000/api/v1/plans/admin/pro_monthly/toggle \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

## 功能配置结构

套餐的 `features` 字段支持以下配置：

```json
{
  "quota": {
    "daily_requests": 100,
    "monthly_tokens": 1000000,
    "concurrent_requests": 3,
    "quota_reset": "daily"
  },
  "services": {
    "claude_code": true,
    "gemini_cli": true,
    "codex": false,
    "droid": false
  },
  "models": {
    "allowed": ["claude-sonnet-4-5", "gemini-2.5-pro"],
    "default": "claude-sonnet-4-5"
  },
  "api": {
    "enabled": false,
    "max_keys": 3,
    "key_rate_limit": 60
  },
  "advanced": {
    "priority_queue": false,
    "custom_proxy": false,
    "team_sharing": false,
    "data_export": false
  },
  "support": {
    "level": "standard",
    "response_time": "24h",
    "priority_support": false
  }
}
```

## 错误码

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| VALIDATION_ERROR | 400 | 参数验证失败 |
| PLAN_NOT_FOUND | 404 | 套餐不存在 |
| PLAN_EXISTS | 409 | 套餐ID已存在 |
| CANNOT_MODIFY | 400 | 有活跃订阅时不能修改核心配置 |
| HAS_ACTIVE_SUBSCRIBERS | 400 | 有活跃订阅，无法删除 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

## 测试

运行 API 测试脚本：

```bash
node scripts/test-plans-api.js http://localhost:3000 YOUR_ADMIN_TOKEN
```
