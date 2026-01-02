# Claude Relay Service 邮箱登录功能实现文档

## 📋 项目概述

本文档描述如何在 Claude Relay Service 项目中添加邮箱登录功能，采用前后端分离架构，后端仅提供 RESTful API 接口。

### 设计原则

- ✅ 纯后端API设计，不修改现有前端页面
- ✅ 保持现有后台管理界面（/web）作为管理员入口
- ✅ 前后端完全分离，提高安全性
- ✅ 利用现有的 JWT + Redis 架构
- ✅ 支持双Token机制（Access Token + Refresh Token）

---

## 🎯 API架构设计

### 接口路径规划

```
现有架构：
/api/          - 现有的API（Claude中转等）
/web           - 现有后台管理界面（保持不变）

新增架构：
/api/v1/auth   - 用户认证相关接口
/api/v1/user   - 用户信息管理接口
```

---

## 📡 核心API端点设计

### 1. 认证模块 (`/api/v1/auth`)

| 方法 | 端点 | 描述 | 认证要求 |
|------|------|------|----------|
| POST | `/api/v1/auth/register` | 用户注册 | 否 |
| POST | `/api/v1/auth/login` | 用户登录 | 否 |
| POST | `/api/v1/auth/logout` | 用户登出 | 是 |
| POST | `/api/v1/auth/refresh` | 刷新Token | Refresh Token |
| POST | `/api/v1/auth/verify-email` | 验证邮箱 | 否（需要token参数） |
| POST | `/api/v1/auth/resend-verification` | 重发验证邮件 | 是 |
| POST | `/api/v1/auth/forgot-password` | 忘记密码 | 否 |
| POST | `/api/v1/auth/reset-password` | 重置密码 | 否（需要token参数） |
| POST | `/api/v1/auth/change-password` | 修改密码 | 是 |
| GET | `/api/v1/auth/check` | 检查登录状态 | 是 |

### 2. 用户模块 (`/api/v1/user`)

| 方法 | 端点 | 描述 | 认证要求 |
|------|------|------|----------|
| GET | `/api/v1/user/profile` | 获取当前用户信息 | 是 |
| PUT | `/api/v1/user/profile` | 更新用户信息 | 是 |
| GET | `/api/v1/user/keys` | 获取用户的API Keys | 是 |
| POST | `/api/v1/user/keys` | 创建新的API Key | 是 |
| DELETE | `/api/v1/user/keys/:id` | 删除API Key | 是 |
| GET | `/api/v1/user/usage` | 获取用户使用统计 | 是 |

---

## 🗄️ 数据存储结构

利用现有的 Redis 设计数据结构：

### 用户信息（Hash）

```redis
user:{userId} = {
  id: "uuid",
  email: "user@example.com",
  password_hash: "bcrypt_hash",
  email_verified: true/false,
  created_at: "timestamp",
  updated_at: "timestamp",
  status: "active/suspended",
  role: "user/admin"
}
```

### 邮箱到用户ID映射（String）

```redis
email_to_userid:{email} = userId
```

### 邮箱验证Token（String，带过期时间）

```redis
email_verify_token:{token} = {
  userId: "uuid",
  email: "user@example.com",
  expires_at: "timestamp"
}
# TTL: 24小时
```

### 密码重置Token（String，带过期时间）

```redis
password_reset_token:{token} = {
  userId: "uuid",
  expires_at: "timestamp"
}
# TTL: 1小时
```

### 登录失败记录（String，带过期时间）

```redis
login_fail:{email_or_ip} = count
# TTL: 15分钟
```

### 用户的API Keys（Set）

```redis
user_api_keys:{userId} = [keyId1, keyId2, ...]
```

### Refresh Token（String，带过期时间）

```redis
refresh_token:{token} = userId
# TTL: 7天或30天
```

### Token黑名单（String）

```redis
blacklist_token:{token} = true
# TTL: token剩余有效期
```

---

## 🔐 认证流程设计

### 双Token机制

#### Access Token（短期，15分钟-1小时）

```javascript
{
  type: 'access',
  userId: 'xxx',
  email: 'xxx',
  role: 'user/admin',
  exp: timestamp
}
```

#### Refresh Token（长期，7天-30天）

```javascript
{
  type: 'refresh',
  userId: 'xxx',
  exp: timestamp
}
```

### 认证流程

```
1. 用户登录 → 返回 Access Token + Refresh Token
2. 前端用 Access Token 访问 API
3. Access Token 过期 → 用 Refresh Token 刷新
4. Refresh Token 过期 → 需要重新登录
5. 用户登出 → 将 Token 加入黑名单
```

