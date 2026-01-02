const emailService = require('./emailAuth/emailService')
const { prisma } = require('../models/prisma')
const logger = require('../utils/logger')
const auditLogService = require('./auditLogService')

class NotificationService {
  /**
   * 替换模板变量
   * @param {string} template - 原始模版
   * @param {Object} variables - 变量对象
   * @returns {string} 替换后的内容
   */
  replaceVariables(template, variables) {
    if (!template) {
      return ''
    }
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      // 检查变量是否存在，如果不存在保留原样或替换为空
      variables[key] !== undefined ? variables[key] : match
    )
  }

  /**
   * 发送批量通知
   * @param {Object} params
   * @param {string[]} [params.userIds] - 目标用户ID列表 (如果为空则需提供 filter)
   * @param {Object} [params.filter] - 筛选条件 (e.g. { status: 'active' }, 'all')
   * @param {string} params.subject - 邮件主题
   * @param {string} params.content - 邮件内容 (支持 HTML 和变量)
   * @param {string} params.adminId - 操作管理员ID
   * @param {string} params.ipAddress - 操作IP
   * @returns {Promise<Object>} 发送结果统计
   */
  async sendBulkNotification({ userIds, filter, subject, content, adminId, ipAddress }) {
    try {
      let users = []

      // 1. 确定目标用户
      if (userIds && userIds.length > 0) {
        users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, displayName: true, status: true }
        })
      } else if (filter === 'all') {
        users = await prisma.user.findMany({
          select: { id: true, email: true, displayName: true, status: true }
        })
      } else if (filter && typeof filter === 'object') {
        users = await prisma.user.findMany({
          where: filter,
          select: { id: true, email: true, displayName: true, status: true }
        })
      } else {
        throw new Error('No target users specified')
      }

      if (users.length === 0) {
        return { success: 0, failed: 0, total: 0 }
      }

      logger.info(`📢 Starting bulk notification to ${users.length} users. Subject: ${subject}`)

      // 2. 批量发送
      let successCount = 0
      let failedCount = 0

      // 为了不阻塞，这里逐个发送，实际生产环境可能需要队列
      // 这里的实现简单处理：Promise.all 并发可能会太多，改用 for...of 串行或分批
      // 考虑到 Node.js Event Loop，这里用 map + Promise.all (限制并发最好，但简单的先全发)
      // 如果用户量大，需要改为 BullQueue 或类似机制。当前假设用户量 < 1000

      const sendPromises = users.map(async (user) => {
        try {
          // 准备变量
          const variables = {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            status: user.status
          }

          // 替换变量
          const personalizedContent = this.replaceVariables(content, variables)

          // 包装 HTML
          const finalHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .footer { font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                ${personalizedContent}
                <div class="footer">
                  <p>此邮件由 Claude Relay Service 系统发送。</p>
                </div>
              </div>
            </body>
            </html>
          `

          const sent = await emailService.sendEmail({
            to: user.email,
            subject: this.replaceVariables(subject, variables),
            html: finalHtml
          })

          if (sent) {
            return true
          }
          throw new Error('Send returned false')
        } catch (err) {
          logger.error(`Failed to send notification to ${user.email}:`, err)
          return false
        }
      })

      const results = await Promise.all(sendPromises)
      successCount = results.filter((r) => r).length
      failedCount = results.length - successCount

      // 3. 记录审计日志
      await auditLogService.log({
        action: 'SEND_BULK_NOTIFICATION',
        adminId,
        details: {
          subject,
          targetCount: users.length,
          successCount,
          failedCount,
          filter: filter || 'userIds'
        },
        ipAddress
      })

      return {
        success: successCount,
        failed: failedCount,
        total: users.length
      }
    } catch (error) {
      logger.error('❌ Error in sendBulkNotification:', error)
      throw error
    }
  }

  /**
   * 预览通知内容
   */
  previewNotification(
    content,
    sampleData = { displayName: '测试用户', email: 'test@example.com' }
  ) {
    return this.replaceVariables(content, sampleData)
  }
}

module.exports = new NotificationService()
