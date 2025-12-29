/**
 * 自动续费定时任务
 * 每天凌晨2点执行，处理需要自动续费的订阅
 */

const cron = require('node-cron')
const logger = require('../utils/logger')
const subscriptionService = require('../services/subscriptions/subscriptionService')

let isRunning = false

/**
 * 启动自动续费定时任务
 */
function startAutoRenewalJob() {
  // 每天凌晨2点执行
  cron.schedule('0 2 * * *', async () => {
    // 防止并发执行
    if (isRunning) {
      logger.debug('[自动续费任务] 上一次任务仍在执行，跳过')
      return
    }

    isRunning = true

    try {
      logger.info('[自动续费任务] 开始执行...')

      const pendingRenewals = await subscriptionService.getPendingRenewals()

      if (pendingRenewals.length === 0) {
        logger.info('[自动续费任务] 没有待续费的订阅')
        return
      }

      logger.info(`[自动续费任务] 发现 ${pendingRenewals.length} 个待续费订阅`)

      let successCount = 0
      let failCount = 0

      for (const subscription of pendingRenewals) {
        try {
          await processAutoRenewal(subscription)
          successCount++
        } catch (error) {
          failCount++
          logger.error(`[自动续费任务] 处理订阅 ${subscription.id} 失败:`, error.message)
        }
      }

      logger.info(`[自动续费任务] 执行完成，成功: ${successCount}，失败: ${failCount}`)
    } catch (error) {
      logger.error(`[自动续费任务] 执行失败: ${error.message}`)
    } finally {
      isRunning = false
    }
  })

  logger.info('📅 自动续费定时任务已启动（每天凌晨2点执行）')
}

/**
 * 处理单个订阅的自动续费
 * @param {Object} subscription - 订阅信息
 */
async function processAutoRenewal(subscription) {
  const { plan } = subscription

  if (!plan || plan.status !== 'active') {
    logger.warn(`订阅 ${subscription.id} 的套餐已下架，跳过续费`)
    // 关闭自动续费
    await subscriptionService.toggleAutoRenew(subscription.userId, false)
    return
  }

  try {
    // 目前自动续费功能需要集成支付平台的自动扣款API
    // 这里记录失败并通知用户手动续费
    const reason = '自动扣款功能待接入支付平台'
    await subscriptionService.recordRenewalFailure(subscription.id, reason)

    // TODO: 实际实现中，这里需要：
    // 1. 调用支付平台的自动扣款API（如支付宝签约支付、微信委托代扣等）
    // 2. 如果扣款成功，调用 processRenewalSuccess
    // 3. 如果扣款失败，调用 recordRenewalFailure

    logger.info(`订阅 ${subscription.id} 需要手动续费（自动扣款待实现）`)
  } catch (error) {
    await subscriptionService.recordRenewalFailure(subscription.id, error.message)
    throw error
  }
}

/**
 * 手动执行一次自动续费检查
 * @returns {Promise<Object>}
 */
async function runOnce() {
  try {
    const pendingRenewals = await subscriptionService.getPendingRenewals()
    logger.info(`[自动续费任务] 手动执行，发现 ${pendingRenewals.length} 个待续费订阅`)

    let successCount = 0
    let failCount = 0

    for (const subscription of pendingRenewals) {
      try {
        await processAutoRenewal(subscription)
        successCount++
      } catch {
        failCount++
      }
    }

    return { total: pendingRenewals.length, success: successCount, failed: failCount }
  } catch (error) {
    logger.error(`[自动续费任务] 手动执行失败: ${error.message}`)
    throw error
  }
}

module.exports = {
  startAutoRenewalJob,
  runOnce
}
