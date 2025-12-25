/**
 * 邮箱认证服务
 * 核心认证逻辑：注册、登录、登出、密码重置等
 */

const redis = require('../../models/redis')
const logger = require('../../utils/logger')
const emailUserService = require('./emailUserService')
const tokenService = require('./tokenService')
const emailService = require('./emailService')

// Redis Key 前缀
const KEYS = {
  LOGIN_FAIL_IP: 'email_login_fail:ip:',
  LOGIN_FAIL_COMBO: 'email_login_fail:combo:'
}

// 登录限制配置
const LOGIN_LIMITS = {
  MAX_IP_ATTEMPTS: 30, // 每个 IP 最多 30 次
  MAX_COMBO_ATTEMPTS: 5, // 每个 邮箱+IP 组合最多 5 次
  LOCKOUT_DURATION: 900 // 锁定 15 分钟（秒）
}

class EmailAuthService {
  /**
   * 检查登录限制
   * @param {string} email
   * @param {string} ip
   * @returns {Promise<Object>} { allowed, reason, retryAfter }
   */
  async checkLoginLimits(email, ip) {
    const client = redis.getClientSafe()

    // 检查 IP 限制
    const ipKey = `${KEYS.LOGIN_FAIL_IP}${ip}`
    const ipAttempts = parseInt((await client.get(ipKey)) || '0')

    if (ipAttempts >= LOGIN_LIMITS.MAX_IP_ATTEMPTS) {
      const ttl = await client.ttl(ipKey)
      return {
        allowed: false,
        reason: 'IP_LIMIT_EXCEEDED',
        message: '登录尝试次数过多，请稍后再试',
        retryAfter: ttl > 0 ? ttl : LOGIN_LIMITS.LOCKOUT_DURATION
      }
    }

    // 检查 邮箱+IP 组合限制
    const comboKey = `${KEYS.LOGIN_FAIL_COMBO}${email}:${ip}`
    const comboAttempts = parseInt((await client.get(comboKey)) || '0')

    if (comboAttempts >= LOGIN_LIMITS.MAX_COMBO_ATTEMPTS) {
      const ttl = await client.ttl(comboKey)
      return {
        allowed: false,
        reason: 'COMBO_LIMIT_EXCEEDED',
        message: '该账户登录尝试次数过多，请稍后再试',
        retryAfter: ttl > 0 ? ttl : LOGIN_LIMITS.LOCKOUT_DURATION
      }
    }

    return { allowed: true }
  }

  /**
   * 记录登录失败
   * @param {string} email
   * @param {string} ip
   */
  async recordLoginFailure(email, ip) {
    const client = redis.getClientSafe()

    // 增加 IP 失败计数
    const ipKey = `${KEYS.LOGIN_FAIL_IP}${ip}`
    await client.incr(ipKey)
    await client.expire(ipKey, LOGIN_LIMITS.LOCKOUT_DURATION)

    // 增加 邮箱+IP 组合失败计数
    const comboKey = `${KEYS.LOGIN_FAIL_COMBO}${email}:${ip}`
    await client.incr(comboKey)
    await client.expire(comboKey, LOGIN_LIMITS.LOCKOUT_DURATION)
  }

  /**
   * 清除登录失败记录（登录成功后）
   * @param {string} email
   * @param {string} ip
   */
  async clearLoginFailures(email, ip) {
    const client = redis.getClientSafe()

    const comboKey = `${KEYS.LOGIN_FAIL_COMBO}${email}:${ip}`
    await client.del(comboKey)
    // 注意：不清除 IP 计数，防止恶意用户通过成功登录一个账户来重置限制
  }

