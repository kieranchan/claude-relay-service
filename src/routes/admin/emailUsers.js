/**
 * 管理后台 - 邮箱用户管理路由（增强版）
 *
 * 路由前缀: /admin/email-users
 */

const express = require('express')
const router = express.Router()
const { prisma } = require('../../models/prisma')
const redis = require('../../models/redis')
const apiKeyService = require('../../services/apiKeyService')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const auditLogService = require('../../services/auditLogService')
const loginAttemptService = require('../../services/loginAttemptService')

/**
 * GET /admin/email-users/stats/overview
 * 获取邮箱用户统计
 * 注意：此路由必须在 /:id 之前定义，否则会被 /:id 匹配
 */
router.get('/stats/overview', authenticateAdmin, async (req, res) => {
  try {
    const [totalUsers, activeUsers, pendingUsers, suspendedUsers, adminUsers, totalApiKeys] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'active' } }),
        prisma.user.count({ where: { status: 'pending' } }),
        prisma.user.count({ where: { status: 'suspended' } }),
        prisma.user.count({ where: { role: { in: ['admin', 'super_admin'] } } }),
        prisma.apiKey.count({ where: { isDeleted: false } })
      ])

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        adminUsers,
        totalApiKeys
      }
    })
  } catch (error) {
    logger.error('❌ Failed to get user stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get user stats',
      message: error.message
    })
  }
})

/**
 * POST /admin/email-users/bulk-action
 * 批量操作用户
 */
