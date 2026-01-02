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
          weeklyCostLimit: keyData.weeklyCostLimit,
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
