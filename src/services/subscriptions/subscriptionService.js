/**
 * 订阅服务
 * 处理订阅的创建、查询、升级、取消等核心业务逻辑
 * @module subscriptionService
 */

const { prisma } = require('../../models/prisma')
const logger = require('../../utils/logger')
const {
  calculateExpireDate,
  daysRemaining,
  getCycleDays,
  formatDate
} = require('../../utils/dateHelper')

/**
 * 从订单创建订阅
 * @param {Object} order - 订单信息
 * @param {Object} tx - 事务客户端（可选）
 * @returns {Promise<Object>}
 */
async function createFromOrder(order, tx = prisma) {
  const planSnapshot =
    typeof order.planSnapshot === 'string' ? JSON.parse(order.planSnapshot) : order.planSnapshot

  const billingCycle = planSnapshot.billingCycle || 'monthly'
  const startDate = new Date()
  const expireDate = calculateExpireDate(startDate, billingCycle)
  const nextBillingDate = billingCycle !== 'lifetime' ? expireDate : null

  // 检查是否已有活跃订阅（需要取消或过期）
  const existingSubscription = await tx.subscription.findFirst({
    where: {
      userId: order.userId,
      status: 'active'
    }
  })

  if (existingSubscription) {
    // 将现有订阅标记为已被升级
    await tx.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'expired',
        cancelledAt: new Date()
      }
    })
  }

  // 创建新订阅
  const subscription = await tx.subscription.create({
    data: {
      userId: order.userId,
      planId: order.planId,
      orderId: order.id,
      planSnapshot: order.planSnapshot,
      status: 'active',
      startDate,
      expireDate,
      nextBillingDate,
      autoRenew: billingCycle !== 'lifetime',
      upgradedFromId: existingSubscription?.id || null
    }
  })

  // 记录变更
  await tx.subscriptionChange.create({
    data: {
      subscriptionId: subscription.id,
      userId: order.userId,
      changeType: 'created',
      newPlanId: order.planId,
      newStatus: 'active',
      newExpireDate: expireDate,
      relatedOrderId: order.id,
      operatedBy: order.userId
    }
  })

  logger.info(`订阅创建成功: ${subscription.id}`, {
    userId: order.userId,
    planId: order.planId,
    expireDate: formatDate(expireDate)
  })

  return subscription
}

/**
 * 获取用户当前有效订阅
 * @param {string} userId - 用户ID
 * @returns {Promise<Object|null>}
 */
async function getCurrentSubscription(userId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'active'
    },
    include: {
      plan: true,
      apiKey: true // 关联的 API Key
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!subscription) {
    return null
  }

  return formatSubscriptionResponse(subscription)
}

/**
 * 获取订阅历史
 * @param {string} userId - 用户ID
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Object>}
 */
