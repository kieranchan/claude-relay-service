# 邮箱登录系统 - Redis 数据结构设计

> 版本: v1.0
> 创建日期: 2024-12-26

## 概述

本文档定义邮箱登录系统的 Redis 数据结构设计。该系统与现有 LDAP 认证系统**完全独立**运行。

## Redis Key 命名规范

所有 Key 使用 `email_` 前缀，与现有系统区分：

- `email_user:` - 用户数据
- `email_` - 认证相关
- `password_reset_` - 密码重置

---

## 1. 用户信息 (Hash)

**Key**: `email_user:{userId}`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "password_hash": "bcrypt_hash_string",
  "email_verified": "true|false",
  "status": "active|suspended|pending",
  "role": "user|admin",
  "created_at": "ISO8601_timestamp",
  "updated_at": "ISO8601_timestamp",
  "last_login_at": "ISO8601_timestamp",
  "login_count": "0"
}
```

**TTL**: 无（永久存储）

---

## 2. 邮箱到用户ID映射 (String)

**Key**: `email_to_userid:{email}`
**Value**: `userId`

**TTL**: 无（永久存储）

**用途**: 快速通过邮箱查找用户ID，O(1)查询

---

## 3. Refresh Token (String)

**Key**: `email_refresh_token:{tokenHash}`
**Value**: JSON字符串

```json
{
  "userId": "uuid",
  "created_at": "ISO8601_timestamp",
  "expires_at": "ISO8601_timestamp",
  "device_info": "optional_device_identifier"
}
```

**TTL**: 7天 (604800秒) 或 30天 (2592000秒)

**注意**: Token 存储时使用 SHA256 哈希，避免明文存储

---

## 4. Token 黑名单 (String)

**Key**: `email_token_blacklist:{jti}`
**Value**: `"1"`

**TTL**: Token 剩余有效期

**用途**: 登出时将 Access Token 的 JTI 加入黑名单

---

## 5. 邮箱验证 Token (Hash)

**Key**: `email_verify_token:{token}`

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "created_at": "ISO8601_timestamp"
}
```

**TTL**: 24小时 (86400秒)

---

## 6. 密码重置 Token (Hash)

**Key**: `password_reset_token:{token}`

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "created_at": "ISO8601_timestamp"
}
```

**TTL**: 1小时 (3600秒)

---

## 7. 登录失败记录 (String)

### 按 IP 统计

**Key**: `email_login_fail:ip:{ip}`
**Value**: 失败次数 (integer string)
**TTL**: 15分钟 (900秒)

### 按邮箱+IP 统计

**Key**: `email_login_fail:combo:{email}:{ip}`
**Value**: 失败次数 (integer string)
**TTL**: 15分钟 (900秒)

**限制策略**:
- IP 限制: 30次/15分钟
- 邮箱+IP 限制: 5次/15分钟

---

## 8. 用户的 API Keys (Set)

**Key**: `email_user_api_keys:{userId}`
**Value**: Set of API Key IDs

**TTL**: 无（永久存储）

**用途**: 快速获取用户拥有的所有 API Keys

---

## JWT Token 设计

### Access Token (短期)

```json
{
  "type": "access",
  "jti": "unique_token_id",
  "userId": "uuid",
  "email": "user@example.com",
  "role": "user|admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**有效期**: 1小时 (可配置)

### Refresh Token (长期)

```json
{
  "type": "refresh",
  "jti": "unique_token_id",
  "userId": "uuid",
  "iat": 1234567890,
  "exp": 1235172690
}
```

**有效期**: 7天 (可配置)

---

## 索引策略

| Key Pattern | 查询场景 | 复杂度 |
|-------------|----------|--------|
| `email_to_userid:{email}` | 登录时通过邮箱查用户 | O(1) |
| `email_user:{userId}` | 获取用户详情 | O(1) |
| `email_refresh_token:{hash}` | 验证 Refresh Token | O(1) |
| `email_token_blacklist:{jti}` | 验证 Token 是否失效 | O(1) |
| `email_verify_token:{token}` | 验证邮箱 | O(1) |

---

## 数据一致性

### 用户创建事务

1. 检查邮箱是否已存在 (`email_to_userid:{email}`)
2. 生成 userId
3. 创建用户数据 (`email_user:{userId}`)
4. 创建邮箱映射 (`email_to_userid:{email}`)
5. 生成验证 Token (`email_verify_token:{token}`)

使用 Redis Pipeline 确保原子性。

### 用户删除事务

1. 删除用户数据 (`email_user:{userId}`)
2. 删除邮箱映射 (`email_to_userid:{email}`)
3. 删除所有 Refresh Tokens
4. 删除 API Keys 关联 (`email_user_api_keys:{userId}`)

---

## 安全考虑

1. **密码存储**: 使用 bcrypt，saltRounds >= 10
2. **Token 存储**: Refresh Token 使用 SHA256 哈希存储
3. **敏感数据**: 不在 Redis 中存储明文密码或原始 Token
4. **TTL 保护**: 所有临时数据都设置 TTL，防止泄漏
5. **IP 限流**: 防止暴力破解攻击