---

## 📋 API详细设计

### 1. 用户注册

**端点：** `POST /api/v1/auth/register`

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```

**响应（成功）：**
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

**响应（失败）：**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "该邮箱已被注册"
  }
}
```

---

### 2. 用户登录

**端点：** `POST /api/v1/auth/login`

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "emailVerified": true
    }
  }
}
```

**响应（失败 - 邮箱未验证）：**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_002",
    "message": "请先验证邮箱"
  }
}
```

**响应（失败 - 账号被锁定）：**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "登录失败次数过多，账号已被锁定15分钟"
  }
}
```

---

### 3. 刷新Token

**端点：** `POST /api/v1/auth/refresh`

**请求体：**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应（成功）：**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "expiresIn": 3600
  }
}
```

---

### 4. 验证邮箱

**端点：** `POST /api/v1/auth/verify-email`

**请求体：**
```json
{
  "token": "verification_token_from_email"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "邮箱验证成功"
}
```

---

### 5. 忘记密码

**端点：** `POST /api/v1/auth/forgot-password`

**请求体：**
```json
{
  "email": "user@example.com"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "密码重置邮件已发送，请查收"
}
```

---

### 6. 重置密码

**端点：** `POST /api/v1/auth/reset-password`

**请求体：**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "密码重置成功"
}
```

---

### 7. 修改密码

**端点：** `POST /api/v1/auth/change-password`

**请求头：**
```
Authorization: Bearer {accessToken}
```

**请求体：**
```json
{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

---

### 8. 用户登出

**端点：** `POST /api/v1/auth/logout`

**请求头：**
```
Authorization: Bearer {accessToken}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

### 9. 获取用户信息

**端点：** `GET /api/v1/user/profile`

**请求头：**
```
Authorization: Bearer {accessToken}
```

**响应（成功）：**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "status": "active"
  }
}
```

---

### 10. 获取API Keys

**端点：** `GET /api/v1/user/keys`

**请求头：**
```
Authorization: Bearer {accessToken}
```

**响应（成功）：**
```json
{
  "success": true,
  "data": [
    {
      "id": "key_id_1",
      "name": "My Key 1",
      "key": "cr_xxxxxxxx",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-02T00:00:00Z",
      "status": "active"
    }
  ]
}
```

---

### 11. 创建API Key

**端点：** `POST /api/v1/user/keys`

**请求头：**
```
Authorization: Bearer {accessToken}
```

**请求体：**
```json
{
  "name": "My New Key",
  "rateLimit": {
    "enabled": true,
    "requestsPerMinute": 60
  }
}
```

**响应（成功）：**
```json
{
  "success": true,
  "message": "API Key创建成功",
  "data": {
    "id": "key_id",
    "name": "My New Key",
    "key": "cr_xxxxxxxx",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 🔒 安全机制实现

### 1. 密码安全

```javascript
// 使用bcrypt加密
const bcrypt = require('bcrypt');
const saltRounds = 10;

// 注册时
const password_hash = await bcrypt.hash(password, saltRounds);

// 登录时
const isMatch = await bcrypt.compare(password, stored_hash);
```

**密码要求：**
- 最少8个字符
- 必须包含大小写字母
- 必须包含数字
- 建议包含特殊字符

---

### 2. 登录限制策略

```javascript
{
  maxAttempts: 5,           // 最多失败5次
  lockoutDuration: 900,     // 锁定15分钟（秒）
  trackBy: 'email_and_ip'   // 按邮箱+IP跟踪
}
```

**实现逻辑：**
1. 记录失败次数到 Redis：`login_fail:{email}:{ip}`
2. 达到上限后锁定账户
3. 15分钟后自动解锁（通过 Redis TTL）

---

### 3. Token黑名单机制

```javascript
// 登出时将token加入黑名单
const remainingTime = token.exp - Date.now();
await redis.setex(`blacklist_token:${token}`, remainingTime, 'true');
```

---

### 4. CORS配置

```javascript
// 在config/config.js中添加
cors: {
  allowedOrigins: [
    'https://your-frontend-domain.com',
    'http://localhost:5173' // 开发环境
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

---

### 5. 速率限制

```javascript
// 不同端点的速率限制
{
  register: '10 requests per hour per IP',
  login: '5 requests per minute per IP',
  'forgot-password': '3 requests per hour per email',
  api: '100 requests per hour per user'
}
```

---

## 📧 邮件服务集成

### 邮件服务类设计

```javascript
// src/services/EmailService.js

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  async sendVerificationEmail(email, token) {
    const verifyLink = `${process.env.APP_URL}/verify-email?token=${token}`;
    
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '验证您的邮箱',
      html: `
        <h2>欢迎注册！</h2>
        <p>请点击下面的链接验证您的邮箱：</p>
        <a href="${verifyLink}">验证邮箱</a>
        <p>此链接将在24小时后失效。</p>
      `
    });
  }

  async sendPasswordResetEmail(email, token) {
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;
    
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '重置您的密码',
      html: `
        <h2>密码重置请求</h2>
        <p>请点击下面的链接重置您的密码：</p>
        <a href="${resetLink}">重置密码</a>
        <p>此链接将在1小时后失效。</p>
        <p>如果您没有请求重置密码，请忽略此邮件。</p>
      `
    });
  }
}

module.exports = EmailService;
```

---

## 🛠️ 中间件设计

### 1. 认证中间件

```javascript
// src/middleware/authenticate.js

const jwt = require('jsonwebtoken');
const redis = require('../utils/redis');

async function authenticateUser(req, res, next) {
  try {
    // 1. 从Header中提取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_004', message: '未提供认证令牌' }
      });
    }

    const token = authHeader.substring(7);

    // 2. 验证token有效性
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. 检查是否在黑名单
    const isBlacklisted = await redis.get(`blacklist_token:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_005', message: '令牌已失效' }
      });
    }

    // 4. 将用户信息附加到req
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_006', message: '令牌已过期' }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_007', message: '无效的令牌' }
    });
  }
}