async function getSubscriptionHistory(userId, filters = {}) {
  const { page = 1, limit = 20 } = filters
  const skip = (page - 1) * limit

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.subscription.count({ where: { userId } })
  ])

  return {
    subscriptions: subscriptions.map(formatSubscriptionListItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * 升级订阅
 * @param {string} userId - 用户ID
 * @param {string} targetPlanId - 目标套餐ID
 * @param {string} upgradeMode - 升级模式 (immediate | next_cycle)
 * @returns {Promise<Object>}
 */
async function upgradeSubscription(userId, targetPlanId, upgradeMode = 'immediate') {
  const currentSub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' }
  })

  if (!currentSub) {
    const error = new Error('没有有效订阅')
    error.code = 'NO_ACTIVE_SUBSCRIPTION'
    throw error
  }

  const targetPlan = await prisma.plan.findUnique({
    where: { id: targetPlanId }
  })

  if (!targetPlan || targetPlan.status !== 'active') {
    const error = new Error('目标套餐不存在或已下架')
    error.code = 'PLAN_NOT_FOUND'
    throw error
  }

  const currentPlanSnapshot =
    typeof currentSub.planSnapshot === 'string'
      ? JSON.parse(currentSub.planSnapshot)
      : currentSub.planSnapshot

  const currentPrice = parseFloat(currentPlanSnapshot.price || 0)
  const targetPrice = parseFloat(targetPlan.price)

  if (targetPrice <= currentPrice) {
    const error = new Error('只能升级到更高价格的套餐')
    error.code = 'INVALID_UPGRADE'
    throw error
  }

  if (upgradeMode === 'immediate') {
    // 立即升级：计算补差价
    const remainingDaysValue = daysRemaining(currentSub.expireDate)
    const totalDays = getCycleDays(currentPlanSnapshot.billingCycle || 'monthly')
    const proratedAmount = calculateProration(
      currentPrice,
      targetPrice,
      remainingDaysValue,
      totalDays
    )

    // 记录待升级状态
    await prisma.subscriptionChange.create({
      data: {
        subscriptionId: currentSub.id,
        userId,
        changeType: 'upgrade_initiated',
        oldPlanId: currentSub.planId,
        newPlanId: targetPlanId,
        operatedBy: userId,
        reason: '用户发起立即升级'
      }
    })

    return {
      type: 'immediate',
      subscriptionId: currentSub.id,
      oldPlan: {
        id: currentSub.planId,
        name: currentPlanSnapshot.name
      },
      newPlan: {
        id: targetPlan.id,
        name: targetPlan.name
      },
      priceDifference: targetPrice - currentPrice,
      remainingDays: remainingDaysValue,
      proratedAmount
    }
  } else {
    // 下期升级：记录待执行的升级
    await prisma.subscriptionChange.create({
      data: {
        subscriptionId: currentSub.id,
        userId,
        changeType: 'scheduled_upgrade',
        oldPlanId: currentSub.planId,
        newPlanId: targetPlanId,
        operatedBy: userId,
        reason: '用户安排下期升级'
      }
    })

    return {
      type: 'next_cycle',
      subscriptionId: currentSub.id,
      currentPlan: currentSub.planId,
      targetPlan: targetPlanId,
      effectiveDate: formatDate(currentSub.expireDate)
    }
  }
}

/**
 * 取消订阅
 * @param {string} userId - 用户ID
 * @param {string} cancelMode - 取消模式 (immediate | end_of_cycle)
 * @param {string} reason - 取消原因
 * @returns {Promise<Object>}
 */
async function cancelSubscription(userId, cancelMode = 'end_of_cycle', reason = null) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'active' }
  })

  if (!subscription) {
    const error = new Error('没有有效订阅')
    error.code = 'NO_ACTIVE_SUBSCRIPTION'
    throw error
  }

  if (cancelMode === 'immediate') {
    // 立即取消
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        autoRenew: false,
        cancelledAt: new Date()
      }
    })

    // 计算可退款金额
    const planSnapshot =
      typeof subscription.planSnapshot === 'string'
        ? JSON.parse(subscription.planSnapshot)
        : subscription.planSnapshot

    const remainingDaysValue = daysRemaining(subscription.expireDate)
    const totalDays = getCycleDays(planSnapshot.billingCycle || 'monthly')
    const refundAmount = calculateRefund(
      parseFloat(planSnapshot.price || 0),
      remainingDaysValue,
      totalDays
    )

    await prisma.subscriptionChange.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        changeType: 'cancelled',
        oldStatus: 'active',
        newStatus: 'cancelled',
        operatedBy: userId,
        reason
      }
    })

    logger.info(`订阅立即取消: ${subscription.id}`, { userId, reason })

    return {
      mode: 'immediate',
      subscriptionId: subscription.id,
      status: 'cancelled',
      refundInfo: {
        refundable: refundAmount > 0,
        refundAmount,
        refundReason: '按剩余天数比例退款'
      }
    }
  } else {
    // 到期后取消：只关闭自动续费
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { autoRenew: false }
    })

    await prisma.subscriptionChange.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        changeType: 'auto_renew_disabled',
        operatedBy: userId,
        reason
      }
    })

    logger.info(`订阅到期取消: ${subscription.id}`, { userId, reason })

    return {
      mode: 'end_of_cycle',
      subscriptionId: subscription.id,
      status: 'active',
      expireDate: formatDate(subscription.expireDate),
      autoRenew: false,
      cancelledAt: new Date()
    }
  }
}

