/**
 * 支付服务
 * 统一管理各支付渠道，提供统一的支付接口
 */

const logger = require('../../utils/logger')
const { prisma } = require('../../models/prisma')
const orderService = require('../orders/orderService')

// 支付方式配置
const PAYMENT_METHODS = {
  alipay: {
    name: '支付宝',
    enabled: !!process.env.ALIPAY_APP_ID,
    instructions: '请使用支付宝扫描二维码完成支付'
  },
  wechat: {
    name: '微信支付',
    enabled: !!process.env.WECHAT_APP_ID,
    instructions: '请使用微信扫描二维码完成支付'
  },
  stripe: {
    name: 'Stripe',
    enabled: !!process.env.STRIPE_SECRET_KEY,
    instructions: '点击链接跳转到支付页面，支持信用卡支付'
  }
}

/**
 * 获取可用的支付方式
 * @returns {Array}
 */
function getAvailablePaymentMethods() {
  return Object.entries(PAYMENT_METHODS)
    .filter(([, config]) => config.enabled)
    .map(([key, config]) => ({
      key,
      name: config.name
    }))
}

/**
 * 发起支付
 * @param {string} orderId - 订单ID
 * @param {string} paymentMethod - 支付方式
 * @param {Object} options - 额外选项
 * @returns {Promise<Object>}
 */
async function initiatePayment(orderId, paymentMethod, options = {}) {
  const { userEmail, returnUrl } = options

  // 1. 获取订单
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true }
  })

  if (!order) {
    const error = new Error('订单不存在')
    error.code = 'ORDER_NOT_FOUND'
    throw error
  }

  // 2. 检查订单状态
  if (order.status !== 'pending') {
    const error = new Error('订单状态不允许支付')
    error.code = 'INVALID_ORDER_STATUS'
    throw error
  }

  // 3. 检查订单是否过期
  if (new Date() > new Date(order.expireAt)) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'expired' }
    })
    const error = new Error('订单已过期')
    error.code = 'ORDER_EXPIRED'
    throw error
  }

  // 4. 检查支付方式是否可用
  const methodConfig = PAYMENT_METHODS[paymentMethod]
  if (!methodConfig || !methodConfig.enabled) {
    const error = new Error('不支持的支付方式')
    error.code = 'UNSUPPORTED_PAYMENT_METHOD'
    throw error
  }

  // 5. 调用对应的支付服务
  let paymentInfo

  try {
    switch (paymentMethod) {
      case 'alipay':
        paymentInfo = await createAlipayPayment(order)
        break
      case 'wechat':
        paymentInfo = await createWechatPayment(order)
        break
      case 'stripe':
        paymentInfo = await createStripePayment(order, userEmail, returnUrl)
        break
      default:
        throw new Error('不支持的支付方式')
    }
  } catch (err) {
    logger.error(`创建支付失败: ${err.message}`, {
      orderId,
      paymentMethod,
      error: err.message
    })
    throw err
  }

  // 6. 更新订单支付信息
  await orderService.updatePaymentInfo(orderId, paymentInfo)

  logger.info(`发起支付: ${orderId}`, { paymentMethod })

  return {
    orderId,
    paymentMethod,
    paymentInfo,
    expireAt: order.expireAt,
    instructions: methodConfig.instructions
  }
}

/**
 * 创建支付宝支付
 * @param {Object} order - 订单信息
 * @returns {Promise<Object>}
 */
async function createAlipayPayment(order) {
  // 检查是否配置了支付宝
  if (!process.env.ALIPAY_APP_ID) {
    throw new Error('支付宝支付未配置')
  }

  // TODO: 集成支付宝SDK
  // 这里返回模拟数据，实际应调用支付宝API
  const planSnapshot =
    typeof order.planSnapshot === 'string' ? JSON.parse(order.planSnapshot) : order.planSnapshot

  return {
    method: 'alipay',
    outTradeNo: order.id,
    subject: `${planSnapshot.name} - ${planSnapshot.billingCycle || '订阅'}`,
    totalAmount: parseFloat(order.finalPrice).toFixed(2),
    // 以下为模拟数据
    qrCode: `https://qr.alipay.com/mock_${order.id}`,
    payUrl: `https://openapi.alipay.com/gateway.do?mock_order=${order.id}`
  }
}

/**
 * 创建微信支付
 * @param {Object} order - 订单信息
 * @returns {Promise<Object>}
 */