  /**
   * 用户注册
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async register({ email, password }) {
    // 创建用户
    const user = await emailUserService.createUser({ email, password })

    // 创建邮箱验证 Token
    const verifyToken = await emailService.createVerificationToken(user.id, email)

    // 发送验证邮件
    await emailService.sendVerificationEmail(email, verifyToken)

    logger.info(`📧 User registered: ${email} (${user.id})`)

    return {
      success: true,
      message: '注册成功，请查收验证邮件',
      data: {
        userId: user.id,
        email: user.email,
        emailVerified: false
      }
    }
  }

  /**
   * 用户登录
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async login({ email, password, ip = 'unknown' }) {
    const normalizedEmail = email.toLowerCase().trim()

    // 检查登录限制
    const limitCheck = await this.checkLoginLimits(normalizedEmail, ip)
    if (!limitCheck.allowed) {
      const error = new Error(limitCheck.message)
      error.code = 'AUTH_003'
      error.retryAfter = limitCheck.retryAfter
      throw error
    }

    // 获取用户
    const user = await emailUserService.getUserByEmail(normalizedEmail)
    if (!user) {
      await this.recordLoginFailure(normalizedEmail, ip)
      const error = new Error('邮箱或密码错误')
      error.code = 'AUTH_INVALID_CREDENTIALS'
      throw error
    }

    // 检查邮箱是否已验证
    if (!user.email_verified) {
      const error = new Error('请先验证邮箱')
      error.code = 'AUTH_002'
      throw error
    }

    // 检查用户状态
    if (user.status === 'suspended') {
      const error = new Error('账户已被暂停')
      error.code = 'AUTH_SUSPENDED'
      throw error
    }

    // 验证密码
    const isValidPassword = await emailUserService.verifyPassword(user.id, password)
    if (!isValidPassword) {
      await this.recordLoginFailure(normalizedEmail, ip)
      const error = new Error('邮箱或密码错误')
      error.code = 'AUTH_INVALID_CREDENTIALS'
      throw error
    }

    // 登录成功，清除失败记录
    await this.clearLoginFailures(normalizedEmail, ip)

    // 更新最后登录时间
    await emailUserService.updateLastLogin(user.id)

    // 生成 Tokens
    const accessTokenResult = tokenService.generateAccessToken(user)
    const refreshTokenResult = await tokenService.generateRefreshToken(user, ip)

    logger.info(`✅ User logged in: ${email} from ${ip}`)

    return {
      success: true,
      message: '登录成功',
      data: {
        accessToken: accessTokenResult.token,
        refreshToken: refreshTokenResult.token,
        expiresIn: accessTokenResult.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.email_verified,
          role: user.role
        }
      }
    }
  }

  /**
   * 用户登出
   * @param {string} accessToken
   * @param {string} refreshToken
   * @returns {Promise<Object>}
   */
  async logout(accessToken, refreshToken) {
    // 撤销 Access Token
    if (accessToken) {
      await tokenService.revokeAccessToken(accessToken)
    }

    // 撤销 Refresh Token
    if (refreshToken) {
      await tokenService.revokeRefreshToken(refreshToken)
    }

    return {
      success: true,
      message: '登出成功'
    }
  }

