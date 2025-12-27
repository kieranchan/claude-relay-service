/**
 * 邮箱用户服务
 * 处理邮箱登录用户的 CRUD 操作
 * 与现有 LDAP 用户系统完全独立
 *
 * 数据存储：PostgreSQL (via Prisma)
 */

const { prisma } = require('../../models/prisma')
const bcrypt = require('bcryptjs')
const logger = require('../../utils/logger')

// 密码加密强度
const SALT_ROUNDS = 10

class EmailUserService {
  /**
   * 通过邮箱获取用户 ID
   * @param {string} email
   * @returns {Promise<string|null>}
   */
  async getUserIdByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim()
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    })
    return user?.id || null
  }

  /**
   * 通过用户 ID 获取用户
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return null
      }

      // 转换为旧格式以保持兼容性
      return this._toLegacyFormat(user)
    } catch (error) {
      logger.error('Failed to get user by id:', error)
      return null
    }
  }

  /**
   * 通过邮箱获取用户
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async getUserByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim()
    try {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      })

      if (!user) {
        return null
      }

      return this._toLegacyFormat(user)
    } catch (error) {
      logger.error('Failed to get user by email:', error)
      return null
    }
  }

  /**
   * 检查邮箱是否已注册
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async isEmailRegistered(email) {
    const normalizedEmail = email.toLowerCase().trim()
    const count = await prisma.user.count({
      where: { email: normalizedEmail }
    })
    return count > 0
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

    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        emailVerified: false,
        status: 'pending', // pending -> active (after email verification)
        role: 'user',
        loginCount: 0
      }
    })

    logger.info(`📧 Created email user: ${normalizedEmail} (${user.id})`)

    // 返回用户信息（不包含密码哈希）
    return this._toSafeUser(this._toLegacyFormat(user))
  }

  /**
   * 验证密码
   * @param {string} userId
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async verifyPassword(userId, password) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    })

    if (!user || !user.passwordHash) {
      return false
    }

    return bcrypt.compare(password, user.passwordHash)
  }

  /**
   * 标记邮箱已验证
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async verifyEmail(userId) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          status: 'active'
        }
      })

      logger.info(`✅ Email verified for user: ${user.email} (${userId})`)
      return true
    } catch (error) {
      logger.error('Failed to verify email:', error)
      return false
    }
  }

  /**
   * 更新最后登录时间
   * @param {string} userId
   */
  async updateLastLogin(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 }
        }
      })
    } catch (error) {
      logger.error('Failed to update last login:', error)
    }
  }

  /**
   * 更新密码
   * @param {string} userId
   * @param {string} newPassword
   * @returns {Promise<boolean>}
   */
  async updatePassword(userId, newPassword) {
    try {
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)

      const user = await prisma.user.update({
        where: { id: userId },
        data: { passwordHash }
      })

      logger.info(`🔐 Password updated for user: ${user.email} (${userId})`)
      return true
    } catch (error) {
      logger.error('Failed to update password:', error)
      return false
    }
  }

  /**
   * 更新用户状态
   * @param {string} userId
   * @param {string} status - 'active' | 'suspended' | 'pending'
   * @returns {Promise<boolean>}
   */
  async updateStatus(userId, status) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { status }
      })

      logger.info(`🔄 Status updated for user: ${user.email} -> ${status}`)
      return true
    } catch (error) {
      logger.error('Failed to update status:', error)
      return false
    }
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

    return this._toSafeUser(user)
  }

  /**
   * 获取所有邮箱用户列表（管理员功能）
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getAllUsers(options = {}) {
    const { page = 1, limit = 20, status } = options

    // 构建查询条件
    const where = {}
    if (status) {
      where.status = status
    }

    // 获取总数
    const total = await prisma.user.count({ where })

    // 获取分页数据
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    // 转换为安全格式
    const safeUsers = users.map((user) => this._toSafeUser(this._toLegacyFormat(user)))

    return {
      users: safeUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  /**
   * 关联 API Key 到用户
   * @param {string} userId
   * @param {string} apiKeyId
   */
  async addApiKeyToUser(userId, apiKeyId) {
    try {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { userId }
      })
    } catch (error) {
      logger.error('Failed to add API key to user:', error)
    }
  }

  /**
   * 移除用户的 API Key 关联
   * @param {string} userId
   * @param {string} apiKeyId
   */
  async removeApiKeyFromUser(userId, apiKeyId) {
    try {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { userId: null }
      })
    } catch (error) {
      logger.error('Failed to remove API key from user:', error)
    }
  }

  /**
   * 获取用户的所有 API Key IDs
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async getUserApiKeyIds(userId) {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true }
    })
    return apiKeys.map((key) => key.id)
  }

  /**
   * 获取用户的 API Key 数量
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUserApiKeyCount(userId) {
    return prisma.apiKey.count({
      where: { userId }
    })
  }

  /**
   * 将 Prisma User 转换为旧格式（兼容性）
   * @private
   */
  _toLegacyFormat(user) {
    return {
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      email_verified: user.emailVerified,
      status: user.status,
      role: user.role,
      referral_code: user.referralCode,
      invited_by: user.invitedById,
      created_at: user.createdAt?.toISOString() || null,
      updated_at: user.updatedAt?.toISOString() || null,
      last_login_at: user.lastLoginAt?.toISOString() || null,
      login_count: user.loginCount
    }
  }

  /**
   * 移除敏感信息
   * @private
   */
  _toSafeUser(user) {
    const { password_hash: _, ...safeUser } = user
    return safeUser
  }
}

module.exports = new EmailUserService()
