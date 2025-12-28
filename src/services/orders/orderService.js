/**
 * 订单服务
 * 处理订单的创建、查询、取消等核心业务逻辑
 */

const { prisma } = require('../../models/prisma')
const logger = require('../../utils/logger')
const { generateOrderId } = require('../../utils/orderIdGenerator')
const { calculatePrice } = require('../../utils/priceCalculator')

// 订单过期时间（分钟）
const ORDER_EXPIRE_MINUTES = 15

/**
 * 创建订单
 * @param {Object} params
 * @param {string} params.userId - 用户ID
 * @param {string} params.planId - 套餐ID
 * @param {string} params.paymentMethod - 支付方式
 * @param {string} params.couponCode - 优惠券码（可选）
 * @param {string} params.userIp - 用户IP
 * @param {string} params.userAgent - 用户设备信息
 * @returns {Promise<Object>}
 */
async function createOrder(params) {
  const { userId, planId, paymentMethod, couponCode, userIp, userAgent } = params

  // 1. 检查用户是否有待支付订单
  const pendingOrder = await prisma.order.findFirst({
    where: {
      userId,
      status: 'pending',
      expireAt: { gt: new Date() }
    }
  })

  if (pendingOrder) {
    const error = new Error('您有待支付的订单，请先完成支付或取消')
    error.code = 'PENDING_ORDER_EXISTS'
    error.data = { pendingOrderId: pendingOrder.id }
    throw error
  }

  // 2. 获取套餐信息
  const plan = await prisma.plan.findUnique({
    where: { id: planId }
  })

  if (!plan || plan.status !== 'active') {
    const error = new Error('套餐不存在或已下架')
    error.code = 'PLAN_NOT_FOUND'
    throw error
  }

  // 3. 获取用户信息（检查邀请关系）
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    const error = new Error('用户不存在')
    error.code = 'USER_NOT_FOUND'
    throw error
  }

  // 4. 验证优惠券（TODO: 后续实现优惠券系统）
  const coupon = null
  if (couponCode) {
    // 暂时跳过优惠券验证
    logger.info(`优惠券验证暂未实现: ${couponCode}`)
  }

  // 5. 计算价格
  const priceInfo = calculatePrice({
    planPrice: parseFloat(plan.price),
    coupon,
    invitedBy: user.invitedById
  })

  // 6. 生成订单号和过期时间
  const orderId = generateOrderId()
  const expireAt = new Date(Date.now() + ORDER_EXPIRE_MINUTES * 60 * 1000)

  // 7. 创建订单
  const order = await prisma.order.create({
    data: {
      id: orderId,
      userId,
      planId,
      planSnapshot: JSON.parse(JSON.stringify(plan)), // 深拷贝套餐快照
      originalPrice: priceInfo.originalPrice,
      discountAmount: priceInfo.totalDiscount,
      finalPrice: priceInfo.finalPrice,
      currency: plan.currency || 'CNY',
      couponCode: couponCode || null,
      couponDiscount: priceInfo.couponDiscount,
      inviteDiscount: priceInfo.inviteDiscount,
      paymentMethod,
      status: 'pending',
      paymentStatus: 'pending',
      userIp,
      userAgent,
      expireAt
    }
  })

  logger.info(`订单创建成功: ${orderId}`, {
    userId,
    planId,
    finalPrice: priceInfo.finalPrice
  })

  return formatOrderResponse(order)
}

/**
 * 获取订单详情
 * @param {string} orderId - 订单ID
 * @param {string} userId - 用户ID（用于权限验证）
 * @returns {Promise<Object>}
 */
async function getOrderById(orderId, userId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      plan: true,
      user: {
        select: { id: true, email: true }
      }
    }
  })

  if (!order) {
    const error = new Error('订单不存在')
    error.code = 'ORDER_NOT_FOUND'
    throw error
  }

  // 验证订单所属权
  if (order.userId !== userId) {
    const error = new Error('无权访问此订单')
    error.code = 'FORBIDDEN'
    throw error
  }

  return formatOrderResponse(order)
}

/**
 * 获取用户订单列表
 * @param {string} userId - 用户ID
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Object>}
 */
async function getOrdersByUserId(userId, filters = {}) {
  const { status, page = 1, limit = 20 } = filters
  const skip = (page - 1) * limit

  const where = { userId }
  if (status) {
    where.status = status
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.order.count({ where })
  ])

  return {
    orders: orders.map(formatOrderListItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * 取消订单
 * @param {string} orderId - 订单ID
 * @param {string} userId - 用户ID
 * @param {string} reason - 取消原因
 * @returns {Promise<boolean>}
 */
async function cancelOrder(orderId, userId, reason) {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  })

  if (!order) {
    const error = new Error('订单不存在')
    error.code = 'ORDER_NOT_FOUND'
    throw error
  }

  if (order.userId !== userId) {
    const error = new Error('无权操作此订单')
    error.code = 'FORBIDDEN'
    throw error
  }

  if (order.status !== 'pending') {
    const error = new Error('只能取消待支付的订单')
    error.code = 'CANNOT_CANCEL'
    throw error
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'cancelled',
      cancelReason: reason,
      cancelledAt: new Date()
    }
  })

  logger.info(`订单已取消: ${orderId}`, { userId, reason })

  return true
}