  /**
   * 刷新 Access Token
   * @param {string} refreshToken
   * @returns {Promise<Object>}
   */
  async refreshToken(refreshToken) {
    const result = await tokenService.refreshAccessToken(refreshToken)

    if (!result) {
      const error = new Error('无效或已过期的刷新令牌')
      error.code = 'AUTH_REFRESH_INVALID'
      throw error
    }

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      }
    }
  }

  /**
   * 验证邮箱
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async verifyEmail(token) {
    const tokenData = await emailService.verifyEmailToken(token)

    if (!tokenData) {
      const error = new Error('无效或已过期的验证链接')
      error.code = 'AUTH_TOKEN_INVALID'
      throw error
    }

    // 标记邮箱已验证
    const success = await emailUserService.verifyEmail(tokenData.userId)

    if (!success) {
      const error = new Error('验证失败，用户不存在')
      error.code = 'AUTH_USER_NOT_FOUND'
      throw error
    }

    logger.info(`✅ Email verified: ${tokenData.email}`)

    return {
      success: true,
      message: '邮箱验证成功'
    }
  }

  /**
   * 重发验证邮件
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async resendVerificationEmail(userId) {
    const user = await emailUserService.getSafeUserById(userId)

    if (!user) {
      const error = new Error('用户不存在')
      error.code = 'AUTH_USER_NOT_FOUND'
      throw error
    }

    if (user.email_verified) {
      const error = new Error('邮箱已验证')
      error.code = 'AUTH_ALREADY_VERIFIED'
      throw error
    }

    // 创建新的验证 Token
    const verifyToken = await emailService.createVerificationToken(user.id, user.email)

    // 发送验证邮件
    await emailService.sendVerificationEmail(user.email, verifyToken)

    logger.info(`📧 Verification email resent to: ${user.email}`)

    return {
      success: true,
      message: '验证邮件已发送，请查收'
    }
  }

  /**
   * 忘记密码（发送重置邮件）
   * @param {string} email
   * @returns {Promise<Object>}
   */
  async forgotPassword(email) {
    const normalizedEmail = email.toLowerCase().trim()
    const user = await emailUserService.getUserByEmail(normalizedEmail)

    // 即使用户不存在也返回成功（防止邮箱枚举攻击）
    if (!user) {
      logger.debug(`Password reset requested for non-existent email: ${normalizedEmail}`)
      return {
        success: true,
        message: '如果该邮箱已注册，您将收到密码重置邮件'
      }
    }

    // 创建密码重置 Token
    const resetToken = await emailService.createPasswordResetToken(user.id, user.email)

    // 发送重置邮件
    await emailService.sendPasswordResetEmail(user.email, resetToken)

    logger.info(`🔐 Password reset email sent to: ${user.email}`)

    return {
      success: true,
      message: '如果该邮箱已注册，您将收到密码重置邮件'
    }
  }

  /**
   * 重置密码
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async resetPassword({ token, password }) {
    const tokenData = await emailService.verifyPasswordResetToken(token)

    if (!tokenData) {
      const error = new Error('无效或已过期的重置链接')
      error.code = 'AUTH_TOKEN_INVALID'
      throw error
    }

    // 更新密码
    const success = await emailUserService.updatePassword(tokenData.userId, password)

    if (!success) {
      const error = new Error('重置失败，用户不存在')
      error.code = 'AUTH_USER_NOT_FOUND'
      throw error
    }

    // 撤销该用户所有的 Refresh Token（强制重新登录）
    await tokenService.revokeAllUserRefreshTokens(tokenData.userId)

    logger.info(`🔐 Password reset completed for: ${tokenData.email}`)

    return {
      success: true,
      message: '密码重置成功，请使用新密码登录'
    }
  }

  /**
   * 修改密码（已登录用户）
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async changePassword({ userId, oldPassword, newPassword }) {
    const user = await emailUserService.getUserById(userId)

    if (!user) {
      const error = new Error('用户不存在')
      error.code = 'AUTH_USER_NOT_FOUND'
      throw error
    }

    // 验证旧密码
    const isValidPassword = await emailUserService.verifyPassword(userId, oldPassword)
    if (!isValidPassword) {
      const error = new Error('当前密码错误')
      error.code = 'AUTH_INVALID_PASSWORD'
      throw error
    }

    // 更新密码
    await emailUserService.updatePassword(userId, newPassword)

    // 撤销该用户所有的 Refresh Token（强制重新登录）
    await tokenService.revokeAllUserRefreshTokens(userId)

    logger.info(`🔐 Password changed for user: ${user.email}`)

    return {
      success: true,
      message: '密码修改成功，请重新登录'
    }
  }

  /**
   * 检查登录状态
   * @param {string} accessToken
   * @returns {Promise<Object>}
   */
  async checkAuth(accessToken) {
    const decoded = await tokenService.verifyAccessToken(accessToken)

    if (!decoded) {
      const error = new Error('未登录或会话已过期')
      error.code = 'AUTH_NOT_LOGGED_IN'
      throw error
    }

    const user = await emailUserService.getSafeUserById(decoded.userId)

    if (!user) {
      const error = new Error('用户不存在')
      error.code = 'AUTH_USER_NOT_FOUND'
      throw error
    }

    if (user.status === 'suspended') {
      const error = new Error('账户已被暂停')
      error.code = 'AUTH_SUSPENDED'
      throw error
    }

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.email_verified,
          role: user.role,
          status: user.status
        }
      }
    }
  }
}

module.exports = new EmailAuthService()
