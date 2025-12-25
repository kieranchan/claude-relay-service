/**
 * Token 服务
 * 处理 JWT Access Token 和 Refresh Token 的生成、验证和管理
 */

const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')

// 从环境变量获取配置
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-THIS-JWT-SECRET-IN-PRODUCTION'
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '1h'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'

// Redis Key 前缀
const KEYS = {
  REFRESH_TOKEN: 'email_refresh_token:',
  TOKEN_BLACKLIST: 'email_token_blacklist:'
}

// 解析时间字符串为秒数
function parseTimeToSeconds(timeStr) {
  const match = timeStr.match(/^(\d+)(s|m|h|d)$/)
  if (!match) {
    return 3600
  } // 默认 1 小时

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 3600
    case 'd':
      return value * 86400
    default:
      return 3600
  }
}

class TokenService {
  /**
   * 生成唯一的 Token ID (JTI)
   */
  generateJti() {
    return crypto.randomUUID()
  }

  /**
   * 哈希 Token（用于安全存储）
   * @param {string} token
   * @returns {string}
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * 生成 Access Token
   * @param {Object} user
   * @returns {Object} { token, expiresIn, expiresAt }
   */
  generateAccessToken(user) {
    const jti = this.generateJti()
    const expiresInSeconds = parseTimeToSeconds(ACCESS_TOKEN_EXPIRES_IN)

    const payload = {
      type: 'access',
      jti,
      userId: user.id,
      email: user.email,
      role: user.role || 'user'
    }

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    })

    return {
      token,
      expiresIn: expiresInSeconds,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    }
  }

  /**
   * 生成 Refresh Token
   * @param {Object} user
   * @param {string} deviceInfo - 可选的设备信息
   * @returns {Promise<Object>} { token, expiresIn, expiresAt }
   */
  async generateRefreshToken(user, deviceInfo = null) {
    const jti = this.generateJti()
    const expiresInSeconds = parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)

    const payload = {
      type: 'refresh',
      jti,
      userId: user.id
    }

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN
    })

    // 将 Refresh Token 信息存储到 Redis
    const tokenHash = this.hashToken(token)
    const tokenData = {
      userId: user.id,
      jti,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      device_info: deviceInfo
    }

    await redis.setex(
      `${KEYS.REFRESH_TOKEN}${tokenHash}`,
      expiresInSeconds,
      JSON.stringify(tokenData)
    )

    logger.debug(`🔑 Generated refresh token for user: ${user.email}`)

    return {
      token,
      expiresIn: expiresInSeconds,
      expiresAt: tokenData.expires_at
    }
  }

  /**
   * 验证 Access Token
   * @param {string} token
   * @returns {Promise<Object|null>} 解码后的 payload 或 null
   */
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET)

      // 检查 token 类型
      if (decoded.type !== 'access') {
        logger.warn('Token type mismatch: expected access token')
        return null
      }

      // 检查是否在黑名单中
      const isBlacklisted = await redis.get(`${KEYS.TOKEN_BLACKLIST}${decoded.jti}`)
      if (isBlacklisted) {
        logger.warn(`Token ${decoded.jti} is blacklisted`)
        return null
      }

      return decoded
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.debug('Access token expired')
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Invalid access token:', error.message)
      } else {
        logger.error('Token verification error:', error)
      }
      return null
    }
  }

  /**
   * 验证 Refresh Token
   * @param {string} token
   * @returns {Promise<Object|null>} Token 数据或 null
   */
  async verifyRefreshToken(token) {
    try {
      // 先验证 JWT 签名
      const decoded = jwt.verify(token, JWT_SECRET)

      if (decoded.type !== 'refresh') {
        logger.warn('Token type mismatch: expected refresh token')
        return null
      }

      // 从 Redis 获取存储的 token 数据
      const tokenHash = this.hashToken(token)
      const tokenDataStr = await redis.get(`${KEYS.REFRESH_TOKEN}${tokenHash}`)

      if (!tokenDataStr) {
        logger.warn('Refresh token not found in Redis (may have been revoked)')
        return null
      }

      const tokenData = JSON.parse(tokenDataStr)

      // 验证 userId 匹配
      if (tokenData.userId !== decoded.userId) {
        logger.warn('Token userId mismatch')
        return null
      }

      return {
        ...decoded,
        ...tokenData
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.debug('Refresh token expired')
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Invalid refresh token:', error.message)
      } else {
        logger.error('Refresh token verification error:', error)
      }
      return null
    }
  }

  /**
   * 撤销 Access Token（加入黑名单）
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async revokeAccessToken(token) {
    try {
      const decoded = jwt.decode(token)
      if (!decoded || !decoded.jti || !decoded.exp) {
        return false
      }

      // 计算剩余有效期
      const remainingTime = decoded.exp - Math.floor(Date.now() / 1000)
      if (remainingTime <= 0) {
        return true
      } // 已过期，无需处理

      // 加入黑名单
      await redis.setex(`${KEYS.TOKEN_BLACKLIST}${decoded.jti}`, remainingTime, '1')

      logger.debug(`🚫 Access token revoked: ${decoded.jti}`)
      return true
    } catch (error) {
      logger.error('Failed to revoke access token:', error)
      return false
    }
  }

  /**
   * 撤销 Refresh Token
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async revokeRefreshToken(token) {
    try {
      const tokenHash = this.hashToken(token)
      const deleted = await redis.del(`${KEYS.REFRESH_TOKEN}${tokenHash}`)

      if (deleted) {
        logger.debug(`🚫 Refresh token revoked`)
      }

      return deleted > 0
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error)
      return false
    }
  }

  /**
   * 撤销用户的所有 Refresh Token
   * @param {string} userId
   * @returns {Promise<number>} 撤销的 token 数量
   */
  async revokeAllUserRefreshTokens(userId) {
    const client = redis.getClientSafe()
    const keys = await client.keys(`${KEYS.REFRESH_TOKEN}*`)

    let revokedCount = 0

    for (const key of keys) {
      const tokenDataStr = await client.get(key)
      if (tokenDataStr) {
        try {
          const tokenData = JSON.parse(tokenDataStr)
          if (tokenData.userId === userId) {
            await client.del(key)
            revokedCount++
          }
        } catch (error) {
          logger.error(`Failed to parse token data for key ${key}:`, error)
        }
      }
    }

    if (revokedCount > 0) {
      logger.info(`🚫 Revoked ${revokedCount} refresh tokens for user: ${userId}`)
    }

    return revokedCount
  }

  /**
   * 使用 Refresh Token 刷新 Access Token
   * @param {string} refreshToken
   * @returns {Promise<Object|null>} 新的 { accessToken, expiresIn } 或 null
   */
  async refreshAccessToken(refreshToken) {
    const tokenData = await this.verifyRefreshToken(refreshToken)
    if (!tokenData) {
      return null
    }

    // 生成新的 Access Token
    const accessTokenResult = this.generateAccessToken({
      id: tokenData.userId,
      email: tokenData.email,
      role: tokenData.role
    })

    return {
      accessToken: accessTokenResult.token,
      expiresIn: accessTokenResult.expiresIn
    }
  }

  /**
   * 获取 Access Token 的过期时间（秒）
   */
  getAccessTokenExpiresIn() {
    return parseTimeToSeconds(ACCESS_TOKEN_EXPIRES_IN)
  }

  /**
   * 获取 Refresh Token 的过期时间（秒）
   */
  getRefreshTokenExpiresIn() {
    return parseTimeToSeconds(REFRESH_TOKEN_EXPIRES_IN)
  }
}

module.exports = new TokenService()
