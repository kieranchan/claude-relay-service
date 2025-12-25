/**
 * JWT 认证中间件
 * 用于邮箱登录用户的 API 认证
 */

const { tokenService, emailUserService } = require('../services/emailAuth')
const logger = require('../utils/logger')

/**
 * JWT 认证中间件
 * 验证 Access Token 并将用户信息附加到 req.emailUser
 */
const authenticateJwt = async (req, res, next) => {
  const startTime = Date.now()

  try {
    // 从 Authorization header 提取 token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_004', message: '未提供认证令牌' }
      })
    }

    const token = authHeader.substring(7)

    // 验证 Token
    const decoded = await tokenService.verifyAccessToken(token)
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_007', message: '无效的令牌' }
      })
    }

    // 获取用户信息
    const user = await emailUserService.getSafeUserById(decoded.userId)
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_USER_NOT_FOUND', message: '用户不存在' }
      })
    }

    // 检查用户状态
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_SUSPENDED', message: '账户已被暂停' }
      })
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: { code: 'AUTH_002', message: '请先验证邮箱' }
      })
    }

    // 将用户信息附加到请求对象
    req.emailUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.email_verified,
      status: user.status
    }

    // 存储原始 token 用于登出
    req.accessToken = token

    const authDuration = Date.now() - startTime
    logger.debug(`🔐 JWT authenticated: ${user.email} in ${authDuration}ms`)

    return next()
  } catch (error) {
    const authDuration = Date.now() - startTime
    logger.error(`❌ JWT authentication error (${authDuration}ms):`, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    })

    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: '认证过程中发生错误' }
    })
  }
}

/**
 * 可选的 JWT 认证中间件
 * 如果提供了有效 token，附加用户信息；否则继续
 */
const authenticateJwtOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.substring(7)

  try {
    const decoded = await tokenService.verifyAccessToken(token)
    if (decoded) {
      const user = await emailUserService.getSafeUserById(decoded.userId)
      if (user && user.status === 'active') {
        req.emailUser = {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: user.email_verified,
          status: user.status
        }
        req.accessToken = token
      }
    }
  } catch (error) {
    logger.debug('Optional JWT auth failed:', error.message)
  }

  return next()
}

/**
 * 管理员权限检查中间件
 * 需要在 authenticateJwt 之后使用
 */
const requireEmailAdmin = (req, res, next) => {
  if (!req.emailUser) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_004', message: '未提供认证令牌' }
    })
  }

  if (req.emailUser.role !== 'admin') {
    logger.security(`🚫 Admin access denied for email user: ${req.emailUser.email}`)
    return res.status(403).json({
      success: false,
      error: { code: 'AUTH_008', message: '需要管理员权限' }
    })
  }

  return next()
}

/**
 * 邮箱验证检查中间件
 * 确保用户邮箱已验证
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.emailUser) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_004', message: '未提供认证令牌' }
    })
  }

  if (!req.emailUser.emailVerified) {
    return res.status(403).json({
      success: false,
      error: { code: 'AUTH_002', message: '请先验证邮箱' }
    })
  }

  return next()
}

module.exports = {
  authenticateJwt,
  authenticateJwtOptional,
  requireEmailAdmin,
  requireEmailVerified
}
