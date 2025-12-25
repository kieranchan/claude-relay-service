/**
 * 邮箱用户路由
 * 处理用户信息管理、API Key 管理等
 *
 * 路由前缀: /api/v1/user
 */

const express = require('express')
const router = express.Router()
const { emailUserService } = require('../services/emailAuth')
const apiKeyService = require('../services/apiKeyService')
const { authenticateJwt, requireEmailVerified } = require('../middleware/authenticateJwt')
const logger = require('../utils/logger')

// 从环境变量获取配置
const MAX_API_KEYS_PER_USER = parseInt(process.env.MAX_EMAIL_USER_API_KEYS) || 3
const ALLOW_USER_DELETE_API_KEYS = process.env.ALLOW_EMAIL_USER_DELETE_API_KEYS === 'true'

// ===========================
// 用户信息路由
// ===========================

/**
 * GET /api/v1/user/profile
 * 获取当前用户信息
 */
router.get('/profile', authenticateJwt, async (req, res) => {
  try {
    const user = await emailUserService.getSafeUserById(req.emailUser.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
      })
    }

    // 获取用户的 API Key 数量
    const apiKeyCount = await emailUserService.getUserApiKeyCount(user.id)

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        loginCount: user.login_count,
        apiKeyCount,
        config: {
          maxApiKeysPerUser: MAX_API_KEYS_PER_USER,
          allowUserDeleteApiKeys: ALLOW_USER_DELETE_API_KEYS
        }
      }
    })
  } catch (error) {
    logger.error('Get profile error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '获取用户信息失败' }
    })
  }
})

/**
 * PUT /api/v1/user/profile
 * 更新用户信息（预留接口）
 */
router.put('/profile', authenticateJwt, async (req, res) => {
  try {
    // 目前邮箱用户只有邮箱，无其他可更新字段
    // 预留接口以便将来扩展

    res.json({
      success: true,
      message: '用户信息已更新'
    })
  } catch (error) {
    logger.error('Update profile error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '更新用户信息失败' }
    })
  }
})

// ===========================
// API Key 管理路由
// ===========================

/**
 * GET /api/v1/user/keys
 * 获取用户的 API Keys
 */
router.get('/keys', authenticateJwt, requireEmailVerified, async (req, res) => {
  try {
    // 获取用户关联的 API Key IDs
    const apiKeyIds = await emailUserService.getUserApiKeyIds(req.emailUser.id)

    const apiKeys = []
    for (const keyId of apiKeyIds) {
      const keyData = await apiKeyService.getApiKeyById(keyId)
      if (keyData && !keyData.isDeleted) {
        // 格式化 API Key 数据
        let flatUsage = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0
        }

        if (keyData.usage && keyData.usage.total) {
          flatUsage = {
            requests: keyData.usage.total.requests || 0,
            inputTokens: keyData.usage.total.inputTokens || 0,
            outputTokens: keyData.usage.total.outputTokens || 0,
            totalCost: keyData.totalCost || 0
          }
        }

        apiKeys.push({
          id: keyData.id,
          name: keyData.name,
          description: keyData.description,
          createdAt: keyData.createdAt,
          lastUsedAt: keyData.lastUsedAt,
          expiresAt: keyData.expiresAt,
          isActive: keyData.isActive,
          usage: flatUsage,
          dailyCost: keyData.dailyCost,
          dailyCostLimit: keyData.dailyCostLimit,
          totalCost: keyData.totalCost,
          totalCostLimit: keyData.totalCostLimit,
          // 只返回 Key 预览，不返回完整 Key
          keyPreview: keyData.key
            ? `${keyData.key.substring(0, 8)}...${keyData.key.substring(keyData.key.length - 4)}`
            : null
        })
      }
    }

    res.json({
      success: true,
      data: apiKeys,
      total: apiKeys.length
    })
  } catch (error) {
    logger.error('Get API keys error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '获取 API Keys 失败' }
    })
  }
})

/**
 * POST /api/v1/user/keys
 * 创建新的 API Key
 */
