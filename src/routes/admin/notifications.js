/**
 * 通知管理路由
 * 处理邮件通知发送和预览
 *
 * 路由前缀: /admin/notifications
 */

const express = require('express')
const router = express.Router()
const notificationService = require('../../services/notificationService')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')

/**
 * POST /send
 * 发送通知
 */
router.post('/send', authenticateAdmin, async (req, res) => {
  try {
    const { userIds, filter, subject, content } = req.body

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Subject and content are required'
      })
    }

    if ((!userIds || userIds.length === 0) && !filter) {
      return res.status(400).json({
        success: false,
        error: 'Target users (userIds or filter) are required'
      })
    }

    const result = await notificationService.sendBulkNotification({
      userIds,
      filter,
      subject,
      content,
      adminId: req.admin.username,
      ipAddress: req.ip
    })

    res.json({
      success: true,
      message: 'Notifications sent successfully',
      data: result
    })
  } catch (error) {
    logger.error('❌ Failed to send notifications:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications',
      message: error.message
    })
  }
})

/**
 * POST /preview
 * 预览通知
 */
router.post('/preview', authenticateAdmin, async (req, res) => {
  try {
    const { content, sampleData } = req.body

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      })
    }

    const preview = notificationService.previewNotification(content, sampleData)

    res.json({
      success: true,
      data: { preview }
    })
  } catch (error) {
    logger.error('❌ Failed to preview notification:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to preview notification',
      message: error.message
    })
  }
})

module.exports = router
