# 邮箱认证 API 文档

> 版本：v1.0
> 更新日期：2025-12-26

---

## 概述

邮箱认证系统是独立于 LDAP 的用户认证方案，支持：
- 用户注册/登录
- 邮箱验证
- 密码重置
- JWT 双 Token 机制（Access Token + Refresh Token）
- 用户 API Key 管理

---

## 环境变量配置

```bash
# 启用邮箱认证（默认关闭）
EMAIL_AUTH_ENABLED=true
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
MAX_EMAIL_USER_API_KEYS=3
ALLOW_EMAIL_USER_DELETE_API_KEYS=false

# SMTP 配置（必需）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password    # Gmail 需使用 App Password
EMAIL_FROM=your-email@gmail.com
SMTP_TLS_REJECT_UNAUTHORIZED=true

# 应用 URL（用于邮件中的链接）
APP_URL=http://localhost:3000
```

### Gmail App Password 获取步骤

1. 登录 Google 账号，启用两步验证
2. 访问 https://myaccount.google.com/apppasswords
3. 选择「邮件」和「其他（自定义名称）」
4. 生成 16 位 App Password（格式：xxxx xxxx xxxx xxxx）
5. 将密码填入 `SMTP_PASSWORD`（去掉空格）

---

## API 端点

### 认证相关

#### 用户注册

```
POST /api/v1/auth/register
```

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**成功响应 (201)：**
```json
{
  "success": true,
  "message": "注册成功，请查收验证邮件",
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "emailVerified": false
  }
}
```

---

#### 用户登录

```
POST /api/v1/auth/login
```

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "User Name",
      "emailVerified": true
    }
  }
}
```

---

#### 用户登出

```
POST /api/v1/auth/logout
```

**请求头：**
```
Authorization: Bearer <accessToken>
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

#### 刷新 Token

```
POST /api/v1/auth/refresh
```

**请求体：**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-jwt-refresh-token",
    "expiresIn": 3600
  }
}
```

---

#### 邮箱验证（API）

```
GET /api/v1/auth/verify-email?token=<verification-token>
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "邮箱验证成功"
}
```

---

#### 邮箱验证（网页）

```
GET /verify-email?token=<verification-token>
```

**响应：** HTML 页面，显示验证成功或失败信息

---

#### 重发验证邮件

```
POST /api/v1/auth/resend-verification
```

**请求体：**
```json
{
  "email": "user@example.com"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "验证邮件已发送"
}
```

---

#### 忘记密码

```
POST /api/v1/auth/forgot-password
```

**请求体：**
```json
{
  "email": "user@example.com"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "重置密码邮件已发送"
}
```

---

#### 重置密码

```
POST /api/v1/auth/reset-password
```

**请求体：**
```json
{
  "token": "reset-token",
  "newPassword": "new-password"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "密码重置成功"
}
```

---

### 用户相关

#### 获取用户信息

```
GET /api/v1/user/profile
```

**请求头：**
```
Authorization: Bearer <accessToken>
```

**成功响应 (200)：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "User Name",
    "emailVerified": true,
    "createdAt": "2025-12-26T00:00:00.000Z"
  }
}
```

---

#### 更新用户信息

```
PUT /api/v1/user/profile
```

**请求头：**
```
Authorization: Bearer <accessToken>
```

**请求体：**
```json
{
  "displayName": "New Display Name"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "用户信息更新成功",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "New Display Name"
  }
}
```

---

#### 修改密码

```
PUT /api/v1/user/password
```

**请求头：**
```
Authorization: Bearer <accessToken>
```

**请求体：**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

---

#### 获取用户 API Keys

```
GET /api/v1/user/api-keys
```

**请求头：**
```
Authorization: Bearer <accessToken>
```

**成功响应 (200)：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "My API Key",
      "keyPreview": "cr_****abcd",
      "createdAt": "2025-12-26T00:00:00.000Z",
      "lastUsedAt": "2025-12-26T00:00:00.000Z"
    }
  ]
}
```

---

#### 创建 API Key

```
POST /api/v1/user/api-keys
```

**请求头：**
```
Authorization: Bearer <accessToken>
```

**请求体：**
```json
{
  "name": "My API Key"
}
```

**成功响应 (201)：**
```json
{
  "success": true,
  "message": "API Key 创建成功",
  "data": {
    "id": "uuid",
    "name": "My API Key",
    "key": "cr_xxxxxxxxxxxxxxxx"
  }
}
```

> 注意：完整的 API Key 只在创建时返回一次，请妥善保存

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| AUTH_EMAIL_EXISTS | 邮箱已被注册 |
| AUTH_INVALID_CREDENTIALS | 邮箱或密码错误 |
| AUTH_EMAIL_NOT_VERIFIED | 邮箱未验证 |
| AUTH_TOKEN_INVALID | Token 无效或已过期 |
| AUTH_TOKEN_EXPIRED | Token 已过期 |
| AUTH_UNAUTHORIZED | 未授权访问 |
| USER_NOT_FOUND | 用户不存在 |
| API_KEY_LIMIT_REACHED | API Key 数量已达上限 |

---

## 测试脚本

```bash
node scripts/test-email-auth.js
```

---

## 相关文件

- `src/routes/emailAuthRoutes.js` - 认证路由
- `src/routes/emailUserRoutes.js` - 用户路由
- `src/services/emailAuth/emailAuthService.js` - 认证服务
- `src/services/emailAuth/emailUserService.js` - 用户服务
- `src/services/emailAuth/emailService.js` - 邮件服务
- `src/services/emailAuth/tokenService.js` - Token 服务
- `src/middleware/authenticateJwt.js` - JWT 认证中间件