/**
 * 切换自动续费
 * @param {string} userId - 用户ID
 * @param {boolean} autoRenew - 是否自动续费
 * @returns {Promise<Object>}
 */
async function toggleAutoRenew(userId, autoRenew) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'active' }
  })

  if (!subscription) {
    const error = new Error('没有有效订阅')
    error.code = 'NO_ACTIVE_SUBSCRIPTION'
    throw error
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { autoRenew }
  })

  await prisma.subscriptionChange.create({
    data: {
      subscriptionId: subscription.id,
      userId,
      changeType: autoRenew ? 'auto_renew_enabled' : 'auto_renew_disabled',
      operatedBy: userId
    }
  })

  logger.info(`自动续费${autoRenew ? '开启' : '关闭'}: ${subscription.id}`)

  return {
    subscriptionId: subscription.id,
    autoRenew,
    expireDate: formatDate(subscription.expireDate)
  }
}

/**
 * 手动续费
 * @param {string} userId - 用户ID
 * @param {string} paymentMethod - 支付方式
 * @returns {Promise<Object>}
 */
async function manualRenew(userId, paymentMethod) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    include: { plan: true }
  })

  if (!subscription) {
    const error = new Error('没有有效订阅')
    error.code = 'NO_ACTIVE_SUBSCRIPTION'
    throw error
  }

  const { plan } = subscription
  if (!plan || plan.status !== 'active') {
    const error = new Error('套餐已不存在或已下架')
    error.code = 'PLAN_NOT_FOUND'
    throw error
  }

  const planSnapshot =
    typeof subscription.planSnapshot === 'string'
      ? JSON.parse(subscription.planSnapshot)
      : subscription.planSnapshot

  const expireAfterRenew = calculateExpireDate(
    subscription.expireDate,
    planSnapshot.billingCycle || 'monthly'
  )

  // 返回续费信息，实际订单创建由 orderService 处理
  return {
    subscriptionId: subscription.id,
    plan: {
      id: plan.id,
      name: plan.name
    },
    amount: parseFloat(plan.price),
    currency: plan.currency || 'CNY',
    paymentMethod,
    expireAfterRenew: formatDate(expireAfterRenew)
  }
}

/**
 * 处理续费成功
 * @param {string} subscriptionId - 订阅ID
 * @param {string} orderId - 订单ID
 * @returns {Promise<Object>}
 */
async function processRenewalSuccess(subscriptionId, orderId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true }
  })

  if (!subscription) {
    throw new Error('订阅不存在')
  }

  const planSnapshot =
    typeof subscription.planSnapshot === 'string'
      ? JSON.parse(subscription.planSnapshot)
      : subscription.planSnapshot

  const newExpireDate = calculateExpireDate(
    subscription.expireDate,
    planSnapshot.billingCycle || 'monthly'
  )
  const newBillingDate = planSnapshot.billingCycle !== 'lifetime' ? newExpireDate : null

  await prisma.$transaction(async (tx) => {
    // 更新订阅
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        expireDate: newExpireDate,
        nextBillingDate: newBillingDate,
        autoRenewFailedCount: 0
      }
    })

    // 记录变更
    await tx.subscriptionChange.create({
      data: {
        subscriptionId,
        userId: subscription.userId,
        changeType: 'renewed',
        oldExpireDate: subscription.expireDate,
        newExpireDate,
        relatedOrderId: orderId,
        operatedBy: subscription.userId
      }
    })

    // 记录续费
    await tx.subscriptionRenewal.create({
      data: {
        subscriptionId,
        orderId,
        renewalType: 'manual',
        renewalPrice: parseFloat(planSnapshot.price || 0),
        status: 'success',
        succeededAt: new Date()
      }
    })
  })

  logger.info(`续费成功: ${subscriptionId}`, { orderId, newExpireDate: formatDate(newExpireDate) })

  return { subscriptionId, newExpireDate: formatDate(newExpireDate) }
}

