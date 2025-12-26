/**
 * 套餐管理服务
 * 提供套餐的 CRUD 操作和业务逻辑
 */

const { getPrismaClient } = require('../models/prisma')
const logger = require('../utils/logger')

/**
 * 获取套餐列表
 * @param {Object} options - 查询选项
 * @param {string} options.status - 状态筛选 (active | inactive | archived | all)
 * @param {string} options.billingCycle - 计费周期筛选 (monthly | yearly | lifetime)
 * @param {boolean} options.includeStats - 是否包含统计信息
 * @returns {Promise<Array>}
 */
async function getPlans(options = {}) {
  const prisma = getPrismaClient()
  const { status = 'active', billingCycle, includeStats = false } = options

  const where = {}

  // 状态筛选
  if (status !== 'all') {
    where.status = status
  }

  // 计费周期筛选
  if (billingCycle) {
    where.billingCycle = billingCycle
  }

  const plans = await prisma.plan.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: includeStats
      ? {
          _count: {
            select: { subscriptions: true, orders: true }
          }
        }
      : undefined
  })

  return plans.map((plan) => formatPlanResponse(plan))
}

/**
 * 获取套餐详情
 * @param {string} planId - 套餐ID
 * @param {boolean} includeStats - 是否包含统计信息
 * @returns {Promise<Object|null>}
 */
async function getPlanById(planId, includeStats = false) {
  const prisma = getPrismaClient()

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: includeStats
      ? {
          _count: {
            select: { subscriptions: true, orders: true }
          }
        }
      : undefined
  })

  if (!plan) {
    return null
  }

  return formatPlanResponse(plan, true)
}

/**
 * 创建套餐
 * @param {Object} data - 套餐数据
 * @param {string} adminId - 管理员ID
 * @returns {Promise<Object>}
 */
async function createPlan(data, adminId) {
  const prisma = getPrismaClient()

  // 验证必填字段
  const requiredFields = ['id', 'name', 'type', 'price', 'features']
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`缺少必填字段: ${field}`)
    }
  }

  // 检查ID是否已存在
  const existing = await prisma.plan.findUnique({
    where: { id: data.id }
  })
  if (existing) {
    throw new Error('套餐ID已存在')
  }

  // 验证套餐类型
  if (!['subscription', 'one-time'].includes(data.type)) {
    throw new Error('无效的套餐类型')
  }

  // 创建套餐
  const plan = await prisma.plan.create({
    data: {
      id: data.id,
      name: data.name,
      description: data.description || null,
      type: data.type,
      price: data.price,
      originalPrice: data.originalPrice || null,
      currency: data.currency || 'CNY',
      billingCycle: data.billingCycle || null,
      features: data.features,
      sortOrder: data.sortOrder || 0,
      isPopular: data.isPopular || false,
      isRecommended: data.isRecommended || false,
      badgeText: data.badgeText || null,
      badgeColor: data.badgeColor || null,
      trialDays: data.trialDays || 0,
      discount: data.discount || null,
      status: data.status || 'active'
    }
  })

  logger.info('套餐已创建', { planId: plan.id, adminId })

  return formatPlanResponse(plan)
}

/**
 * 更新套餐
 * @param {string} planId - 套餐ID
 * @param {Object} data - 更新数据
 * @param {string} adminId - 管理员ID
 * @returns {Promise<Object>}
 */
async function updatePlan(planId, data, adminId) {
  const prisma = getPrismaClient()

  // 检查套餐是否存在
  const existing = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: { subscriptions: { where: { status: 'active' } } }
      }
    }
  })

  if (!existing) {
    throw new Error('套餐不存在')
  }

  // 如果有活跃订阅，限制可修改的字段
  const hasActiveSubscribers = existing._count.subscriptions > 0
  if (hasActiveSubscribers) {
    const restrictedFields = ['features', 'price', 'billingCycle']
    const hasRestrictedChanges = restrictedFields.some(
      (field) =>
        data[field] !== undefined && JSON.stringify(data[field]) !== JSON.stringify(existing[field])
    )
    if (hasRestrictedChanges) {
      throw new Error('有活跃订阅时不能修改核心功能配置（features、price、billingCycle）')
    }
  }

  // 构建更新数据
  const updateData = {}
  const allowedFields = [
    'name',
    'description',
    'price',
    'originalPrice',
    'currency',
    'billingCycle',
    'features',
    'sortOrder',
    'isPopular',
    'isRecommended',
    'badgeText',
    'badgeColor',
    'trialDays',
    'discount',
    'status'
  ]

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field]
    }
  }

  const plan = await prisma.plan.update({
    where: { id: planId },
    data: updateData
  })

  logger.info('套餐已更新', { planId, adminId, updatedFields: Object.keys(updateData) })

  return formatPlanResponse(plan)
}

/**
 * 删除套餐
 * @param {string} planId - 套餐ID
 * @param {boolean} force - 是否强制删除
 * @param {string} adminId - 管理员ID
 * @returns {Promise<boolean>}
 */
