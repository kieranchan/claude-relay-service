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

/**
 * POST /api/v1/orders/:id/simulate-pay
 * 模拟支付成功（仅用于开发/测试环境）
 */
router.post(
  '/:id/simulate-pay',
  authenticateJwt,
  [param('id').notEmpty()],
  handleValidation,
  async (req, res) => {
    // 仅在开发环境或显式开启时可用
    const allowSimulatePay =
      process.env.NODE_ENV !== 'production' || process.env.ALLOW_SIMULATE_PAY === 'true'

    if (!allowSimulatePay) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '生产环境不支持模拟支付'
        }
      })
    }

    try {
      const userId = req.emailUser.id
      const orderId = req.params.id

      // 验证订单归属和状态
      const order = await orderService.getOrderById(orderId, userId)
      if (order.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ORDER_STATUS',
            message: `订单状态无效: ${order.status}`
          }
        })
      }

      // 模拟支付回调数据
      const transactionId = `MOCK_TXN_${Date.now()}`

      // 调用支付成功处理
      await orderService.handlePaymentSuccess(orderId, transactionId)

      res.json({
        success: true,
        message: '模拟支付成功',
        data: {
          orderId,
          transactionId
        }
      })
    } catch (error) {
      logger.error(`模拟支付失败: ${error.message}`)
      res.status(500).json({
        success: false,
        error: {
          code: error.code || 'PAYMENT_ERROR',
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

// ========================================
// 测试路由（仅开发环境）
// ========================================

/**
 * POST /api/v1/orders/test/simulate-payment
 * 模拟支付成功（仅在 TEST_MODE=true 时可用）
 * 用于测试订阅-API Key 自动创建流程
 */
router.post('/test/simulate-payment', authenticateJwt, async (req, res) => {
  // 检查是否启用测试模式
  if (process.env.TEST_MODE !== 'true') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'TEST_MODE_DISABLED',
        message: '测试模式未启用。请在 .env 中设置 TEST_MODE=true'
      }
    })
  }

  try {
    const { order_id } = req.body
    const userId = req.emailUser.id

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ORDER_ID', message: '订单ID不能为空' }
      })
    }

    // 验证订单属于当前用户
    const order = await orderService.getOrderById(order_id, userId)
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: '订单不存在' }
      })
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: '订单状态不是待支付' }
      })
    }

    // 模拟支付成功
    const transactionId = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const result = await orderService.handlePaymentSuccess(order_id, transactionId)

    logger.info(`🧪 [TEST] 模拟支付成功: ${order_id}`, {
      userId,
      transactionId,
      subscriptionId: result.subscription?.id
    })

    res.json({
      success: true,
      message: '✅ 测试支付成功！订阅和 API Key 已创建',
      data: {
        orderId: order_id,
        transactionId,
        subscription: result.subscription,
        apiKeyCreated: true
      }
    })
  } catch (error) {
    logger.error(`测试支付模拟失败: ${error.message}`)
    res.status(500).json({
      success: false,
      error: { code: 'SIMULATION_FAILED', message: error.message }
    })
  }
})

module.exports = router
