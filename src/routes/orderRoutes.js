/**
 * 订单路由
 * 处理订单创建、查询、支付、取消等操作
 * @module orderRoutes
 */

const express = require('express')
const router = express.Router()
const { body, param, query, validationResult } = require('express-validator')
const logger = require('../utils/logger')
const orderService = require('../services/orders/orderService')
const paymentService = require('../services/payment/paymentService')

// 用户认证中间件
const { authenticateJwt } = require('../middleware/authenticateJwt')

// ========================================
// 公开路由（无需认证）
// ========================================

/**
 * GET /api/v1/orders/payment-methods
 * 获取可用的支付方式
 */
router.get('/payment-methods', (req, res) => {
  const methods = paymentService.getAvailablePaymentMethods()
  res.json({
    success: true,
    data: methods
  })
})

// ========================================
// 需要认证的路由
// ========================================

/**
 * 验证结果处理中间件
 */
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

/**
 * POST /api/v1/orders/create
 * 创建订单
 */
router.post(
  '/create',
  authenticateJwt,
  [
    body('plan_id').notEmpty().withMessage('套餐ID不能为空'),
    body('payment_method').isIn(['alipay', 'wechat', 'stripe']).withMessage('支付方式无效'),
    body('coupon_code').optional().isString()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { plan_id, payment_method, coupon_code } = req.body
      const userIp = req.ip || req.connection.remoteAddress
      const userAgent = req.headers['user-agent']

      const order = await orderService.createOrder({
        userId,
        planId: plan_id,
        paymentMethod: payment_method,
        couponCode: coupon_code,
        userIp,
        userAgent
      })

      res.status(201).json({
        success: true,
        message: '订单创建成功',
        data: order
      })
    } catch (error) {
      logger.error(`创建订单失败: ${error.message}`)

      const statusMap = {
        PENDING_ORDER_EXISTS: 400,
        PLAN_NOT_FOUND: 404,
        USER_NOT_FOUND: 404,
        INVALID_COUPON: 400
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          data: error.data
        }
      })
    }
  }
)

/**
 * GET /api/v1/orders/list
 * 获取订单列表
 */
router.get(
  '/list',
  authenticateJwt,
  [
    query('status').optional().isIn(['pending', 'paid', 'cancelled', 'expired', 'refunded']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const { status, page, limit } = req.query

      const result = await orderService.getOrdersByUserId(userId, {
        status,
        page: page || 1,
        limit: limit || 20
      })

      res.json({
        success: true,
        data: result.orders,
        pagination: result.pagination
      })
    } catch (error) {
      logger.error(`获取订单列表失败: ${error.message}`)
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取订单列表失败'
        }
      })
    }
  }
)

/**
 * GET /api/v1/orders/:id
 * 获取订单详情
 */
router.get(
  '/:id',
  authenticateJwt,
  [param('id').notEmpty().withMessage('订单ID不能为空')],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const orderId = req.params.id

      const order = await orderService.getOrderById(orderId, userId)

      res.json({
        success: true,
        data: order
      })
    } catch (error) {
      logger.error(`获取订单详情失败: ${error.message}`)

      const statusMap = {
        ORDER_NOT_FOUND: 404,
        FORBIDDEN: 403
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
 * GET /api/v1/orders/:id/status
 * 查询订单状态（用于前端轮询）
 */
router.get(
  '/:id/status',
  authenticateJwt,
  [param('id').notEmpty()],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const orderId = req.params.id

      const order = await orderService.getOrderById(orderId, userId)

      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paidAt: order.paidAt
        }
      })
    } catch (error) {
      res.status(error.code === 'ORDER_NOT_FOUND' ? 404 : 500).json({
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
 * POST /api/v1/orders/:id/pay
 * 发起支付
 */
router.post(
  '/:id/pay',
  authenticateJwt,
  [
    param('id').notEmpty(),
    body('payment_method').isIn(['alipay', 'wechat', 'stripe']).withMessage('支付方式无效'),
    body('return_url').optional().isURL()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const orderId = req.params.id
      const { payment_method, return_url } = req.body

      // 验证订单所属权
      await orderService.getOrderById(orderId, userId)

      const result = await paymentService.initiatePayment(orderId, payment_method, {
        userEmail: req.emailUser.email,
        returnUrl: return_url
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error(`发起支付失败: ${error.message}`)

      const statusMap = {
        ORDER_NOT_FOUND: 404,
        FORBIDDEN: 403,
        INVALID_ORDER_STATUS: 400,
        ORDER_EXPIRED: 400,
        UNSUPPORTED_PAYMENT_METHOD: 400
      }

      res.status(statusMap[error.code] || 500).json({
        success: false,
        error: {
          code: error.code || 'PAYMENT_ERROR',
          message: error.message
        }
      })
    }
  }
)

/**
 * POST /api/v1/orders/:id/cancel
 * 取消订单
 */
router.post(
  '/:id/cancel',
  authenticateJwt,
  [param('id').notEmpty(), body('reason').optional().isString()],
  handleValidation,
  async (req, res) => {
    try {
      const userId = req.emailUser.id
      const orderId = req.params.id
      const { reason } = req.body

      await orderService.cancelOrder(orderId, userId, reason)

      res.json({
        success: true,
        message: '订单已取消'
      })
    } catch (error) {
      logger.error(`取消订单失败: ${error.message}`)

      const statusMap = {
        ORDER_NOT_FOUND: 404,
        FORBIDDEN: 403,
        CANNOT_CANCEL: 400
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
// 支付回调路由（公开接口，无需认证）
// ========================================

/**
 * POST /api/v1/payment/callback/alipay
 * 支付宝回调
 */
router.post('/payment/callback/alipay', async (req, res) => {
  try {
    const callbackData = req.body
    const sourceIp = req.ip

    await paymentService.handlePaymentCallback('alipay', callbackData, sourceIp)

    // 支付宝要求返回纯文本 "success"
    res.send('success')
  } catch (error) {
    logger.error(`支付宝回调处理失败: ${error.message}`)
    res.send('failure')
  }
})

/**
 * POST /api/v1/payment/callback/wechat
 * 微信支付回调
 */
router.post('/payment/callback/wechat', async (req, res) => {
  try {
    const callbackData = req.body
    const sourceIp = req.ip

    await paymentService.handlePaymentCallback('wechat', callbackData, sourceIp)

    // 微信要求返回XML格式
    res.set('Content-Type', 'application/xml')
    res.send('<xml><return_code>SUCCESS</return_code><return_msg>OK</return_msg></xml>')
  } catch (error) {
    logger.error(`微信支付回调处理失败: ${error.message}`)
    res.set('Content-Type', 'application/xml')
    res.send(`<xml><return_code>FAIL</return_code><return_msg>${error.message}</return_msg></xml>`)
  }
})

/**
 * POST /api/v1/payment/callback/stripe
 * Stripe Webhook
 */
router.post('/payment/callback/stripe', async (req, res) => {
  try {
    const callbackData = req.body
    const sourceIp = req.ip

    await paymentService.handlePaymentCallback('stripe', callbackData, sourceIp)

    res.json({ received: true })
  } catch (error) {
    logger.error(`Stripe Webhook处理失败: ${error.message}`)
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
