/**
 * 通知模板管理路由
 * 处理通知模板的 CRUD 操作
 *
 * 路由前缀: /admin/notification-templates
 */

const express = require('express')
const router = express.Router()
const { prisma } = require('../../models/prisma')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')

/**
 * GET /
 * 获取所有通知模板
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { category, isActive } = req.query

    const where = {}
    if (category) {
      where.category = category
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const templates = await prisma.notificationTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: {
          select: { id: true, email: true, displayName: true }
        }
      }
    })

    res.json({
      success: true,
      data: templates
    })
  } catch (error) {
    logger.error('❌ Failed to get notification templates:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get notification templates',
      message: error.message
    })
  }
})

/**
 * GET /:id
 * 获取单个模板详情
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const template = await prisma.notificationTemplate.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, displayName: true }
        }
      }
    })

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      })
    }

    res.json({
      success: true,
      data: template
    })
  } catch (error) {
    logger.error('❌ Failed to get notification template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get notification template',
      message: error.message
    })
  }
})

/**
 * POST /
 * 创建新模板
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, subject, content, description, category } = req.body

    if (!name || !subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Name, subject and content are required'
      })
    }

    const template = await prisma.notificationTemplate.create({
      data: {
        name,
        subject,
        content,
        description,
        category: category || 'general',
        isActive: true
        // createdBy 可以关联到管理员用户ID，但这需要管理员也在User表中
      }
    })

    logger.success(`📋 Notification template created: ${name}`)

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    })
  } catch (error) {
    logger.error('❌ Failed to create notification template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create notification template',
      message: error.message
    })
  }
})

/**
 * PUT /:id
 * 更新模板
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { name, subject, content, description, category, isActive } = req.body

    const existing = await prisma.notificationTemplate.findUnique({
      where: { id }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      })
    }

    const template = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(content !== undefined && { content }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive })
      }
    })

    logger.success(`📋 Notification template updated: ${template.name}`)

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    })
  } catch (error) {
    logger.error('❌ Failed to update notification template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update notification template',
      message: error.message
    })
  }
})

/**
 * DELETE /:id
 * 删除模板
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const existing = await prisma.notificationTemplate.findUnique({
      where: { id }
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      })
    }

    await prisma.notificationTemplate.delete({
      where: { id }
    })

    logger.success(`📋 Notification template deleted: ${existing.name}`)

    res.json({
      success: true,
      message: 'Template deleted successfully'
    })
  } catch (error) {
    logger.error('❌ Failed to delete notification template:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification template',
      message: error.message
    })
  }
})

module.exports = router