router.post('/keys', authenticateJwt, requireEmailVerified, async (req, res) => {
  try {
    const { name, description, expiresAt, dailyCostLimit, totalCostLimit } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'API Key 名称不能为空' }
      })
    }

    // 检查用户 API Key 数量限制
    const currentCount = await emailUserService.getUserApiKeyCount(req.emailUser.id)
    if (currentCount >= MAX_API_KEYS_PER_USER) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: `最多只能创建 ${MAX_API_KEYS_PER_USER} 个 API Keys`
        }
      })
    }

    // 创建 API Key
    const apiKeyData = {
      name: name.trim(),
      description: description?.trim() || '',
      userId: req.emailUser.id,
      userUsername: req.emailUser.email,
      expiresAt: expiresAt || null,
      dailyCostLimit: dailyCostLimit || null,
      totalCostLimit: totalCostLimit || null,
      createdBy: 'email_user',
      permissions: 'all'
    }

    const newApiKey = await apiKeyService.createApiKey(apiKeyData)

    // 关联 API Key 到用户
    await emailUserService.addApiKeyToUser(req.emailUser.id, newApiKey.id)

    logger.info(`🔑 Email user ${req.emailUser.email} created API key: ${name}`)

    res.status(201).json({
      success: true,
      message: 'API Key 创建成功',
      data: {
        id: newApiKey.id,
        name: newApiKey.name,
        description: newApiKey.description,
        key: newApiKey.apiKey, // 只在创建时返回完整 Key
        createdAt: newApiKey.createdAt,
        expiresAt: newApiKey.expiresAt,
        dailyCostLimit: newApiKey.dailyCostLimit,
        totalCostLimit: newApiKey.totalCostLimit
      }
    })
  } catch (error) {
    logger.error('Create API key error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '创建 API Key 失败' }
    })
  }
})

/**
 * DELETE /api/v1/user/keys/:id
 * 删除 API Key
 */
router.delete('/keys/:id', authenticateJwt, requireEmailVerified, async (req, res) => {
  try {
    const { id } = req.params

    // 检查是否允许用户删除 API Key
    if (!ALLOW_USER_DELETE_API_KEYS) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'OPERATION_NOT_ALLOWED',
          message: '不允许删除 API Keys，请联系管理员'
        }
      })
    }

    // 检查 API Key 是否属于当前用户
    const userKeyIds = await emailUserService.getUserApiKeyIds(req.emailUser.id)
    if (!userKeyIds.includes(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'KEY_NOT_FOUND', message: 'API Key 不存在或无权访问' }
      })
    }

    // 获取 API Key 信息用于日志
    const keyData = await apiKeyService.getApiKeyById(id)
    const keyName = keyData?.name || id

    // 删除 API Key
    await apiKeyService.deleteApiKey(id, req.emailUser.email, 'email_user')

    // 移除用户关联
    await emailUserService.removeApiKeyFromUser(req.emailUser.id, id)

    logger.info(`🗑️ Email user ${req.emailUser.email} deleted API key: ${keyName}`)

    res.json({
      success: true,
      message: 'API Key 已删除'
    })
  } catch (error) {
    logger.error('Delete API key error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '删除 API Key 失败' }
    })
  }
})

// ===========================
// 使用统计路由
// ===========================

/**
 * GET /api/v1/user/usage
 * 获取用户使用统计
 */
router.get('/usage', authenticateJwt, requireEmailVerified, async (req, res) => {
  try {
    const { period = 'week', model } = req.query

    // 获取用户的 API Key IDs
    const apiKeyIds = await emailUserService.getUserApiKeyIds(req.emailUser.id)

    if (apiKeyIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalRequests: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
          dailyStats: [],
          modelStats: []
        }
      })
    }

    // 获取使用统计
    const stats = await apiKeyService.getAggregatedUsageStats(apiKeyIds, { period, model })

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Get usage stats error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '获取使用统计失败' }
    })
  }
})

module.exports = router
