/**
 * 订阅过期处理定时任务
 * 每小时执行一次，将已过期的订阅标记为过期状态
 */

const cron = require('node-cron')
const logger = require('../utils/logger')
const subscriptionService = require('../services/subscriptions/subscriptionService')
const { emailService } = require('../services/emailAuth')

let isRunning = false

/**
 * 启动订阅过期处理定时任务
 */
function startSubscriptionExpirationJob() {
  // 每小时执行一次
  cron.schedule('0 * * * *', async () => {
    // 防止并发执行
    if (isRunning) {
      logger.debug('[订阅过期任务] 上一次任务仍在执行，跳过')
      return
    }

    isRunning = true

    try {
      logger.debug('[订阅过期任务] 开始执行...')

      const expiredSubs = await subscriptionService.getExpiredSubscriptions()

      if (expiredSubs.length === 0) {
        logger.debug('[订阅过期任务] 没有已过期的订阅')
        return
      }

      logger.info(`[订阅过期任务] 发现 ${expiredSubs.length} 个已过期订阅`)

      const subscriptionIds = expiredSubs.map((s) => s.id)
      const expiredCount = await subscriptionService.markAsExpired(subscriptionIds)

      logger.info(`[订阅过期任务] 已标记 ${expiredCount} 个订阅为过期`)

      // 发送过期通知
      let notifyCount = 0
      for (const sub of expiredSubs) {
        try {
          await sendExpirationNotification(sub)
          notifyCount++
        } catch (error) {
          logger.error(`发送过期通知失败: 订阅 ${sub.id}`, error.message)
        }
      }

      logger.info(`[订阅过期任务] 发送 ${notifyCount} 个过期通知`)
    } catch (error) {
      logger.error(`[订阅过期任务] 执行失败: ${error.message}`)
    } finally {
      isRunning = false
    }
  })

  logger.info('📅 订阅过期处理定时任务已启动（每小时执行一次）')
}

/**
 * 发送订阅过期通知
 * @param {Object} subscription - 订阅信息
 */
async function sendExpirationNotification(subscription) {
  // 获取用户邮箱
  const { prisma } = require('../models/prisma')
  const user = await prisma.user.findUnique({
    where: { id: subscription.userId },
    select: { email: true }
  })

  if (!user?.email) {
    logger.warn(`订阅 ${subscription.id} 没有关联用户邮箱，跳过通知`)
    return
  }

  const subject = '【通知】您的订阅已到期'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">订阅已到期</h2>
      <p>您好，</p>
      <p>您的订阅套餐已到期。为了继续使用服务，请续费或选择新的套餐。</p>
      <p style="margin-top: 20px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/plans"
           style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          选择套餐
        </a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        如有任何问题，请联系客服。
      </p>
    </div>
  `

  try {
    await emailService.sendEmail({
      to: user.email,
      subject,
      html
    })

    logger.info(`已发送过期通知: 订阅 ${subscription.id}`)
  } catch (error) {
    logger.error(`发送过期通知邮件失败: ${user.email}`, error.message)
    throw error
  }
}

/**
 * 手动执行一次过期处理
 * @returns {Promise<Object>}
 */
async function runOnce() {
  try {
    const expiredSubs = await subscriptionService.getExpiredSubscriptions()
    logger.info(`[订阅过期任务] 手动执行，发现 ${expiredSubs.length} 个已过期订阅`)

    if (expiredSubs.length === 0) {
      return { total: 0, expired: 0, notified: 0 }
    }

    const subscriptionIds = expiredSubs.map((s) => s.id)
    const expiredCount = await subscriptionService.markAsExpired(subscriptionIds)

    let notifyCount = 0
    for (const sub of expiredSubs) {
      try {
        await sendExpirationNotification(sub)
        notifyCount++
      } catch {
        // 已记录日志
      }
    }

    return { total: expiredSubs.length, expired: expiredCount, notified: notifyCount }
  } catch (error) {
    logger.error(`[订阅过期任务] 手动执行失败: ${error.message}`)
    throw error
  }
}

module.exports = {
  startSubscriptionExpirationJob,
  runOnce
}
