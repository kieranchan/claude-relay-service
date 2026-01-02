const { prisma } = require('../models/prisma')
const logger = require('../utils/logger')

class LoginAttemptService {
  /**
   * 记录登录尝试
   * @param {string} email - 用户邮箱
   * @param {string} ipAddress - IP地址
   * @param {boolean} success - 是否成功
   * @returns {Promise<void>}
   */
  async recordAttempt(email, ipAddress, success) {
    try {
      await prisma.loginAttempt.create({
        data: {
          email,
          ipAddress,
          success
        }
      })
    } catch (error) {
      logger.error('❌ Error recording login attempt:', error)
    }
  }

  /**
   * 检查最近的失败尝试次数（用于检测暴力破解）
   * @param {string} email - 用户邮箱
   * @param {string} ipAddress - IP地址
   * @param {number} minutes - 检查的时间窗口（分钟）
   * @returns {Promise<number>} 失败次数
   */
  async countRecentFailures(email, ipAddress, minutes = 15) {
    try {
      const since = new Date(Date.now() - minutes * 60 * 1000)

      const where = {
        email,
        success: false,
        createdAt: {
          gte: since
        }
      }

      // Only include ipAddress filter if provided
      if (ipAddress) {
        where.ipAddress = ipAddress
      }

      const count = await prisma.loginAttempt.count({ where })

      return count
    } catch (error) {
      logger.error('❌ Error counting login failures:', error)
      return 0
    }
  }

  /**
   * 检查IP最近的失败尝试次数（针对IP的暴力破解）
   * @param {string} ipAddress - IP地址
   * @param {number} minutes - 检查的时间窗口（分钟）
   * @returns {Promise<number>} 失败次数
   */
  async countRecentIpFailures(ipAddress, minutes = 60) {
    try {
      const since = new Date(Date.now() - minutes * 60 * 1000)

      const count = await prisma.loginAttempt.count({
        where: {
          ipAddress,
          success: false,
          createdAt: {
            gte: since
          }
        }
      })

      return count
    } catch (error) {
      logger.error('❌ Error counting IP login failures:', error)
      return 0
    }
  }
}

module.exports = new LoginAttemptService()
