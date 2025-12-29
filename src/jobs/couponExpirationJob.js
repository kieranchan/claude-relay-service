/**
 * 优惠券过期定时任务
 * 每天凌晨 1 点执行，标记过期的优惠券
 */

const cron = require('node-cron')
const couponService = require('../services/coupons')
const logger = require('../utils/logger')

/**
 * 启动优惠券过期任务
 */
function startCouponExpirationJob() {
  // 每天凌晨 1 点执行
  cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('[优惠券过期任务] 开始执行...')

      const expiredCount = await couponService.markExpiredCoupons()

      logger.info(`[优惠券过期任务] 已标记 ${expiredCount} 张优惠券为过期`)
    } catch (error) {
      logger.error('[优惠券过期任务] 执行失败:', error)
    }
  })

  logger.info('优惠券过期任务已启动（每天凌晨1点执行）')
}

module.exports = {
  startCouponExpirationJob
}