module.exports = { authenticateUser };
```

---

### 2. 权限中间件

```javascript
// src/middleware/authorize.js

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'AUTH_008', message: '需要管理员权限' }
    });
  }
  next();
}

function requireEmailVerified(req, res, next) {
  // 从数据库获取用户信息检查邮箱验证状态
  // 如果未验证则返回403
}

module.exports = { requireAdmin, requireEmailVerified };
```

---

### 3. 限流中间件

```javascript
// src/middleware/rateLimit.js

const redis = require('../utils/redis');

function createRateLimiter(options) {
  const { maxRequests, windowMs, keyGenerator } = options;
  
  return async (req, res, next) => {
    const key = keyGenerator(req);
    const current = await redis.incr(`rate_limit:${key}`);
    
    if (current === 1) {
      await redis.expire(`rate_limit:${key}`, Math.ceil(windowMs / 1000));
    }
    
    if (current > maxRequests) {
      return res.status(429).json({
        success: false,
        error: { 
          code: 'RATE_LIMIT', 
          message: '请求过于频繁，请稍后再试' 
        }
      });
    }
    
    next();
  };
}

// 使用示例
const loginRateLimit = createRateLimiter({
  maxRequests: 5,
  windowMs: 60000, // 1分钟
  keyGenerator: (req) => `${req.ip}:login`
});

module.exports = { createRateLimiter, loginRateLimit };
```

---

### 4. 输入验证中间件

```javascript
// src/middleware/validation.js

const { body, validationResult } = require('express-validator');

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('请提供有效的邮箱地址'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为8个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含大小写字母和数字'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('两次输入的密码不一致')
];

const loginValidation = [
  body('email').isEmail().withMessage('请提供有效的邮箱地址'),
  body('password').notEmpty().withMessage('请输入密码')
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '输入验证失败',
        details: errors.array()
      }
    });
  }
  next();
}

module.exports = {
  registerValidation,
  loginValidation,
  handleValidationErrors
};
```

---

## 📁 目录结构

```
src/
├── routes/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.js       // 认证路由
│   │   │   ├── user.js       // 用户路由
│   │   │   └── index.js      // v1路由汇总
│   │   └── index.js          // API路由入口
│   └── web.js                // 现有的web路由（保持不变）
├── controllers/
│   ├── AuthController.js     // 认证逻辑
│   ├── UserController.js     // 用户逻辑
├── services/
│   ├── EmailService.js       // 邮件服务
│   ├── TokenService.js       // Token管理
│   ├── UserService.js        // 用户服务
├── middleware/
│   ├── authenticate.js       // 认证中间件
│   ├── authorize.js          // 授权中间件
│   ├── rateLimit.js          // 限流中间件
│   ├── validation.js         // 输入验证
│   └── errorHandler.js       // 错误处理
├── models/
│   ├── User.js               // 用户模型（Redis操作封装）
│   └── ApiKey.js             // API Key模型
├── utils/
│   ├── validators.js         // 验证工具
│   ├── crypto.js             // 加密工具
│   ├── response.js           // 响应格式化
│   └── logger.js             // 日志工具
└── config/
    ├── constants.js          // 常量定义
    └── config.js             // 配置文件（已存在，需扩展）
