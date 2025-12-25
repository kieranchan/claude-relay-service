/**
 * 邮箱用户服务
 * 处理邮箱登录用户的 CRUD 操作
 * 与现有 LDAP 用户系统完全独立
 */

const redis = require('../../models/redis')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const logger = require('../../utils/logger')

// Redis Key 前缀
const KEYS = {
  USER: 'email_user:',
  EMAIL_TO_ID: 'email_to_userid:',
  USER_API_KEYS: 'email_user_api_keys:'
}

// 密码加密强度
const SALT_ROUNDS = 10

class EmailUserService {
  /**
   * 生成用户 ID
   */
  generateUserId() {
    return crypto.randomUUID()
  }

  /**
   * 通过邮箱获取用户 ID
   * @param {string} email
   * @returns {Promise<string|null>}
   */
  async getUserIdByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim()
    const userId = await redis.get(`${KEYS.EMAIL_TO_ID}${normalizedEmail}`)
    return userId || null
  }

  /**
   * 通过用户 ID 获取用户
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getUserById(userId) {
    const userData = await redis.get(`${KEYS.USER}${userId}`)
    if (!userData) {
      return null
    }

    try {
      return JSON.parse(userData)
    } catch (error) {
      logger.error('Failed to parse user data:', error)
      return null
    }
  }

  /**
   * 通过邮箱获取用户
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async getUserByEmail(email) {
    const userId = await this.getUserIdByEmail(email)
    if (!userId) {
      return null
    }
    return this.getUserById(userId)
  }

  /**
   * 检查邮箱是否已注册
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async isEmailRegistered(email) {
    const userId = await this.getUserIdByEmail(email)
    return !!userId
  }

  /**
   * 创建新用户
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async createUser({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim()

    // 检查邮箱是否已存在
    if (await this.isEmailRegistered(normalizedEmail)) {
      const error = new Error('该邮箱已被注册')
      error.code = 'AUTH_001'
      throw error
    }

    // 生成用户 ID 和密码哈希
    const userId = this.generateUserId()
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const now = new Date().toISOString()

    // 创建用户对象
    const user = {
      id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
      email_verified: false,
      status: 'pending', // pending -> active (after email verification)
      role: 'user',
      created_at: now,
      updated_at: now,
      last_login_at: null,
      login_count: 0
    }

    // 使用 Pipeline 确保原子性
    const client = redis.getClientSafe()
    const pipeline = client.pipeline()

    pipeline.set(`${KEYS.USER}${userId}`, JSON.stringify(user))
    pipeline.set(`${KEYS.EMAIL_TO_ID}${normalizedEmail}`, userId)

    await pipeline.exec()

    logger.info(`📧 Created email user: ${normalizedEmail} (${userId})`)

    // 返回用户信息（不包含密码哈希）
    const { password_hash: _, ...safeUser } = user
    return safeUser
  }

  /**
   * 验证密码
   * @param {string} userId
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async verifyPassword(userId, password) {
    const user = await this.getUserById(userId)
    if (!user || !user.password_hash) {
      return false
    }

    return bcrypt.compare(password, user.password_hash)
  }

  /**
   * 标记邮箱已验证
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async verifyEmail(userId) {
    const user = await this.getUserById(userId)
    if (!user) {
      return false
    }

    user.email_verified = true
    user.status = 'active'
    user.updated_at = new Date().toISOString()

    await redis.set(`${KEYS.USER}${userId}`, JSON.stringify(user))
    logger.info(`✅ Email verified for user: ${user.email} (${userId})`)

    return true
  }

  /**
   * 更新最后登录时间
   * @param {string} userId
   */
  async updateLastLogin(userId) {
    const user = await this.getUserById(userId)
    if (!user) {
      return
    }

    user.last_login_at = new Date().toISOString()
    user.login_count = (user.login_count || 0) + 1
    user.updated_at = new Date().toISOString()

    await redis.set(`${KEYS.USER}${userId}`, JSON.stringify(user))
  }

  /**
   * 更新密码
   * @param {string} userId
   * @param {string} newPassword
   * @returns {Promise<boolean>}
   */
  async updatePassword(userId, newPassword) {
    const user = await this.getUserById(userId)
    if (!user) {
      return false
    }

    user.password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    user.updated_at = new Date().toISOString()

    await redis.set(`${KEYS.USER}${userId}`, JSON.stringify(user))
    logger.info(`🔐 Password updated for user: ${user.email} (${userId})`)

    return true
  }

  /**
   * 更新用户状态
   * @param {string} userId
   * @param {string} status - 'active' | 'suspended' | 'pending'
   * @returns {Promise<boolean>}
   */
  async updateStatus(userId, status) {
    const user = await this.getUserById(userId)
    if (!user) {
      return false
    }

    user.status = status
    user.updated_at = new Date().toISOString()

    await redis.set(`${KEYS.USER}${userId}`, JSON.stringify(user))
    logger.info(`🔄 Status updated for user: ${user.email} -> ${status}`)

    return true
  }

  /**
   * 获取用户的安全信息（不包含敏感数据）
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getSafeUserById(userId) {
    const user = await this.getUserById(userId)
    if (!user) {
      return null
    }

    const { password_hash: _, ...safeUser } = user
    return safeUser
  }

  /**
   * 获取所有邮箱用户列表（管理员功能）
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getAllUsers(options = {}) {
    const { page = 1, limit = 20, status } = options
    const client = redis.getClientSafe()

    // 获取所有用户 Key
    const keys = await client.keys(`${KEYS.USER}*`)
    const users = []

    for (const key of keys) {
      const userData = await client.get(key)
      if (userData) {
        try {
          const user = JSON.parse(userData)
          // 过滤状态
          if (status && user.status !== status) {
            continue
          }

          // 移除敏感信息
          const { password_hash: _, ...safeUser } = user
          users.push(safeUser)
        } catch (error) {
          logger.error(`Failed to parse user data for key ${key}:`, error)
        }
      }
    }

    // 排序和分页
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const startIndex = (page - 1) * limit
    const paginatedUsers = users.slice(startIndex, startIndex + limit)

    return {
      users: paginatedUsers,
      total: users.length,
      page,
      limit,
      totalPages: Math.ceil(users.length / limit)
    }
  }

  /**
   * 关联 API Key 到用户
   * @param {string} userId
   * @param {string} apiKeyId
   */
  async addApiKeyToUser(userId, apiKeyId) {
    const client = redis.getClientSafe()
    await client.sadd(`${KEYS.USER_API_KEYS}${userId}`, apiKeyId)
  }

  /**
   * 移除用户的 API Key 关联
   * @param {string} userId
   * @param {string} apiKeyId
   */
  async removeApiKeyFromUser(userId, apiKeyId) {
    const client = redis.getClientSafe()
    await client.srem(`${KEYS.USER_API_KEYS}${userId}`, apiKeyId)
  }

  /**
   * 获取用户的所有 API Key IDs
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async getUserApiKeyIds(userId) {
    const client = redis.getClientSafe()
    return client.smembers(`${KEYS.USER_API_KEYS}${userId}`)
  }

  /**
   * 获取用户的 API Key 数量
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUserApiKeyCount(userId) {
    const client = redis.getClientSafe()
    return client.scard(`${KEYS.USER_API_KEYS}${userId}`)
  }
}

module.exports = new EmailUserService()