router.post('/bulk-action', authenticateAdmin, async (req, res) => {
  try {
    const { userIds, action, params = {} } = req.body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds must be a non-empty array'
      })
    }

    const validActions = ['activate', 'suspend', 'delete', 'change_role']
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`
      })
    }

    const result = { success: 0, failed: 0, errors: [] }

    switch (action) {
      case 'activate':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'active' }
        })
        result.success = userIds.length
        logger.info(`✅ Admin activated ${userIds.length} users`)
        auditLogService.log({
          action: 'BULK_ACTIVATE_USERS',
          adminId: req.user.id,
          details: { count: userIds.length, userIds },
          ipAddress: req.ip
        })
        break

      case 'suspend':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'suspended' }
        })
        result.success = userIds.length
        logger.info(`✅ Admin suspended ${userIds.length} users`)
        auditLogService.log({
          action: 'BULK_SUSPEND_USERS',
          adminId: req.user.id,
          details: { count: userIds.length, userIds },
          ipAddress: req.ip
        })
        break

      case 'delete':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'deleted' }
        })
        result.success = userIds.length
        logger.warn(`⚠️ Admin deleted ${userIds.length} users`)
        auditLogService.log({
          action: 'BULK_DELETE_USERS',
          adminId: req.user.id,
          details: { count: userIds.length, userIds },
          ipAddress: req.ip
        })
        break

      case 'change_role': {
        const { role } = params
        const validRoles = ['user', 'admin', 'super_admin']
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            success: false,
            error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
          })
        }
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { role }
        })
        result.success = userIds.length
        result.success = userIds.length
        logger.info(`✅ Admin changed role to ${role} for ${userIds.length} users`)
        auditLogService.log({
          action: 'BULK_CHANGE_ROLE',
          adminId: req.user.id,
          details: { count: userIds.length, userIds, newRole: role },
          ipAddress: req.ip
        })
        break
      }
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: result
    })
  } catch (error) {
    logger.error('❌ Failed to perform bulk action:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk action',
      message: error.message
    })
  }
})

/**
 * POST /admin/email-users/export
 * 导出用户数据（CSV）
 */
router.post('/export', authenticateAdmin, async (req, res) => {
  try {
    const { filters = {}, fields = [] } = req.body

    // 构建查询条件
    const where = {}
    if (filters.status) {
      where.status = filters.status
    }
    if (filters.role) {
      where.role = filters.role
    }
    if (filters.search) {
      where.email = { contains: filters.search, mode: 'insensitive' }
    }

    // 获取用户数据
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            apiKeys: { where: { isDeleted: false } }
          }
        }
      }
    })

    // 默认导出字段
    const defaultFields = [
      'email',
      'status',
      'role',
      'emailVerified',
      'loginCount',
      'createdAt',
      'lastLoginAt'
    ]
    const exportFields = fields.length > 0 ? fields : defaultFields

    // 生成 CSV
    const csvRows = []

    // Header
    csvRows.push(exportFields.join(','))

    // Data rows
    for (const user of users) {
      const row = exportFields.map((field) => {
        let value = user[field]

        if (field === 'apiKeyCount') {
          value = user._count.apiKeys
        } else if (value instanceof Date) {
          value = value.toISOString()
        } else if (value === null || value === undefined) {
          value = ''
        } else if (typeof value === 'boolean') {
          value = value ? 'true' : 'false'
        }

        // Escape commas and quotes
        value = String(value).replace(/"/g, '""')
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`
        }

        return value
      })
      csvRows.push(row.join(','))
    }

    const csv = csvRows.join('\n')

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=email-users-${Date.now()}.csv`)

    // 添加 BOM 以支持 Excel 正确显示中文
    res.write('\uFEFF')
    res.write(csv)
    res.end()

    logger.info(`✅ Admin exported ${users.length} users to CSV`)
  } catch (error) {
    logger.error('❌ Failed to export users:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to export users',
      message: error.message
    })
  }
})

/**
 * GET /admin/email-users
 * 获取邮箱用户列表（增强版）
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, search = '', status = '', role = '' } = req.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
    const skip = (pageNum - 1) * pageSizeNum

    // 构建查询条件
    const where = {}

    if (search) {
      where.email = { contains: search, mode: 'insensitive' }
    }

    if (status) {
      where.status = status
    }

    if (role) {
      where.role = role
    }

    // 获取用户列表
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSizeNum,
        select: {
          id: true,
          email: true,
          displayName: true,
          emailVerified: true,
          status: true,
          role: true,
          source: true,
          loginCount: true,
          lastLoginIp: true,
          registerIp: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              apiKeys: {
                where: { isDeleted: false }
              }
            }
          }
        }
      }),
      prisma.user.count({ where })
    ])

    // 格式化响应
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      status: user.status,
      role: user.role,
      source: user.source,
      loginCount: user.loginCount,
      lastLoginIp: user.lastLoginIp,
      registerIp: user.registerIp,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      apiKeyCount: user._count.apiKeys
    }))

    res.json({
      success: true,
      data: {
        items: formattedUsers,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    })
  } catch (error) {
    logger.error('❌ Failed to get email users:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get email users',
      message: error.message
    })
  }
})

/**
 * GET /admin/email-users/:id
 * 获取用户详情（增强版 - 含使用统计）
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        apiKeys: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' }
        },
        subscriptions: {
          where: { status: 'active' },
          include: { plan: true }
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    // 计算使用统计
    let totalCost = 0
    const totalRequests = 0
    const apiKeyStats = []

    for (const key of user.apiKeys) {
      // 从 Redis 获取实时统计
      const costStats = await redis.getCostStats(key.id)
      const keyCost = costStats ? costStats.total : 0
      totalCost += keyCost

      apiKeyStats.push({
        id: key.id,
        name: key.name,
        cost: keyCost,
        isActive: key.isActive
      })
    }

    // 格式化 API Keys
    const formattedApiKeys = user.apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      isActive: key.isActive,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      totalCostLimit: Number(key.totalCostLimit),
      dailyCostLimit: Number(key.dailyCostLimit),
      weeklyCostLimit: Number(key.weeklyCostLimit),
      monthlyCostLimit: Number(key.monthlyCostLimit)
    }))

    // Risk Analysis
    const recentFailures = await loginAttemptService.countRecentFailures(user.email, null, 24 * 60)
    const riskFactors = []
    let riskScore = 0

    if (recentFailures > 5) {
      riskScore += 40
      riskFactors.push({
        type: 'high_login_failures',
        score: 40,
        description: `24小时内登录失败 ${recentFailures} 次`
      })
    } else if (recentFailures > 0) {
      riskScore += 10
      riskFactors.push({
        type: 'login_failures',
        score: 10,
        description: `24小时内登录失败 ${recentFailures} 次`
      })
    }

    if (user.status === 'suspended') {
      riskScore += 30
      riskFactors.push({ type: 'suspended', score: 30, description: '账户当前处于暂停状态' })
    }

    // Add more risk checks here...

    res.json({
      success: true,
      data: {
        // ... existing fields ...
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        status: user.status,
        role: user.role,
        source: user.source,
        loginCount: user.loginCount,
        lastLoginIp: user.lastLoginIp,
        registerIp: user.registerIp,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,

        // 使用统计
        stats: {
          totalApiKeys: user.apiKeys.length,
          activeApiKeys: user.apiKeys.filter((k) => k.isActive).length,
          totalCost,
          totalRequests,
          apiKeyStats
        },

        // 安全分析
        security: {
          riskScore,
          riskFactors,
          recentFailures
        },

        // 关联数据
        apiKeys: formattedApiKeys,
        subscriptions: user.subscriptions,
        recentActivity: user.activityLogs
      }
    })
  } catch (error) {
    logger.error('❌ Failed to get user details:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get user details',
      message: error.message
    })
  }
})

/**
 * PATCH /admin/email-users/:id/status
 * 更新用户状态
 */
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['pending', 'active', 'suspended', 'deleted']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status }
    })

    // 记录活动日志
    await prisma.userActivityLog.create({
      data: {
        userId: id,
        action: 'status_changed',
        details: { oldStatus: user.status, newStatus: status, changedBy: 'admin' }
      }
    })

    logger.info(`✅ Admin updated user ${user.email} status to ${status}`)
    auditLogService.log({
      action: 'UPDATE_USER_STATUS',
      adminId: req.user.id,
      targetUserId: id,
      details: { oldStatus: user.status, newStatus: status },
      ipAddress: req.ip
    })

    res.json({
      success: true,
      message: `User status updated to ${status}`,
      data: { id: user.id, status: user.status }
    })
  } catch (error) {
    logger.error('❌ Failed to update user status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update user status',
      message: error.message
    })
  }
})

/**
 * PATCH /admin/email-users/:id/role
 * 更新用户角色
 */
router.patch('/:id/role', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body

    const validRoles = ['user', 'admin', 'super_admin']
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      })
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role }
    })

    // 记录活动日志
    await prisma.userActivityLog.create({
      data: {
        userId: id,
        action: 'role_changed',
        details: { oldRole: user.role, newRole: role, changedBy: 'admin' }
      }
    })

    logger.info(`✅ Admin updated user ${user.email} role to ${role}`)
    auditLogService.log({
      action: 'UPDATE_USER_ROLE',
      adminId: req.user.id,
      targetUserId: id,
      details: { oldRole: user.role, newRole: role },
      ipAddress: req.ip
    })

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: { id: user.id, role: user.role }
    })
  } catch (error) {
    logger.error('❌ Failed to update user role:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
      message: error.message
    })
  }
})

/**
 * DELETE /admin/email-users/:id/api-keys/:keyId
 * 删除用户的 API Key
 */
router.delete('/:id/api-keys/:keyId', authenticateAdmin, async (req, res) => {
  try {
    const { id, keyId } = req.params

    // 验证 Key 属于该用户
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: id }
    })

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API Key not found or does not belong to this user'
      })
    }

    // 软删除
    await apiKeyService.deleteApiKey(keyId, 'admin', 'admin')

    // 记录活动日志
    await prisma.userActivityLog.create({
      data: {
        userId: id,
        action: 'api_key_deleted',
        details: { keyId, keyName: apiKey.name, deletedBy: 'admin' }
      }
    })

    logger.info(`✅ Admin deleted API key ${keyId} for user ${id}`)
    auditLogService.log({
      action: 'DELETE_USER_API_KEY',
      adminId: req.user.id,
      targetUserId: id,
      details: { keyId, keyName: apiKey.name },
      ipAddress: req.ip
    })

    res.json({
      success: true,
      message: 'API Key deleted successfully'
    })
  } catch (error) {
    logger.error('❌ Failed to delete API key:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key',
      message: error.message
    })
  }
})

module.exports = router