/**
 * 暂停订阅（管理员操作）
 * @param {string} subscriptionId - 订阅ID
 * @param {string} adminId - 管理员ID
 * @param {string} reason - 暂停原因
 * @returns {Promise<Object>}
 */
async function suspendSubscription(subscriptionId, adminId, reason = null) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription) {
    const error = new Error('订阅不存在')
    error.code = 'SUBSCRIPTION_NOT_FOUND'
    throw error
  }

  if (subscription.status !== 'active') {
    const error = new Error('只能暂停活跃的订阅')
    error.code = 'INVALID_STATUS'
    throw error
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'suspended',
      suspendedAt: new Date()
    }
  })

  await prisma.subscriptionChange.create({
    data: {
      subscriptionId,
      userId: subscription.userId,
      changeType: 'suspended',
      oldStatus: 'active',
      newStatus: 'suspended',
      operatedBy: adminId,
      reason
    }
  })

  logger.info(`订阅已暂停: ${subscriptionId}`, { adminId, reason })

  return { subscriptionId, status: 'suspended' }
}

/**
 * 恢复订阅（管理员操作）
 * @param {string} subscriptionId - 订阅ID
 * @param {string} adminId - 管理员ID
 * @returns {Promise<Object>}
 */
async function resumeSubscription(subscriptionId, adminId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription) {
    const error = new Error('订阅不存在')
    error.code = 'SUBSCRIPTION_NOT_FOUND'
    throw error
  }

  if (subscription.status !== 'suspended') {
    const error = new Error('只能恢复已暂停的订阅')
    error.code = 'INVALID_STATUS'
    throw error
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'active',
      suspendedAt: null
    }
  })

  await prisma.subscriptionChange.create({
    data: {
      subscriptionId,
      userId: subscription.userId,
      changeType: 'resumed',
      oldStatus: 'suspended',
      newStatus: 'active',
      operatedBy: adminId
    }
  })

  logger.info(`订阅已恢复: ${subscriptionId}`, { adminId })

  return { subscriptionId, status: 'active' }
}

/**
 * 获取即将到期的订阅
 * @param {number} daysBeforeExpire - 到期前天数
 * @returns {Promise<Array>}
 */
async function getExpiringSoon(daysBeforeExpire = 3) {
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysBeforeExpire)

  return prisma.subscription.findMany({
    where: {
      status: 'active',
      expireDate: {
        gt: now,
        lte: futureDate
      }
    },
    include: {
      user: { select: { id: true, email: true } },
      plan: true
    }
  })
}

/**
 * 获取需要自动续费的订阅
 * @returns {Promise<Array>}
 */
async function getPendingRenewals() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.subscription.findMany({
    where: {
      status: 'active',
      autoRenew: true,
      nextBillingDate: { lte: today },
      autoRenewFailedCount: { lt: 3 }
    },
    include: {
      user: { select: { id: true, email: true } },
      plan: true
    }
  })
}

/**
 * 获取已过期的订阅
 * @returns {Promise<Array>}
 */
async function getExpiredSubscriptions() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.subscription.findMany({
    where: {
      status: 'active',
      expireDate: { lt: today }
    },
    select: { id: true, userId: true }
  })
}

/**
 * 批量标记订阅为过期
 * @param {Array<string>} subscriptionIds - 订阅ID列表
 * @returns {Promise<number>}
 */
async function markAsExpired(subscriptionIds) {
  if (subscriptionIds.length === 0) {
    return 0
  }

  const result = await prisma.subscription.updateMany({
    where: { id: { in: subscriptionIds } },
    data: { status: 'expired' }
  })

  // 记录变更
  for (const id of subscriptionIds) {
    await prisma.subscriptionChange.create({
      data: {
        subscriptionId: id,
        userId: (await prisma.subscription.findUnique({ where: { id }, select: { userId: true } }))
          ?.userId,
        changeType: 'expired',
        oldStatus: 'active',
        newStatus: 'expired'
      }
    })
  }

  return result.count
}

