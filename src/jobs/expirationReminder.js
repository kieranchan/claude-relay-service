/**
 * 到期提醒定时任务
 * 每天早上9点执行，向即将到期的用户发送提醒邮件
 */

const cron = require('node-cron')
const logger = require('../utils/logger')
const subscriptionService = require('../services/subscriptions/subscriptionService')
const { emailService } = require('../services/emailAuth')
const { daysRemaining, formatDate } = require('../utils/dateHelper')

let isRunning = false

/**
 * 启动到期提醒定时任务
 */
function startExpirationReminderJob() {
  // 每天早上9点执行
  cron.schedule('0 9 * * *', async () => {
    // 防止并发执行
    if (isRunning) {
      logger.debug('[到期提醒任务] 上一次任务仍在执行，跳过')
      return
    }

    isRunning = true

    try {
      logger.info('[到期提醒任务] 开始执行...')

      // 获取3天内即将到期的订阅
      const expiringSubs = await subscriptionService.getExpiringSoon(3)

      if (expiringSubs.length === 0) {
        logger.info('[到期提醒任务] 没有即将到期的订阅')
        return
      }

      logger.info(`[到期提醒任务] 发现 ${expiringSubs.length} 个即将到期的订阅`)

      let sentCount = 0
      let failCount = 0

      for (const subscription of expiringSubs) {
        try {
          await sendExpirationReminder(subscription)
          sentCount++
        } catch (error) {
          failCount++
          logger.error(`[到期提醒任务] 发送提醒失败: 订阅 ${subscription.id}`, error.message)
        }
      }

      logger.info(`[到期提醒任务] 执行完成，发送: ${sentCount}，失败: ${failCount}`)
    } catch (error) {
      logger.error(`[到期提醒任务] 执行失败: ${error.message}`)
    } finally {
      isRunning = false
    }
  })

  logger.info('📅 到期提醒定时任务已启动（每天早上9点执行）')
}

/**
 * 发送到期提醒邮件
 * @param {Object} subscription - 订阅信息
 */
async function sendExpirationReminder(subscription) {
  const planSnapshot =
    typeof subscription.planSnapshot === 'string'
      ? JSON.parse(subscription.planSnapshot)
      : subscription.planSnapshot

  const daysLeft = daysRemaining(subscription.expireDate)
  const userEmail = subscription.user?.email

  if (!userEmail) {
    logger.warn(`订阅 ${subscription.id} 没有关联用户邮箱，跳过提醒`)
    return
  }

  // 发送提醒邮件
  const subject = `【提醒】您的 ${planSnapshot?.name || '订阅'} 将在 ${daysLeft} 天后到期`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">订阅到期提醒</h2>
      <p>您好，</p>
      <p>您的 <strong>${planSnapshot?.name || '订阅套餐'}</strong> 将于 <strong>${formatDate(subscription.expireDate)}</strong> 到期，还剩 <strong>${daysLeft}</strong> 天。</p>
      ${
        subscription.autoRenew
          ? '<p style="color: #28a745;">✓ 您已开启自动续费，系统将在到期时自动为您续费。</p>'
          : '<p style="color: #dc3545;">✗ 您尚未开启自动续费，请及时手动续费以保持服务不中断。</p>'
      }
      <p style="margin-top: 20px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/subscriptions"
           style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          管理订阅
        </a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        如有任何问题，请联系客服。
      </p>
    </div>
  `

  try {
    await emailService.sendEmail({
      to: userEmail,
      subject,
      html
    })

    logger.info(`已发送到期提醒: 订阅 ${subscription.id}, ${daysLeft} 天后到期`)
  } catch (error) {
    logger.error(`发送到期提醒邮件失败: ${userEmail}`, error.message)
    throw error
  }
}

/**
 * 手动执行一次到期提醒
 * @param {number} daysBeforeExpire - 提前天数
 * @returns {Promise<Object>}
 */
async function runOnce(daysBeforeExpire = 3) {
  try {
    const expiringSubs = await subscriptionService.getExpiringSoon(daysBeforeExpire)
    logger.info(`[到期提醒任务] 手动执行，发现 ${expiringSubs.length} 个即将到期的订阅`)

    let sentCount = 0
    let failCount = 0

    for (const subscription of expiringSubs) {
      try {
        await sendExpirationReminder(subscription)
        sentCount++
      } catch {
        failCount++
      }
    }

    return { total: expiringSubs.length, sent: sentCount, failed: failCount }
  } catch (error) {
    logger.error(`[到期提醒任务] 手动执行失败: ${error.message}`)
    throw error
  }
}

module.exports = {
  startExpirationReminderJob,
  runOnce
}