async function deletePlan(planId, force = false, adminId) {
  const prisma = getPrismaClient()

  // 检查套餐是否存在
  const existing = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: { subscriptions: { where: { status: 'active' } } }
      }
    }
  })

  if (!existing) {
    throw new Error('套餐不存在')
  }

  // 检查是否有活跃订阅
  if (existing._count.subscriptions > 0 && !force) {
    throw new Error('该套餐有活跃订阅，无法删除。如需强制删除，请使用 force 参数')
  }

  // 删除套餐
  await prisma.plan.delete({
    where: { id: planId }
  })

  logger.info('套餐已删除', { planId, adminId, force })

  return true
}

/**
 * 切换套餐状态（上架/下架）
 * @param {string} planId - 套餐ID
 * @param {string} newStatus - 新状态 (active | inactive)
 * @param {string} adminId - 管理员ID
 * @returns {Promise<Object>}
 */
async function togglePlanStatus(planId, newStatus, adminId) {
  const prisma = getPrismaClient()

  if (!['active', 'inactive'].includes(newStatus)) {
    throw new Error('无效的状态值')
  }

  const plan = await prisma.plan.update({
    where: { id: planId },
    data: { status: newStatus }
  })

  logger.info('套餐状态已更改', { planId, newStatus, adminId })

  return formatPlanResponse(plan)
}

/**
 * 获取套餐统计信息
 * @param {string} planId - 套餐ID
 * @returns {Promise<Object>}
 */
async function getPlanStats(planId) {
  const prisma = getPrismaClient()

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: {
          subscriptions: true,
          orders: true
        }
      },
      subscriptions: {
        where: { status: 'active' },
        select: { id: true }
      },
      orders: {
        where: { status: 'paid' },
        select: { finalPrice: true }
      }
    }
  })

  if (!plan) {
    throw new Error('套餐不存在')
  }

  // 计算总收入
  const totalRevenue = plan.orders.reduce((sum, order) => sum + parseFloat(order.finalPrice), 0)

  return {
    planId: plan.id,
    planName: plan.name,
    totalSubscriptions: plan._count.subscriptions,
    activeSubscriptions: plan.subscriptions.length,
    totalOrders: plan._count.orders,
    paidOrders: plan.orders.length,
    totalRevenue: totalRevenue.toFixed(2),
    currency: plan.currency
  }
}

/**
 * 格式化套餐响应
 * @param {Object} plan - Prisma 返回的套餐对象
 * @param {boolean} includeHighlights - 是否包含功能亮点
 * @returns {Object}
 */
function formatPlanResponse(plan, includeHighlights = false) {
  const response = {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    type: plan.type,
    price: parseFloat(plan.price),
    original_price: plan.originalPrice ? parseFloat(plan.originalPrice) : null,
    currency: plan.currency,
    billing_cycle: plan.billingCycle,
    features: plan.features,
    sort_order: plan.sortOrder,
    is_popular: plan.isPopular,
    is_recommended: plan.isRecommended,
    badge_text: plan.badgeText,
    badge_color: plan.badgeColor,
    trial_days: plan.trialDays,
    discount: plan.discount,
    status: plan.status,
    subscribers_count: plan.subscribersCount,
    total_revenue: parseFloat(plan.totalRevenue),
    created_at: plan.createdAt,
    updated_at: plan.updatedAt
  }

  // 添加统计计数（如果存在）
  if (plan._count) {
    response.subscriptions_count = plan._count.subscriptions
    response.orders_count = plan._count.orders
  }

  // 生成功能亮点
  if (includeHighlights && plan.features) {
    response.feature_highlights = generateFeatureHighlights(plan.features)
  }

  return response
}

/**
 * 生成功能亮点列表
 * @param {Object} features - 功能配置
 * @returns {Array<string>}
 */
function generateFeatureHighlights(features) {
  const highlights = []

  if (features.quota) {
    if (features.quota.daily_requests) {
      highlights.push(`每日 ${features.quota.daily_requests} 次请求`)
    }
    if (features.quota.monthly_tokens) {
      const tokens = features.quota.monthly_tokens
      const formatted =
        tokens >= 1000000 ? `${(tokens / 1000000).toFixed(0)}M` : `${(tokens / 1000).toFixed(0)}K`
      highlights.push(`每月 ${formatted} Token`)
    }
    if (features.quota.concurrent_requests) {
      highlights.push(`${features.quota.concurrent_requests} 并发请求`)
    }
  }

  if (features.services) {
    const services = []
    if (features.services.claude_code) {
      services.push('Claude Code')
    }
    if (features.services.gemini_cli) {
      services.push('Gemini CLI')
    }
    if (features.services.codex) {
      services.push('Codex')
    }
    if (features.services.droid) {
      services.push('Droid')
    }
    if (services.length > 0) {
      highlights.push(`支持 ${services.join('、')}`)
    }
  }

  if (features.api && features.api.enabled) {
    highlights.push('API 访问')
  }

  if (features.advanced) {
    if (features.advanced.priority_queue) {
      highlights.push('优先队列')
    }
    if (features.advanced.team_sharing) {
      highlights.push('团队共享')
    }
  }

  return highlights
}

module.exports = {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  getPlanStats
}
