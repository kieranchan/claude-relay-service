/**
 * 审计日志路由
 * 管理员查看操作日志
 *
 * 路由前缀: /admin/audit-logs
 */

const express = require('express')
const router = express.Router()
const auditLogService = require('../../services/auditLogService')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')

/**
 * GET /
 * 获取审计日志列表
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { page, limit, adminId, targetUserId, action, startDate, endDate } = req.query

    const result = await auditLogService.getLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      adminId,
      targetUserId,
      action,
      startDate,
      endDate
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Get audit logs error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '获取审计日志失败' }
    })
  }
})

module.exports = router