/**
 * 更新订单支付信息
 * @param {string} orderId - 订单ID
 * @param {Object} paymentInfo - 支付信息
 * @returns {Promise<Object>}
 */
async function updatePaymentInfo(orderId, paymentInfo) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentInfo
    }
  })

  return order
}

/**
 * 处理支付成功
 * @param {string} orderId - 订单ID
 * @param {string} transactionId - 第三方交易号
 * @returns {Promise<Object>}
 */
async function handlePaymentSuccess(orderId, transactionId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  })

  if (!order) {
    throw new Error('订单不存在')
  }

  // 防止重复处理
  if (order.status === 'paid') {
    logger.info(`订单 ${orderId} 已支付，跳过重复处理`)
    return { duplicate: true, order }
  }

  // 使用事务处理
  const result = await prisma.$transaction(async (tx) => {
    // 1. 更新订单状态
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        paymentStatus: 'success',
        transactionId,
        paidAt: new Date()
      }
    })

    // 2. 创建订阅记录
    const planSnapshot =
      typeof order.planSnapshot === 'string' ? JSON.parse(order.planSnapshot) : order.planSnapshot

    const billingCycle = planSnapshot.billingCycle || 'monthly'
    const startDate = new Date()
    const expireDate = new Date()

    if (billingCycle === 'monthly') {
      expireDate.setMonth(expireDate.getMonth() + 1)
    } else if (billingCycle === 'yearly') {
      expireDate.setFullYear(expireDate.getFullYear() + 1)
    } else if (billingCycle === 'lifetime') {
      expireDate.setFullYear(expireDate.getFullYear() + 100) // 终身
    }

    const subscription = await tx.subscription.create({
      data: {
        userId: order.userId,
        planId: order.planId,
        planSnapshot: order.planSnapshot,
        status: 'active',
        startDate,
        expireDate,
        autoRenew: billingCycle !== 'lifetime'
      }
    })

    // 3. 更新套餐统计
    await tx.plan.update({
      where: { id: order.planId },
      data: {
        subscribersCount: { increment: 1 },
        totalRevenue: { increment: order.finalPrice }
      }
    })

    return { order: updatedOrder, subscription }
  })

  logger.info(`订单支付成功: ${orderId}`, {
    transactionId,
    subscriptionId: result.subscription.id
  })

  return result
}

/**
 * 处理过期订单
 * @param {number} batchSize - 每批处理数量
 * @returns {Promise<number>} 处理的订单数量
 */
async function processExpiredOrders(batchSize = 100) {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'pending',
      expireAt: { lte: new Date() }
    },
    take: batchSize,
    select: { id: true }
  })

  if (expiredOrders.length === 0) {
    return 0
  }

  const orderIds = expiredOrders.map((o) => o.id)

  const result = await prisma.order.updateMany({
    where: { id: { in: orderIds } },
    data: {
      status: 'expired',
      cancelledAt: new Date()
    }
  })

  logger.info(`处理过期订单: ${result.count} 个`)

  return result.count
}

/**
 * 格式化订单响应
 */
function formatOrderResponse(order) {
  const planSnapshot =
    typeof order.planSnapshot === 'string' ? JSON.parse(order.planSnapshot) : order.planSnapshot

  return {
    orderId: order.id,
    userId: order.userId,
    plan: {
      id: order.planId,
      name: planSnapshot?.name,
      billingCycle: planSnapshot?.billingCycle,
      snapshot: planSnapshot
    },
    amount: {
      originalPrice: parseFloat(order.originalPrice),
      discountAmount: parseFloat(order.discountAmount),
      finalPrice: parseFloat(order.finalPrice),
      currency: order.currency
    },
    discountBreakdown: {
      coupon: order.couponCode
        ? {
            code: order.couponCode,
            amount: parseFloat(order.couponDiscount)
          }
        : null,
      invite:
        parseFloat(order.inviteDiscount) > 0 ? { amount: parseFloat(order.inviteDiscount) } : null
    },
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    transactionId: order.transactionId,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    expireAt: order.expireAt
  }
}

/**
 * 格式化订单列表项
 */
function formatOrderListItem(order) {
  const planSnapshot =
    typeof order.planSnapshot === 'string' ? JSON.parse(order.planSnapshot) : order.planSnapshot

  return {
    orderId: order.id,
    planName: planSnapshot?.name || '未知套餐',
    amount: parseFloat(order.finalPrice),
    currency: order.currency,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    paidAt: order.paidAt
  }
}

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByUserId,
  cancelOrder,
  updatePaymentInfo,
  handlePaymentSuccess,
  processExpiredOrders,
  ORDER_EXPIRE_MINUTES
}