/**
 * 记录自动续费失败
 * @param {string} subscriptionId - 订阅ID
 * @param {string} reason - 失败原因
 * @returns {Promise<void>}
 */
async function recordRenewalFailure(subscriptionId, reason) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId }
  })

  if (!subscription) {
    return
  }

  const failedCount = subscription.autoRenewFailedCount + 1
  const nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后重试

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        autoRenewFailedCount: failedCount,
        lastRenewAttemptAt: new Date(),
        autoRenew: failedCount >= 3 ? false : subscription.autoRenew
      }
    })

    await tx.subscriptionRenewal.create({
      data: {
        subscriptionId,
        renewalType: 'auto',
        renewalPrice: 0,
        status: 'failed',
        failureReason: reason,
        retryCount: failedCount,
        nextRetryAt: failedCount < 3 ? nextRetryAt : null
      }
    })
  })

  logger.warn(`自动续费失败: ${subscriptionId} (${failedCount}/3)`, { reason })
}

// ========================================
// 辅助函数
// ========================================

/**
 * 计算按比例补差价
 */
function calculateProration(oldPrice, newPrice, remainingDaysValue, totalDays) {
  const unusedValue = oldPrice * (remainingDaysValue / totalDays)
  const newValue = newPrice * (remainingDaysValue / totalDays)
  return parseFloat((newValue - unusedValue).toFixed(2))
}

/**
 * 计算退款金额
 */
function calculateRefund(price, remainingDaysValue, totalDays) {
  return parseFloat((price * (remainingDaysValue / totalDays)).toFixed(2))
}

/**
 * 格式化订阅响应
 */
function formatSubscriptionResponse(subscription) {
  const planSnapshot =
    typeof subscription.planSnapshot === 'string'
      ? JSON.parse(subscription.planSnapshot)
      : subscription.planSnapshot

  const remainingDaysValue = daysRemaining(subscription.expireDate)

  // 构建 API Key 信息
  let apiKeyInfo = null
  if (subscription.apiKey && !subscription.apiKey.isDeleted) {
    apiKeyInfo = {
      id: subscription.apiKey.id,
      name: subscription.apiKey.name,
      isActive: subscription.apiKey.isActive,
      expiresAt: subscription.apiKey.expiresAt,
      dailyCostLimit: Number(subscription.apiKey.dailyCostLimit || 0),
      weeklyCostLimit: Number(subscription.apiKey.weeklyCostLimit || 0),
      permissions: subscription.apiKey.permissions || 'all'
    }
  }

  return {
    subscriptionId: subscription.id,
    plan: {
      id: subscription.planId,
      name: planSnapshot?.name || subscription.plan?.name,
      billingCycle: planSnapshot?.billingCycle || 'monthly'
    },
    status: subscription.status,
    startDate: formatDate(subscription.startDate),
    expireDate: formatDate(subscription.expireDate),
    daysRemaining: remainingDaysValue,
    autoRenew: subscription.autoRenew,
    nextBillingDate: subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : null,
    features: planSnapshot?.features || {},
    apiKey: apiKeyInfo,
    createdAt: subscription.createdAt
  }
}

/**
 * 格式化订阅列表项
 */
function formatSubscriptionListItem(subscription) {
  const planSnapshot =
    typeof subscription.planSnapshot === 'string'
      ? JSON.parse(subscription.planSnapshot)
      : subscription.planSnapshot

  return {
    subscriptionId: subscription.id,
    planName: planSnapshot?.name || subscription.plan?.name || '未知套餐',
    status: subscription.status,
    startDate: formatDate(subscription.startDate),
    expireDate: formatDate(subscription.expireDate),
    autoRenew: subscription.autoRenew
  }
}

module.exports = {
  createFromOrder,
  getCurrentSubscription,
  getSubscriptionHistory,
  upgradeSubscription,
  cancelSubscription,
  toggleAutoRenew,
  manualRenew,
  processRenewalSuccess,
  suspendSubscription,
  resumeSubscription,
  getExpiringSoon,
  getPendingRenewals,
  getExpiredSubscriptions,
  markAsExpired,
  recordRenewalFailure
}