```

---

## ⚙️ 配置文件

### 环境变量（.env）

```bash
# 已有配置（保持不变）
JWT_SECRET=你的超级秘密密钥
ENCRYPTION_KEY=32位的加密密钥
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 新增：邮件服务配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# 新增：应用URL（用于生成邮件中的链接）
APP_URL=https://your-frontend-domain.com

# 新增：Token配置
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# 新增：限流配置
RATE_LIMIT_REGISTER=10
RATE_LIMIT_LOGIN=5
RATE_LIMIT_FORGOT_PASSWORD=3
```

---

### 配置文件扩展（config/config.js）

```javascript
module.exports = {
  // 已有配置保持不变
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },

  // 新增：认证配置
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET,
      accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1h',
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
    },
    password: {
      saltRounds: 10,
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false
    },
    loginAttempts: {
      maxAttempts: 5,
      lockoutDuration: 900, // 15分钟（秒）
      trackBy: 'email_and_ip'
    }
  },

  // 新增：邮件配置
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    },
    from: process.env.EMAIL_FROM,
    verification: {
      expiresIn: 24 * 60 * 60 // 24小时（秒）
    },
    passwordReset: {
      expiresIn: 60 * 60 // 1小时（秒）
    }
  },

  // 新增：CORS配置
  cors: {
    allowedOrigins: [
      process.env.APP_URL,
      'http://localhost:5173', // 开发环境
      'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // 新增：限流配置
  rateLimit: {
    register: {
      maxRequests: parseInt(process.env.RATE_LIMIT_REGISTER || '10'),
      windowMs: 60 * 60 * 1000 // 1小时
    },
    login: {
      maxRequests: parseInt(process.env.RATE_LIMIT_LOGIN || '5'),
      windowMs: 60 * 1000 // 1分钟
    },
    forgotPassword: {
      maxRequests: parseInt(process.env.RATE_LIMIT_FORGOT_PASSWORD || '3'),
      windowMs: 60 * 60 * 1000 // 1小时
    }
  }
};
```

---

## 🔗 与现有系统的整合

### API Key关联

修改现有的API Key数据结构，添加用户关联：

```redis
api_key:{keyId} = {
  // 现有字段
  id: "keyId",
  key: "cr_xxxxxxxx",
  name: "My Key",
  created_at: "timestamp",
  
  // 新增字段
  userId: "xxx",                // 关联用户ID
  createdBy: "admin/user",      // 创建者类型
  userEmail: "user@example.com" // 用户邮箱（方便查询）
}
```

### 权限分级

- **管理员（Admin）**：
  - 通过 `/web` 登录
  - 可以管理所有用户
  - 可以查看所有API Keys
  - 可以查看所有使用统计

- **普通用户（User）**：
  - 通过 `/api/v1/auth/login` 登录
  - 只能管理自己的API Keys
  - 只能查看自己的使用统计
  - 不能访问后台管理界面

---

## 📊 API响应格式标准

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }  // 可选，开发环境可包含更多信息
  }
}
```

### 分页响应

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 错误代码规范

| 代码 | 描述 |
|------|------|
| AUTH_001 | 邮箱已被注册 |
| AUTH_002 | 邮箱未验证 |
| AUTH_003 | 账号被锁定 |
| AUTH_004 | 未提供认证令牌 |
| AUTH_005 | 令牌已失效 |
| AUTH_006 | 令牌已过期 |
| AUTH_007 | 无效的令牌 |
| AUTH_008 | 需要管理员权限 |
| VALIDATION_ERROR | 输入验证失败 |
| RATE_LIMIT | 请求过于频繁 |

---

## 🔒 安全检查清单

- ✅ 密码使用bcrypt加密，强度10+
- ✅ Token使用JWT并签名
- ✅ 敏感操作需要邮箱验证
- ✅ 登录失败限制（防暴力破解）
- ✅ API限流保护
- ✅ CORS白名单配置
- ✅ HTTPS强制（生产环境）
- ✅ 输入验证和清理
- ✅ XSS防护（输出转义）
- ✅ Token黑名单机制
- ✅ 日志记录（不记录敏感信息）
- ✅ 邮箱验证token有效期限制
- ✅ 密码重置token有效期限制

---

## 🚀 开发实施步骤

### 第一阶段：基础架构

1. **创建目录结构**
   - 创建 controllers、services、middleware 等目录
   - 设置路由结构

2. **配置环境**
   - 扩展 `.env` 文件
   - 扩展 `config/config.js`
   - 安装必要的npm包

3. **安装依赖**
   ```bash
   npm install bcrypt jsonwebtoken nodemailer express-validator
   ```

### 第二阶段：核心功能

4. **实现用户模型**
   - 创建 `User.js` 模型
   - 实现 Redis 数据操作

5. **实现认证服务**
   - 创建 `AuthController.js`
   - 实现注册、登录逻辑

6. **实现Token服务**
   - 创建 `TokenService.js`
   - 实现双Token机制

7. **实现中间件**
   - 认证中间件
   - 权限中间件
   - 输入验证中间件

### 第三阶段：邮件功能

8. **集成邮件服务**
   - 创建 `EmailService.js`
   - 实现邮件发送功能

9. **实现邮箱验证**
   - 邮箱验证流程
   - 重发验证邮件

10. **实现密码重置**
    - 忘记密码流程
    - 重置密码流程

### 第四阶段：用户管理

11. **实现用户信息管理**
    - 获取用户信息
    - 更新用户信息
    - 修改密码

12. **整合API Key系统**
    - 关联用户与API Key
    - 用户查看自己的Keys
    - 用户创建/删除Keys

### 第五阶段：安全与优化

13. **实现安全机制**
    - 登录限制
    - 限流保护
    - Token黑名单

14. **添加日志记录**
    - 操作日志
    - 错误日志
    - 安全日志

15. **编写API文档**
    - 集成Swagger
    - 编写接口文档

### 第六阶段：测试与部署

16. **编写测试**
    - 单元测试
    - 集成测试
    - API测试

17. **部署准备**
    - 更新Docker配置
    - 更新部署文档
    - 生产环境配置

---

## 🧪 测试建议

### 单元测试

使用 Jest 测试框架：

```bash
npm install --save-dev jest supertest
```

测试文件结构：
```
tests/
├── unit/
│   ├── services/
│   │   ├── UserService.test.js
│   │   ├── TokenService.test.js
│   │   └── EmailService.test.js
│   └── utils/
│       └── validators.test.js
├── integration/
│   ├── auth.test.js
│   └── user.test.js
└── setup.js
```

### API测试工具

- **Postman/Insomnia**：手动测试API
- **Supertest**：自动化API测试
- **Jest**：单元测试和集成测试

---

## 📚 依赖包清单

### 新增依赖

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.7",
    "express-validator": "^7.0.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

### 可选依赖（文档）

```json
{
  "dependencies": {
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0"
  }
}
```

---

## 📖 前端对接指南

### 1. 认证流程

```javascript
// 登录
const response = await fetch('http://your-api/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { accessToken, refreshToken } = await response.json();

// 保存Token
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### 2. 使用Token访问API

```javascript
const response = await fetch('http://your-api/api/v1/user/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```

### 3. Token刷新

```javascript
// Token过期时自动刷新
async function refreshAccessToken() {
  const response = await fetch('http://your-api/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });

  const { accessToken } = await response.json();
  localStorage.setItem('accessToken', accessToken);
  return accessToken;
}
```

### 4. 请求拦截器（以Axios为例）

```javascript
// 请求拦截器
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh失败，跳转登录页
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 🎯 后续优化建议

### 功能扩展

1. **OAuth第三方登录**
   - Google登录
   - GitHub登录

2. **两步验证（2FA）**
   - TOTP（Time-based One-Time Password）
   - 短信验证码

3. **会话管理**
   - 查看所有登录设备
   - 远程登出其他设备

4. **通知系统**
   - 异地登录提醒
   - 密码修改通知

### 性能优化

1. **缓存机制**
   - 用户信息缓存
   - API响应缓存

2. **数据库优化**
   - 考虑引入PostgreSQL存储用户数据
   - Redis作为缓存层

### 监控与日志

1. **操作日志**
   - 登录日志
   - API调用日志
   - 敏感操作日志

2. **性能监控**
   - 响应时间监控
   - 错误率监控

---

## 📞 技术支持

如有问题，请参考：
- GitHub Issues
- 项目文档
- API文档（Swagger）

---

**文档版本：** v1.0  
**最后更新：** 2025-12-25  
**作者：** riyoyoyo