async function createWechatPayment(order) {
  // 检查是否配置了微信支付
  if (!process.env.WECHAT_APP_ID) {
    throw new Error('微信支付未配置')
  }

  // TODO: 集成微信支付SDK
  // 这里返回模拟数据
  return {
    method: 'wechat',
    outTradeNo: order.id,
    codeUrl: `weixin://wxpay/bizpayurl?pr=mock_${order.id}`,
    // 实际应生成真实的二维码图片
    qrCodeImage: null
  }
}

/**
 * 创建Stripe支付
 * @param {Object} order - 订单信息
 * @param {string} userEmail - 用户邮箱
 * @param {string} returnUrl - 返回URL
 * @returns {Promise<Object>}
 */
async function createStripePayment(order, _userEmail, _returnUrl) {
  // 检查是否配置了Stripe
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe支付未配置')
  }

  // TODO: 集成Stripe SDK，使用 _userEmail 和 _returnUrl
  // 这里返回模拟数据
  return {
    method: 'stripe',
    sessionId: `cs_mock_${order.id}`,
    checkoutUrl: `https://checkout.stripe.com/pay/mock_${order.id}`,
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock'
  }
}

/**
 * 处理支付回调
 * @param {string} paymentMethod - 支付方式
 * @param {Object} callbackData - 回调数据
 * @param {string} sourceIp - 来源IP
 * @returns {Promise<Object>}
 */
async function handlePaymentCallback(paymentMethod, callbackData, sourceIp) {
  let orderId
  let transactionId
  let isSuccess = false
  let signatureValid = false
  let verificationResult = ''

  try {
    // 根据支付方式解析回调数据
    switch (paymentMethod) {
      case 'alipay':
        orderId = callbackData.out_trade_no
        transactionId = callbackData.trade_no
        isSuccess =
          callbackData.trade_status === 'TRADE_SUCCESS' ||
          callbackData.trade_status === 'TRADE_FINISHED'
        // TODO: 验证签名
        signatureValid = true
        verificationResult = '签名验证通过（模拟）'
        break

      case 'wechat':
        orderId = callbackData.out_trade_no
        transactionId = callbackData.transaction_id
        isSuccess = callbackData.trade_state === 'SUCCESS'
        signatureValid = true
        verificationResult = '签名验证通过（模拟）'
        break

      case 'stripe': {
        const session = callbackData.data?.object
        orderId = session?.metadata?.order_id
        transactionId = session?.payment_intent
        isSuccess = session?.payment_status === 'paid'
        signatureValid = true
        verificationResult = '签名验证通过（模拟）'
        break
      }

      default:
        throw new Error('不支持的支付方式')
    }

    // 记录回调日志
    const callback = await prisma.paymentCallback.create({
      data: {
        orderId,
        paymentMethod,
        callbackData,
        signatureValid,
        verificationResult,
        sourceIp,
        processed: false
      }
    })

    // 处理支付结果
    if (isSuccess && signatureValid) {
      const result = await orderService.handlePaymentSuccess(orderId, transactionId)

      // 更新回调记录
      await prisma.paymentCallback.update({
        where: { id: callback.id },
        data: {
          processed: true,
          processResult: result.duplicate ? '重复回调，已跳过' : '处理成功',
          processedAt: new Date()
        }
      })

      return { success: true, orderId, duplicate: result.duplicate }
    } else {
      await prisma.paymentCallback.update({
        where: { id: callback.id },
        data: {
          processed: true,
          processResult: signatureValid ? '支付未成功' : '签名验证失败',
          processedAt: new Date()
        }
      })

      return { success: false, orderId, reason: '支付未成功或签名无效' }
    }
  } catch (error) {
    logger.error(`处理支付回调失败: ${error.message}`, {
      paymentMethod,
      orderId,
      error: error.message
    })

    // 记录错误
    if (orderId) {
      await prisma.paymentCallback
        .create({
          data: {
            orderId,
            paymentMethod,
            callbackData,
            signatureValid,
            verificationResult,
            sourceIp,
            processed: true,
            processResult: '处理失败',
            errorMessage: error.message
          }
        })
        .catch((e) => logger.error('记录回调失败:', e))
    }

    throw error
  }
}

module.exports = {
  getAvailablePaymentMethods,
  initiatePayment,
  handlePaymentCallback,
  PAYMENT_METHODS
}
