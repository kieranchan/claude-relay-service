/**
 * API Key 配置服务
 * 当用户订阅套餐后，自动创建或配置对应的 API Key
 */

const { prisma } = require('../../models/prisma')
const apiKeyService = require('../apiKeyService')
const logger = require('../../utils/logger')

/**
 * 根据订阅和套餐配置，为用户创建或更新 API Key
 * @param {Object} params
 * @param {string} params.userId - 用户ID
 * @param {Object} params.plan - 套餐信息
 * @param {Object} params.subscription - 订阅信息
 * @param {Object} tx - Prisma 事务客户端（可选）
 * @returns {Promise<Object>} API Key 信息
 */
async function provisionApiKeyForSubscription({ userId, plan, subscription, tx = prisma }) {
  // 计算过期时间
  const expiresAt = subscription.expireDate

  // 直接从 Plan 模型读取 API Key 配置
  const keyConfig = {
    // 费用限制（使用新的 Plan 字段）
    dailyCostLimit: plan.dailyCostLimit || 0,
    weeklyCostLimit: plan.weeklyCostLimit || 0,
    totalCostLimit: plan.totalCostLimit || 0,

    // 速率限制（5小时窗口）
    rateLimitWindow: plan.rateLimitWindow || 300, // 默认 300 分钟 = 5 小时
    rateLimitRequests: plan.rateLimitRequests || 0,
    rateLimitCost: plan.rateLimitCost || 0,

    // 权限配置
    permissions: plan.permissions || 'all',

    // 过期设置
    expirationMode: 'fixed',
    expiresAt,

    // 状态
    isActive: true,
    isActivated: true
  }

  // 查找用户是否已有 API Key
  const existingKey = await tx.apiKey.findFirst({
    where: {
      userId,
      isDeleted: false
    },
    orderBy: { createdAt: 'desc' }
  })

  if (existingKey) {
    // 更新现有 API Key
    const updatedKey = await apiKeyService.updateApiKey(existingKey.id, {
      ...keyConfig,
      name: `${plan.name} - ${new Date().toLocaleDateString('zh-CN')}`,
      description: `订阅套餐: ${plan.name}，有效期至 ${new Date(expiresAt).toLocaleDateString('zh-CN')}`
    })

    // 关联到订阅
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { apiKeyId: existingKey.id }
    })

    logger.info(`✅ 更新 API Key 配置: ${existingKey.id}`, {
      userId,
      planId: plan.id,
      subscriptionId: subscription.id,
      weeklyCostLimit: keyConfig.weeklyCostLimit,
      rateLimitCost: keyConfig.rateLimitCost
    })

    return {
      action: 'updated',
      keyId: existingKey.id,
      ...updatedKey
    }
  } else {
    // 创建新 API Key
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true }
    })

    const newKey = await apiKeyService.generateApiKey({
      name: `${plan.name} - 自动生成`,
      description: `订阅套餐: ${plan.name}，有效期至 ${new Date(expiresAt).toLocaleDateString('zh-CN')}`,
      userId,
      userUsername: user?.email || 'unknown',
      createdBy: 'subscription',
      ...keyConfig
    })

    // 关联到订阅
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { apiKeyId: newKey.id }
    })

    logger.info(`✅ 创建新 API Key: ${newKey.id}`, {
      userId,
      planId: plan.id,
      subscriptionId: subscription.id,
      weeklyCostLimit: keyConfig.weeklyCostLimit,
      rateLimitCost: keyConfig.rateLimitCost
    })

    return {
      action: 'created',
      ...newKey
    }
  }
}

/**
 * 订阅到期时停用 API Key
 * @param {string} subscriptionId - 订阅ID
 */
async function deactivateApiKeyForSubscription(subscriptionId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { userId: true }
  })

  if (!subscription) {
    return
  }

  // 停用用户所有 API Keys
  const keys = await prisma.apiKey.findMany({
    where: { userId: subscription.userId, isDeleted: false }
  })

  for (const key of keys) {
    await apiKeyService.updateApiKey(key.id, { isActive: false })
    logger.info(`⏸️ 停用 API Key: ${key.id}（订阅过期）`)
  }
}

/**
 * 续费时延长 API Key 有效期
 * @param {Object} params
 * @param {string} params.userId - 用户ID
 * @param {Date} params.newExpireDate - 新过期时间
 */
async function extendApiKeyExpiration({ userId, newExpireDate }) {
  const keys = await prisma.apiKey.findMany({
    where: { userId, isDeleted: false }
  })

  for (const key of keys) {
    await apiKeyService.updateApiKey(key.id, {
      expiresAt: newExpireDate,
      isActive: true
    })
    logger.info(`🔄 续期 API Key: ${key.id}，新过期时间: ${newExpireDate.toISOString()}`)
  }
}

module.exports = {
  provisionApiKeyForSubscription,
  deactivateApiKeyForSubscription,
  extendApiKeyExpiration
}
