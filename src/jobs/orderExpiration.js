/**
 * 订单过期定时任务
 * 每5分钟检查并处理过期的待支付订单
 */

const cron = require('node-cron')
const logger = require('../utils/logger')
const { processExpiredOrders } = require('../services/orders/orderService')

let isRunning = false

/**
 * 启动订单过期定时任务
 */
function startOrderExpirationJob() {
  // 每5分钟执行一次
  cron.schedule('*/5 * * * *', async () => {
    // 防止并发执行
    if (isRunning) {
      logger.debug('[订单过期任务] 上一次任务仍在执行，跳过')
      return
    }

    isRunning = true

    try {
      logger.debug('[订单过期任务] 开始执行...')

      const cancelledCount = await processExpiredOrders(100)

      if (cancelledCount > 0) {
        logger.info(`[订单过期任务] 成功处理 ${cancelledCount} 个过期订单`)
      } else {
        logger.debug('[订单过期任务] 没有过期订单需要处理')
      }
    } catch (error) {
      logger.error(`[订单过期任务] 执行失败: ${error.message}`)
    } finally {
      isRunning = false
    }
  })

  logger.info('📅 订单过期定时任务已启动（每5分钟执行一次）')
}

/**
 * 手动执行一次过期订单处理
 * @returns {Promise<number>}
 */
async function runOnce() {
  try {
    const count = await processExpiredOrders(100)
    logger.info(`[订单过期任务] 手动执行完成，处理 ${count} 个订单`)
    return count
  } catch (error) {
    logger.error(`[订单过期任务] 手动执行失败: ${error.message}`)
    throw error
  }
}

module.exports = {
  startOrderExpirationJob,
  runOnce
}
