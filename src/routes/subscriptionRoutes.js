/**
 * 订阅路由
 * 处理订阅查询、升级、取消、续费等操作
 * @module subscriptionRoutes
 */

const express = require('express')
const router = express.Router()
const { body, param, query, validationResult } = require('express-validator')
const logger = require('../utils/logger')
const subscriptionService = require('../services/subscriptions/subscriptionService')

// 用户认证中间件
const { authenticateJwt, requireEmailAdmin } = require('../middleware/authenticateJwt')

// ========================================
// 验证结果处理中间件
// ========================================

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '请求参数错误',
        details: errors.array()
      }
    })
  }
  next()
}

// ========================================
// 用户订阅路由
// ========================================

/**
 * GET /api/v1/subscriptions/current
 * 获取当前订阅
 */
router.get('/current', authenticateJwt, async (req, res) => {
  try {
    const userId = req.emailUser.id
    const subscription = await subscriptionService.getCurrentSubscription(userId)

    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: '暂无有效订阅'
      })
    }

    res.json({
      success: true,
      data: subscription
    })
  } catch (error) {
    logger.error(`获取当前订阅失败: ${error.message}`)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取订阅信息失败'
      }
    })
  }
})

/**
 * GET /api/v1/subscriptions/history
 * 获取订阅历史
 */
router.get(
  '/history',
  authenticateJwt,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { page, limit } = req.query

      const result = await subscriptionService.getSubscriptionHistory(userId, {
        page: page || 1,
        limit: limit || 20
      })

      res.json({
        success: true,
        data: result.subscriptions,
        pagination: result.pagination
      })
    } catch (error) {
      logger.error(`获取订阅历史失败: ${error.message}`)
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取订阅历史失败'
        }
      })
    }
  }
)

/**
 * POST /api/v1/subscriptions/upgrade
 * 升级订阅
 */
router.post(
  '/upgrade',
  authenticateJwt,
  [
    body('target_plan_id').notEmpty().withMessage('目标套餐ID不能为空'),
    body('upgrade_mode').optional().isIn(['immediate', 'next_cycle']).withMessage('升级模式无效')
  ],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { target_plan_id, upgrade_mode } = req.body

      const result = await subscriptionService.upgradeSubscription(
        userId,
        target_plan_id,
        upgrade_mode || 'immediate'
      )

      const message =
        result.type === 'immediate'
          ? '订阅升级已启动，请完成补差价支付'
          : '已安排在下个计费周期升级'

      res.json({
        success: true,
        message,
        data: result
      })
    } catch (error) {
      logger.error(`升级订阅失败: ${error.message}`)

      const statusMap = {
        NO_ACTIVE_SUBSCRIPTION: 404,
        PLAN_NOT_FOUND: 404,
        INVALID_UPGRADE: 400
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      })
    }
  }
)

/**
 * POST /api/v1/subscriptions/cancel
 * 取消订阅
 */
router.post(
  '/cancel',
  authenticateJwt,
  [
    body('cancel_mode').optional().isIn(['immediate', 'end_of_cycle']).withMessage('取消模式无效'),
    body('reason').optional().isString().isLength({ max: 500 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { cancel_mode, reason } = req.body

      const result = await subscriptionService.cancelSubscription(
        userId,
        cancel_mode || 'end_of_cycle',
        reason
      )

      const message =
        result.mode === 'immediate' ? '订阅已立即取消' : '订阅将在到期后取消，期间仍可正常使用'

      res.json({
        success: true,
        message,
        data: result
      })
    } catch (error) {
      logger.error(`取消订阅失败: ${error.message}`)

      const statusMap = {
        NO_ACTIVE_SUBSCRIPTION: 404
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      })
    }
  }
)

/**
 * POST /api/v1/subscriptions/toggle-renew
 * 开关自动续费
 */
router.post(
  '/toggle-renew',
  authenticateJwt,
  [body('auto_renew').isBoolean().withMessage('auto_renew 必须是布尔值')],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { auto_renew } = req.body

      const result = await subscriptionService.toggleAutoRenew(userId, auto_renew)

      res.json({
        success: true,
        message: auto_renew ? '自动续费已开启' : '自动续费已关闭',
        data: result
      })
    } catch (error) {
      logger.error(`切换自动续费失败: ${error.message}`)

      const statusMap = {
        NO_ACTIVE_SUBSCRIPTION: 404
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      })
    }
  }
)

/**
 * POST /api/v1/subscriptions/renew
 * 手动续费
 */
router.post(
  '/renew',
  authenticateJwt,
  [body('payment_method').isIn(['alipay', 'wechat', 'stripe']).withMessage('支付方式无效')],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { payment_method } = req.body

      const result = await subscriptionService.manualRenew(userId, payment_method)

      res.json({
        success: true,
        message: '续费信息已生成，请完成支付',
        data: result
      })
    } catch (error) {
      logger.error(`手动续费失败: ${error.message}`)

      const statusMap = {
        NO_ACTIVE_SUBSCRIPTION: 404,
        PLAN_NOT_FOUND: 404
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      })
    }
  }
)

// ========================================
// 管理员订阅路由
// ========================================

/**
 * POST /api/v1/admin/subscriptions/:id/suspend
 * 暂停订阅（管理员）
 */
router.post(
  '/admin/:id/suspend',
  authenticateJwt,
  requireEmailAdmin,
  [param('id').isUUID().withMessage('订阅ID格式无效'), body('reason').optional().isString()],
  handleValidation,
  async (req, res) => {
    try {
      const subscriptionId = req.params.id
      const adminId = req.emailUser.id
      const { reason } = req.body

      const result = await subscriptionService.suspendSubscription(subscriptionId, adminId, reason)

      res.json({
        success: true,
        message: '订阅已暂停',
        data: result
      })
    } catch (error) {
      logger.error(`暂停订阅失败: ${error.message}`)

      const statusMap = {
        SUBSCRIPTION_NOT_FOUND: 404,
        INVALID_STATUS: 400
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      })
    }
  }
)

/**
 * POST /api/v1/admin/subscriptions/:id/resume
 * 恢复订阅（管理员）
 */
router.post(
  '/admin/:id/resume',
  authenticateJwt,
  requireEmailAdmin,
  [param('id').isUUID().withMessage('订阅ID格式无效')],
  handleValidation,
  async (req, res) => {
    try {
      const subscriptionId = req.params.id
      const adminId = req.emailUser.id

      const result = await subscriptionService.resumeSubscription(subscriptionId, adminId)

      res.json({
        success: true,
        message: '订阅已恢复',
        data: result
      })
    } catch (error) {
      logger.error(`恢复订阅失败: ${error.message}`)

      const statusMap = {
        SUBSCRIPTION_NOT_FOUND: 404,
        INVALID_STATUS: 400
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        }
      })
    }
  }
)

module.exports = router
