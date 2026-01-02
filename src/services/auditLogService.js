const { prisma } = require('../models/prisma')
const logger = require('../utils/logger')

class AuditLogService {
  /**
   * 记录审计日志
   * @param {Object} data - 日志数据
   * @param {string} data.action - 操作类型 (e.g., USER_UPDATE, KEY_DELETE)
   * @param {string} [data.adminId] - 操作管理员ID
   * @param {string} [data.targetUserId] - 目标用户ID
   * @param {Object} [data.details] - 操作详情
   * @param {string} [data.ipAddress] - 操作IP
   * @returns {Promise<Object>} 创建的日志记录
   */
  async log(data) {
    try {
      const { action, adminId, targetUserId, details, ipAddress } = data

      const log = await prisma.auditLog.create({
        data: {
          action,
          adminId,
          targetUserId,
          details,
          ipAddress
        }
      })

      logger.info(`📝 Audit log: ${action} by ${adminId || 'System'} on ${targetUserId || 'N/A'}`)
      return log
    } catch (error) {
      logger.error('❌ Error creating audit log:', error)
      // 审计日志失败不应中断主流程，但应记录错误
      return null
    }
  }

  /**
   * 获取审计日志列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 日志列表和总数
   */
  async getLogs(options = {}) {
    try {
      const { page = 1, limit = 20, adminId, targetUserId, action, startDate, endDate } = options

      const where = {}

      if (adminId) {
        where.adminId = adminId
      }
      if (targetUserId) {
        where.targetUserId = targetUserId
      }
      if (action) {
        where.action = action
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) {
          where.createdAt.gte = new Date(startDate)
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate)
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: parseInt(limit),
          include: {
            admin: {
              select: { id: true, email: true, displayName: true }
            },
            targetUser: {
              select: { id: true, email: true, displayName: true }
            }
          }
        }),
        prisma.auditLog.count({ where })
      ])

      return {
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('❌ Error getting audit logs:', error)
      throw error
    }
  }
}

module.exports = new AuditLogService()
