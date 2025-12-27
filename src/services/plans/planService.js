/**
 * 套餐核心服务
 * 提供套餐的 CRUD 操作
 */

const { getPrismaClient } = require('../../models/prisma')
const logger = require('../../utils/logger')
const { formatPlanResponse } = require('./planFormatter')

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

module.exports = {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus
}
