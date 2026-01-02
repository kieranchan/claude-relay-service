const crypto = require('crypto')
const config = require('../../config/config')
const redis = require('../models/redis')
const logger = require('../utils/logger')
const { prisma } = require('../models/prisma')

const ACCOUNT_TYPE_CONFIG = {
  claude: { prefix: 'claude:account:' },
  'claude-console': { prefix: 'claude_console_account:' },
  openai: { prefix: 'openai:account:' },
  'openai-responses': { prefix: 'openai_responses_account:' },
  'azure-openai': { prefix: 'azure_openai:account:' },
  gemini: { prefix: 'gemini_account:' },
  'gemini-api': { prefix: 'gemini_api_account:' },
  droid: { prefix: 'droid:account:' }
}

const ACCOUNT_TYPE_PRIORITY = [
  'openai',
  'openai-responses',
  'azure-openai',
  'claude',
  'claude-console',
  'gemini',
  'gemini-api',
  'droid'
]

const ACCOUNT_CATEGORY_MAP = {
  claude: 'claude',
  'claude-console': 'claude',
  openai: 'openai',
  'openai-responses': 'openai',
  'azure-openai': 'openai',
  gemini: 'gemini',
  'gemini-api': 'gemini',
  droid: 'droid'
}

function normalizeAccountTypeKey(type) {
  if (!type) {
    return null
  }
  const lower = String(type).toLowerCase()
  if (lower === 'claude_console') {
    return 'claude-console'
  }
  if (lower === 'openai_responses' || lower === 'openai-response' || lower === 'openai-responses') {
    return 'openai-responses'
  }
  if (lower === 'azure_openai' || lower === 'azureopenai' || lower === 'azure-openai') {
    return 'azure-openai'
  }
  if (lower === 'gemini_api' || lower === 'gemini-api') {
    return 'gemini-api'
  }
  return lower
}

function sanitizeAccountIdForType(accountId, accountType) {
  if (!accountId || typeof accountId !== 'string') {
    return accountId
  }
  if (accountType === 'openai-responses') {
    return accountId.replace(/^responses:/, '')
  }
  if (accountType === 'gemini-api') {
    return accountId.replace(/^api:/, '')
  }
  return accountId
}

class ApiKeyService {
  constructor() {
    this.prefix = config.security.apiKeyPrefix
  }

  // 🔑 生成新的API Key
  async generateApiKey(options = {}) {
    const {
      name = 'Unnamed Key',
      description = '',
      tokenLimit = 0, // 默认为0，不再使用token限制
      expiresAt = null,
      claudeAccountId = null,
      claudeConsoleAccountId = null,
      geminiAccountId = null,
      openaiAccountId = null,
      azureOpenaiAccountId = null,
      bedrockAccountId = null, // 添加 Bedrock 账号ID支持
      droidAccountId = null,
      permissions = 'all', // 可选值：'claude'、'gemini'、'openai'、'droid' 或 'all'
      isActive = true,
      concurrencyLimit = 0,
      rateLimitWindow = null,
      rateLimitRequests = null,
      rateLimitCost = null, // 新增：速率限制费用字段
      enableModelRestriction = false,
      restrictedModels = [],
      enableClientRestriction = false,
      allowedClients = [],
      dailyCostLimit = 0,
      weeklyCostLimit = 0, // 新增：每周费用限制
      monthlyCostLimit = 0, // 新增：每月费用限制
      totalCostLimit = 0,
      weeklyOpusCostLimit = 0,
      tags = [],
      activationDays = 0, // 新增：激活后有效天数（0表示不使用此功能）
      activationUnit = 'days', // 新增：激活时间单位 'hours' 或 'days'
      expirationMode = 'fixed', // 新增：过期模式 'fixed'(固定时间) 或 'activation'(首次使用后激活)
      icon = '' // 新增：图标（base64编码）
    } = options

    // 生成简单的API Key (64字符十六进制)
    const apiKey = `${this.prefix}${this._generateSecretKey()}`
    const hashedKey = this._hashApiKey(apiKey)

    // 使用 Prisma 创建 API Key 记录
    const now = new Date()
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        name,
        description: description || null,
        keyHash: hashedKey,
        isActive,
        isDeleted: false,
        tokenLimit: BigInt(tokenLimit || 0),
        concurrencyLimit: concurrencyLimit || 0,
        rateLimitWindow: rateLimitWindow || 0,
        rateLimitRequests: rateLimitRequests || 0,
        rateLimitCost: rateLimitCost || 0,
        dailyCostLimit: dailyCostLimit || 0,
        weeklyCostLimit: weeklyCostLimit || 0,
        monthlyCostLimit: monthlyCostLimit || 0,
        totalCostLimit: totalCostLimit || 0,
        weeklyOpusCostLimit: weeklyOpusCostLimit || 0,
        permissions: permissions || 'all',
        claudeAccountId: claudeAccountId || null,
        claudeConsoleAccountId: claudeConsoleAccountId || null,
        geminiAccountId: geminiAccountId || null,
        openaiAccountId: openaiAccountId || null,
        azureOpenaiAccountId: azureOpenaiAccountId || null,
        bedrockAccountId: bedrockAccountId || null,
        droidAccountId: droidAccountId || null,
        enableModelRestriction: enableModelRestriction || false,
        restrictedModels: restrictedModels || [],
        enableClientRestriction: enableClientRestriction || false,
        allowedClients: allowedClients || [],
        tags: tags || [],
        expirationMode: expirationMode || 'fixed',
        expiresAt: expirationMode === 'fixed' && expiresAt ? new Date(expiresAt) : null,
        activationDays: activationDays || 0,
        activationUnit: activationUnit || 'days',
        isActivated: expirationMode === 'fixed',
        activatedAt: expirationMode === 'fixed' ? now : null,
        icon: icon || null,
        createdBy: options.createdBy || 'admin',
        userId: options.userId || null,
        userUsername: options.userUsername || null
      }
    })

    // 格式化 Redis 数据
    const redisKeyData = {
      ...apiKeyRecord,
      tokenLimit: apiKeyRecord.tokenLimit.toString(),
      expiresAt: apiKeyRecord.expiresAt ? apiKeyRecord.expiresAt.toISOString() : '',
      createdAt: apiKeyRecord.createdAt.toISOString(),
      updatedAt: apiKeyRecord.updatedAt.toISOString(),
      isActivated: apiKeyRecord.isActivated ? 'true' : 'false',
      activatedAt: apiKeyRecord.activatedAt ? apiKeyRecord.activatedAt.toISOString() : '',
      isActive: apiKeyRecord.isActive ? 'true' : 'false',
      enableModelRestriction: apiKeyRecord.enableModelRestriction ? 'true' : 'false',
      enableClientRestriction: apiKeyRecord.enableClientRestriction ? 'true' : 'false',
      isDeleted: apiKeyRecord.isDeleted ? 'true' : 'false',
      restrictedModels: JSON.stringify(apiKeyRecord.restrictedModels || []),
      allowedClients: JSON.stringify(apiKeyRecord.allowedClients || []),
      tags: JSON.stringify(apiKeyRecord.tags || [])
    }

    // 移除 null 值
    Object.keys(redisKeyData).forEach((key) => {
      if (redisKeyData[key] === null || redisKeyData[key] === undefined) {
        delete redisKeyData[key]
      }
    })

    // 存储到 Redis (同时建立哈希映射)
    await redis.setApiKey(apiKeyRecord.id, redisKeyData, hashedKey)

    // 同步添加到费用排序索引
    try {
      const costRankService = require('./costRankService')
      await costRankService.addKeyToIndexes(apiKeyRecord.id)
    } catch (err) {
      logger.warn(`Failed to add key ${apiKeyRecord.id} to cost rank indexes:`, err.message)
    }

    logger.success(`🔑 Generated new API key: ${name} (${apiKeyRecord.id})`)

    return {
      id: apiKeyRecord.id,
      apiKey, // 只在创建时返回完整的key
      name: apiKeyRecord.name,
      description: apiKeyRecord.description,
      tokenLimit: Number(apiKeyRecord.tokenLimit),
      concurrencyLimit: apiKeyRecord.concurrencyLimit,
      rateLimitWindow: apiKeyRecord.rateLimitWindow,
      rateLimitRequests: apiKeyRecord.rateLimitRequests,
      rateLimitCost: Number(apiKeyRecord.rateLimitCost),
      isActive: apiKeyRecord.isActive,
      claudeAccountId: apiKeyRecord.claudeAccountId,
      claudeConsoleAccountId: apiKeyRecord.claudeConsoleAccountId,
      geminiAccountId: apiKeyRecord.geminiAccountId,
      openaiAccountId: apiKeyRecord.openaiAccountId,
      azureOpenaiAccountId: apiKeyRecord.azureOpenaiAccountId,
      bedrockAccountId: apiKeyRecord.bedrockAccountId,
      droidAccountId: apiKeyRecord.droidAccountId,
      permissions: apiKeyRecord.permissions,
      enableModelRestriction: apiKeyRecord.enableModelRestriction,
      restrictedModels: apiKeyRecord.restrictedModels,
      enableClientRestriction: apiKeyRecord.enableClientRestriction,
      allowedClients: apiKeyRecord.allowedClients,
      dailyCostLimit: Number(apiKeyRecord.dailyCostLimit),
      weeklyCostLimit: Number(apiKeyRecord.weeklyCostLimit || 0),
      totalCostLimit: Number(apiKeyRecord.totalCostLimit),
      weeklyOpusCostLimit: Number(apiKeyRecord.weeklyOpusCostLimit),
      tags: apiKeyRecord.tags,
      activationDays: apiKeyRecord.activationDays,
      activationUnit: apiKeyRecord.activationUnit,
      expirationMode: apiKeyRecord.expirationMode,
      isActivated: apiKeyRecord.isActivated,
      activatedAt: apiKeyRecord.activatedAt?.toISOString() || null,
      createdAt: apiKeyRecord.createdAt.toISOString(),
      expiresAt: apiKeyRecord.expiresAt?.toISOString() || null,
      createdBy: apiKeyRecord.createdBy
    }
  }

  // 🔍 验证API Key
  async validateApiKey(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.prefix)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      // 计算API Key的哈希值
      const hashedKey = this._hashApiKey(apiKey)

      // 从 PostgreSQL 通过哈希值查找 API Key
      const keyRecord = await prisma.apiKey.findUnique({
        where: { keyHash: hashedKey }
      })

      if (!keyRecord) {
        logger.warn(`⚠️ API key not found: ${hashedKey.substring(0, 16)}...`)
        return { valid: false, error: 'API key not found' }
      }

      // 检查是否已删除
      if (keyRecord.isDeleted) {
        return { valid: false, error: 'API key has been deleted' }
      }

      // 检查是否激活
      if (!keyRecord.isActive) {
        return { valid: false, error: 'API key is disabled' }
      }

      // 处理激活逻辑（仅在 activation 模式下）
      if (keyRecord.expirationMode === 'activation' && !keyRecord.isActivated) {
        // 首次使用，需要激活
        const now = new Date()
        const activationPeriod = keyRecord.activationDays || 30 // 默认30
        const activationUnit = keyRecord.activationUnit || 'days' // 默认天

        // 根据单位计算过期时间
        let milliseconds
        if (activationUnit === 'hours') {
          milliseconds = activationPeriod * 60 * 60 * 1000 // 小时转毫秒
        } else {
          milliseconds = activationPeriod * 24 * 60 * 60 * 1000 // 天转毫秒
        }

        const expiresAt = new Date(now.getTime() + milliseconds)

        // 更新激活状态和过期时间到 PostgreSQL
        await prisma.apiKey.update({
          where: { id: keyRecord.id },
          data: {
            isActivated: true,
            activatedAt: now,
            expiresAt,
            lastUsedAt: now
          }
        })

        // 更新本地记录
        keyRecord.isActivated = true
        keyRecord.activatedAt = now
        keyRecord.expiresAt = expiresAt

        logger.success(
          `🔓 API key activated: ${keyRecord.id} (${
            keyRecord.name
          }), will expire in ${activationPeriod} ${activationUnit} at ${expiresAt.toISOString()}`
        )
      }

      // 检查是否过期
      if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        return { valid: false, error: 'API key has expired' }
      }

      // 如果API Key属于某个用户，检查用户是否被禁用
      if (keyRecord.userId) {
        try {
          const userService = require('./userService')
          const user = await userService.getUserById(keyRecord.userId, false)
          if (!user || !user.isActive) {
            return { valid: false, error: 'User account is disabled' }
          }
        } catch (error) {
          logger.error('❌ Error checking user status during API key validation:', error)
          return { valid: false, error: 'Unable to validate user status' }
        }
      }

      // 获取使用统计（从 Redis）
      const usage = await redis.getUsageStats(keyRecord.id)

      // 获取费用统计（从 Redis）
      const [dailyCost, costStats] = await Promise.all([
        redis.getDailyCost(keyRecord.id),
        redis.getCostStats(keyRecord.id)
      ])
      const totalCost = costStats?.total || 0

      logger.api(`🔓 API key validated successfully: ${keyRecord.id}`)

      return {
        valid: true,
        keyData: {
          id: keyRecord.id,
          name: keyRecord.name,
          description: keyRecord.description,
          createdAt: keyRecord.createdAt?.toISOString(),
          expiresAt: keyRecord.expiresAt?.toISOString() || null,
          claudeAccountId: keyRecord.claudeAccountId,
          claudeConsoleAccountId: keyRecord.claudeConsoleAccountId,
          geminiAccountId: keyRecord.geminiAccountId,
          openaiAccountId: keyRecord.openaiAccountId,
          azureOpenaiAccountId: keyRecord.azureOpenaiAccountId,
          bedrockAccountId: keyRecord.bedrockAccountId,
          droidAccountId: keyRecord.droidAccountId,
          permissions: keyRecord.permissions || 'all',
          tokenLimit: Number(keyRecord.tokenLimit),
          concurrencyLimit: keyRecord.concurrencyLimit || 0,
          rateLimitWindow: keyRecord.rateLimitWindow || 0,
          rateLimitRequests: keyRecord.rateLimitRequests || 0,
          rateLimitCost: Number(keyRecord.rateLimitCost || 0),
          enableModelRestriction: keyRecord.enableModelRestriction,
          restrictedModels: keyRecord.restrictedModels || [],
          enableClientRestriction: keyRecord.enableClientRestriction,
          allowedClients: keyRecord.allowedClients || [],
          dailyCostLimit: Number(keyRecord.dailyCostLimit || 0),
          totalCostLimit: Number(keyRecord.totalCostLimit || 0),
          weeklyCostLimit: Number(keyRecord.weeklyCostLimit || 0),
          weeklyOpusCostLimit: Number(keyRecord.weeklyOpusCostLimit || 0),
          dailyCost: dailyCost || 0,
          totalCost,
          weeklyCost: (await redis.getWeeklyCost(keyRecord.id)) || 0,
          weeklyOpusCost: (await redis.getWeeklyOpusCost(keyRecord.id)) || 0,
          tags: keyRecord.tags || [],
          usage
        }
      }
    } catch (error) {
      logger.error('❌ API key validation error:', error)
      return { valid: false, error: 'Internal validation error' }
    }
  }

  // 🔍 验证API Key（仅用于统计查询，不触发激活）
  async validateApiKeyForStats(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith(this.prefix)) {
        return { valid: false, error: 'Invalid API key format' }
      }

      // 计算API Key的哈希值
      const hashedKey = this._hashApiKey(apiKey)

      // 从 PostgreSQL 通过哈希值查找 API Key
      const keyRecord = await prisma.apiKey.findUnique({
        where: { keyHash: hashedKey }
      })

      if (!keyRecord) {
        return { valid: false, error: 'API key not found' }
      }

      // 检查是否已删除
      if (keyRecord.isDeleted) {
        return { valid: false, error: 'API key has been deleted' }
      }

      // 检查是否激活
      if (!keyRecord.isActive) {
        const keyName = keyRecord.name || 'Unknown'
        return { valid: false, error: `API Key "${keyName}" 已被禁用`, keyName }
      }

      // 注意：这里不处理激活逻辑，保持 API Key 的未激活状态

      // 检查是否过期（仅对已激活的 Key 检查）
      if (keyRecord.isActivated && keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
        const keyName = keyRecord.name || 'Unknown'
        return { valid: false, error: `API Key "${keyName}" 已过期`, keyName }
      }

      // 如果API Key属于某个用户，检查用户是否被禁用
      if (keyRecord.userId) {
        try {
          const userService = require('./userService')
          const user = await userService.getUserById(keyRecord.userId, false)
          if (!user || !user.isActive) {
            return { valid: false, error: 'User account is disabled' }
          }
        } catch (userError) {
          // 如果用户服务出错，记录但不影响API Key验证
          logger.warn(`Failed to check user status for API key ${keyRecord.id}:`, userError)
        }
      }

      // 获取费用统计（从 Redis）
      const [dailyCost, costStats] = await Promise.all([
        redis.getDailyCost(keyRecord.id),
        redis.getCostStats(keyRecord.id)
      ])

      // 获取使用统计（从 Redis）
      const usage = await redis.getUsageStats(keyRecord.id)

      return {
        valid: true,
        keyData: {
          id: keyRecord.id,
          name: keyRecord.name,
          description: keyRecord.description,
          createdAt: keyRecord.createdAt?.toISOString(),
          expiresAt: keyRecord.expiresAt?.toISOString() || null,
          expirationMode: keyRecord.expirationMode || 'fixed',
          isActivated: keyRecord.isActivated,
          activationDays: keyRecord.activationDays || 0,
          activationUnit: keyRecord.activationUnit || 'days',
          activatedAt: keyRecord.activatedAt?.toISOString() || null,
          claudeAccountId: keyRecord.claudeAccountId,
          claudeConsoleAccountId: keyRecord.claudeConsoleAccountId,
          geminiAccountId: keyRecord.geminiAccountId,
          openaiAccountId: keyRecord.openaiAccountId,
          azureOpenaiAccountId: keyRecord.azureOpenaiAccountId,
          bedrockAccountId: keyRecord.bedrockAccountId,
          droidAccountId: keyRecord.droidAccountId,
          permissions: keyRecord.permissions || 'all',
          tokenLimit: Number(keyRecord.tokenLimit),
          concurrencyLimit: keyRecord.concurrencyLimit || 0,
          rateLimitWindow: keyRecord.rateLimitWindow || 0,
          rateLimitRequests: keyRecord.rateLimitRequests || 0,
          rateLimitCost: Number(keyRecord.rateLimitCost || 0),
          enableModelRestriction: keyRecord.enableModelRestriction,
          restrictedModels: keyRecord.restrictedModels || [],
          enableClientRestriction: keyRecord.enableClientRestriction,
          allowedClients: keyRecord.allowedClients || [],
          dailyCostLimit: Number(keyRecord.dailyCostLimit || 0),
          totalCostLimit: Number(keyRecord.totalCostLimit || 0),
          weeklyOpusCostLimit: Number(keyRecord.weeklyOpusCostLimit || 0),
          dailyCost: dailyCost || 0,
          totalCost: costStats?.total || 0,
          weeklyOpusCost: (await redis.getWeeklyOpusCost(keyRecord.id)) || 0,
          tags: keyRecord.tags || [],
          usage
        }
      }
    } catch (error) {
      logger.error('❌ API key validation error (stats):', error)
      return { valid: false, error: 'Internal validation error' }
    }
  }

  // 📋 获取所有API Keys
  async getAllApiKeys(includeDeleted = false) {
    try {
      // 从 PostgreSQL 获取所有 API Keys
      const whereClause = includeDeleted ? {} : { isDeleted: false }
      const apiKeyRecords = await prisma.apiKey.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      })

      const client = redis.getClientSafe()
      const accountInfoCache = new Map()
      const apiKeys = []

      // 为每个key添加使用统计和当前并发数
      for (const record of apiKeyRecords) {
        const key = {
          id: record.id,
          name: record.name,
          description: record.description,
          createdAt: record.createdAt?.toISOString(),
          expiresAt: record.expiresAt?.toISOString() || null,
          lastUsedAt: record.lastUsedAt?.toISOString() || null,
          claudeAccountId: record.claudeAccountId,
          claudeConsoleAccountId: record.claudeConsoleAccountId,
          geminiAccountId: record.geminiAccountId,
          openaiAccountId: record.openaiAccountId,
          azureOpenaiAccountId: record.azureOpenaiAccountId,
          bedrockAccountId: record.bedrockAccountId,
          droidAccountId: record.droidAccountId,
          permissions: record.permissions || 'all',
          tokenLimit: Number(record.tokenLimit),
          concurrencyLimit: record.concurrencyLimit || 0,
          rateLimitWindow: record.rateLimitWindow || 0,
          rateLimitRequests: record.rateLimitRequests || 0,
          rateLimitCost: Number(record.rateLimitCost || 0),
          isActive: record.isActive,
          isDeleted: record.isDeleted,
          deletedAt: record.deletedAt?.toISOString() || null,
          deletedBy: record.deletedBy,
          deletedByType: record.deletedByType,
          enableModelRestriction: record.enableModelRestriction,
          restrictedModels: record.restrictedModels || [],
          enableClientRestriction: record.enableClientRestriction,
          allowedClients: record.allowedClients || [],
          dailyCostLimit: Number(record.dailyCostLimit || 0),
          weeklyCostLimit: Number(record.weeklyCostLimit || 0),
          monthlyCostLimit: Number(record.monthlyCostLimit || 0),
          totalCostLimit: Number(record.totalCostLimit || 0),
          weeklyOpusCostLimit: Number(record.weeklyOpusCostLimit || 0),
          tags: record.tags || [],
          activationDays: record.activationDays || 0,
          activationUnit: record.activationUnit || 'days',
          expirationMode: record.expirationMode || 'fixed',
          isActivated: record.isActivated,
          activatedAt: record.activatedAt?.toISOString() || null,
          icon: record.icon,
          createdBy: record.createdBy,
          userId: record.userId,
          userUsername: record.userUsername
        }

        // 从 Redis 获取使用统计
        key.usage = await redis.getUsageStats(key.id)
        const costStats = await redis.getCostStats(key.id)
        if (key.usage && costStats) {
          key.usage.total = key.usage.total || {}
          key.usage.total.cost = costStats.total
          key.usage.totalCost = costStats.total
        }
        key.totalCost = costStats ? costStats.total : 0
        key.currentConcurrency = await redis.getConcurrency(key.id)
        key.dailyCost = (await redis.getDailyCost(key.id)) || 0
        key.weeklyCost = (await redis.getWeeklyCost(key.id)) || 0
        key.monthlyCost = (await redis.getMonthlyCost(key.id)) || 0
        key.weeklyOpusCost = (await redis.getWeeklyOpusCost(key.id)) || 0

        // 获取当前时间窗口的请求次数、Token使用量和费用
        if (key.rateLimitWindow > 0) {
          const requestCountKey = `rate_limit:requests:${key.id}`
          const tokenCountKey = `rate_limit:tokens:${key.id}`
          const costCountKey = `rate_limit:cost:${key.id}`
          const windowStartKey = `rate_limit:window_start:${key.id}`

          key.currentWindowRequests = parseInt((await client.get(requestCountKey)) || '0')
          key.currentWindowTokens = parseInt((await client.get(tokenCountKey)) || '0')
          key.currentWindowCost = parseFloat((await client.get(costCountKey)) || '0')

          const windowStart = await client.get(windowStartKey)
          if (windowStart) {
            const now = Date.now()
            const windowStartTime = parseInt(windowStart)
            const windowDuration = key.rateLimitWindow * 60 * 1000
            const windowEndTime = windowStartTime + windowDuration

            if (now < windowEndTime) {
              key.windowStartTime = windowStartTime
              key.windowEndTime = windowEndTime
              key.windowRemainingSeconds = Math.max(0, Math.floor((windowEndTime - now) / 1000))
            } else {
              key.windowStartTime = null
              key.windowEndTime = null
              key.windowRemainingSeconds = 0
              key.currentWindowRequests = 0
              key.currentWindowTokens = 0
              key.currentWindowCost = 0
            }
          } else {
            key.windowStartTime = null
            key.windowEndTime = null
            key.windowRemainingSeconds = null
          }
        } else {
          key.currentWindowRequests = 0
          key.currentWindowTokens = 0
          key.currentWindowCost = 0
          key.windowStartTime = null
          key.windowEndTime = null
          key.windowRemainingSeconds = null
        }

        // 获取最后使用记录
        let lastUsageRecord = null
        try {
          const usageRecords = await redis.getUsageRecords(key.id, 1)
          if (Array.isArray(usageRecords) && usageRecords.length > 0) {
            lastUsageRecord = usageRecords[0]
          }
        } catch (error) {
          logger.debug(`加载 API Key ${key.id} 的使用记录失败:`, error)
        }

        if (lastUsageRecord && (lastUsageRecord.accountId || lastUsageRecord.accountType)) {
          const resolvedAccount = await this._resolveLastUsageAccount(
            key,
            lastUsageRecord,
            accountInfoCache,
            client
          )

          if (resolvedAccount) {
            key.lastUsage = {
              accountId: resolvedAccount.accountId,
              rawAccountId: lastUsageRecord.accountId || resolvedAccount.accountId,
              accountType: resolvedAccount.accountType,
              accountCategory: resolvedAccount.accountCategory,
              accountName: resolvedAccount.accountName,
              recordedAt: lastUsageRecord.timestamp || key.lastUsedAt || null
            }
          } else {
            key.lastUsage = {
              accountId: null,
              rawAccountId: lastUsageRecord.accountId || null,
              accountType: 'deleted',
              accountCategory: 'deleted',
              accountName: '已删除',
              recordedAt: lastUsageRecord.timestamp || key.lastUsedAt || null
            }
          }
        } else {
          key.lastUsage = null
        }

        apiKeys.push(key)
      }

      return apiKeys
    } catch (error) {
      logger.error('❌ Failed to get API keys:', error)
      throw error
    }
  }

  // 📝 更新API Key
  async updateApiKey(keyId, updates) {
    try {
      // 从 PostgreSQL 获取现有数据
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!keyRecord) {
        throw new Error('API key not found')
      }

      // 构建更新数据
      const updateData = {}

      // 字段映射：前端字段名 -> Prisma 字段名
      const fieldMapping = {
        name: 'name',
        description: 'description',
        tokenLimit: 'tokenLimit',
        concurrencyLimit: 'concurrencyLimit',
        rateLimitWindow: 'rateLimitWindow',
        rateLimitRequests: 'rateLimitRequests',
        rateLimitCost: 'rateLimitCost',
        isActive: 'isActive',
        claudeAccountId: 'claudeAccountId',
        claudeConsoleAccountId: 'claudeConsoleAccountId',
        geminiAccountId: 'geminiAccountId',
        openaiAccountId: 'openaiAccountId',
        azureOpenaiAccountId: 'azureOpenaiAccountId',
        bedrockAccountId: 'bedrockAccountId',
        droidAccountId: 'droidAccountId',
        permissions: 'permissions',
        expiresAt: 'expiresAt',
        activationDays: 'activationDays',
        activationUnit: 'activationUnit',
        expirationMode: 'expirationMode',
        isActivated: 'isActivated',
        activatedAt: 'activatedAt',
        enableModelRestriction: 'enableModelRestriction',
        restrictedModels: 'restrictedModels',
        enableClientRestriction: 'enableClientRestriction',
        allowedClients: 'allowedClients',
        dailyCostLimit: 'dailyCostLimit',
        weeklyCostLimit: 'weeklyCostLimit',
        monthlyCostLimit: 'monthlyCostLimit',
        totalCostLimit: 'totalCostLimit',
        weeklyOpusCostLimit: 'weeklyOpusCostLimit',
        tags: 'tags',
        userId: 'userId',
        userUsername: 'userUsername',
        createdBy: 'createdBy',
        icon: 'icon'
      }

      for (const [field, prismaField] of Object.entries(fieldMapping)) {
        if (updates[field] !== undefined) {
          let value = updates[field]

          // 特殊处理不同类型的字段
          if (field === 'tokenLimit') {
            value = BigInt(value || 0)
          } else if (field === 'expiresAt' || field === 'activatedAt') {
            value = value ? new Date(value) : null
          } else if (
            field === 'concurrencyLimit' ||
            field === 'rateLimitWindow' ||
            field === 'rateLimitRequests' ||
            field === 'activationDays'
          ) {
            value = parseInt(value) || 0
          } else if (
            field === 'rateLimitCost' ||
            field === 'dailyCostLimit' ||
            field === 'weeklyCostLimit' ||
            field === 'monthlyCostLimit' ||
            field === 'totalCostLimit' ||
            field === 'weeklyOpusCostLimit'
          ) {
            value = parseFloat(value) || 0
          } else if (
            field === 'claudeAccountId' ||
            field === 'claudeConsoleAccountId' ||
            field === 'geminiAccountId' ||
            field === 'openaiAccountId' ||
            field === 'azureOpenaiAccountId' ||
            field === 'bedrockAccountId' ||
            field === 'droidAccountId' ||
            field === 'userId'
          ) {
            value = value || null
          }

          updateData[prismaField] = value
        }
      }

      // 更新 PostgreSQL
      await prisma.apiKey.update({
        where: { id: keyId },
        data: updateData
      })

      logger.success(`📝 Updated API key: ${keyId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to update API key:', error)
      throw error
    }
  }

  // 🗑️ 软删除API Key (保留使用统计)
  async deleteApiKey(keyId, deletedBy = 'system', deletedByType = 'system') {
    try {
      // 从 PostgreSQL 获取现有数据
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!keyRecord) {
        throw new Error('API key not found')
      }

      // 软删除：标记为已删除，保留所有数据
      await prisma.apiKey.update({
        where: { id: keyId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          deletedByType,
          isActive: false
        }
      })

      // 从费用排序索引中移除
      try {
        const costRankService = require('./costRankService')
        await costRankService.removeKeyFromIndexes(keyId)
      } catch (err) {
        logger.warn(`Failed to remove key ${keyId} from cost rank indexes:`, err.message)
      }

      logger.success(`🗑️ Soft deleted API key: ${keyId} by ${deletedBy} (${deletedByType})`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to delete API key:', error)
      throw error
    }
  }

  // 🔄 恢复已删除的API Key
  async restoreApiKey(keyId, restoredBy = 'system', restoredByType = 'system') {
    try {
      // 从 PostgreSQL 获取现有数据
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!keyRecord) {
        throw new Error('API key not found')
      }

      // 检查是否确实是已删除的key
      if (!keyRecord.isDeleted) {
        throw new Error('API key is not deleted')
      }

      // 恢复：清除删除标记，重新激活
      const updatedRecord = await prisma.apiKey.update({
        where: { id: keyId },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          deletedByType: null,
          isActive: true
        }
      })

      // 重新添加到费用排序索引
      try {
        const costRankService = require('./costRankService')
        await costRankService.addKeyToIndexes(keyId)
      } catch (err) {
        logger.warn(`Failed to add restored key ${keyId} to cost rank indexes:`, err.message)
      }

      logger.success(`✅ Restored API key: ${keyId} by ${restoredBy} (${restoredByType})`)

      return { success: true, apiKey: updatedRecord }
    } catch (error) {
      logger.error('❌ Failed to restore API key:', error)
      throw error
    }
  }

  // 🗑️ 彻底删除API Key（物理删除）
  async permanentDeleteApiKey(keyId) {
    try {
      // 从 PostgreSQL 获取现有数据
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!keyRecord) {
        throw new Error('API key not found')
      }

      // 确保只能彻底删除已经软删除的key
      if (!keyRecord.isDeleted) {
        throw new Error('只能彻底删除已经删除的API Key')
      }

      // 删除 Redis 中所有相关的使用统计数据
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const client = redis.getClientSafe()

      // 删除每日统计
      await client.del(`usage:daily:${today}:${keyId}`)
      await client.del(`usage:daily:${yesterday}:${keyId}`)

      // 删除月度统计
      const currentMonth = today.substring(0, 7)
      await client.del(`usage:monthly:${currentMonth}:${keyId}`)

      // 删除所有相关的统计键（通过模式匹配）
      const usageKeys = await client.keys(`usage:*:${keyId}*`)
      if (usageKeys.length > 0) {
        await client.del(...usageKeys)
      }

      // 从 PostgreSQL 彻底删除 API Key
      await prisma.apiKey.delete({
        where: { id: keyId }
      })

      logger.success(`🗑️ Permanently deleted API key: ${keyId}`)

      return { success: true }
    } catch (error) {
      logger.error('❌ Failed to permanently delete API key:', error)
      throw error
    }
  }

  // 🧹 清空所有已删除的API Keys
  async clearAllDeletedApiKeys() {
    try {
      const allKeys = await this.getAllApiKeys(true)
      const deletedKeys = allKeys.filter((key) => key.isDeleted === true)

      let successCount = 0
      let failedCount = 0
      const errors = []

      for (const key of deletedKeys) {
        try {
          await this.permanentDeleteApiKey(key.id)
          successCount++
        } catch (error) {
          failedCount++
          errors.push({
            keyId: key.id,
            keyName: key.name,
            error: error.message
          })
        }
      }

      logger.success(`🧹 Cleared deleted API keys: ${successCount} success, ${failedCount} failed`)

      return {
        success: true,
        total: deletedKeys.length,
        successCount,
        failedCount,
        errors
      }
    } catch (error) {
      logger.error('❌ Failed to clear all deleted API keys:', error)
      throw error
    }
  }

  // 📊 记录使用情况（支持缓存token和账户级别统计）
  async recordUsage(
    keyId,
    inputTokens = 0,
    outputTokens = 0,
    cacheCreateTokens = 0,
    cacheReadTokens = 0,
    model = 'unknown',
    accountId = null
  ) {
    try {
      const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      // 计算费用
      const CostCalculator = require('../utils/costCalculator')
      const costInfo = CostCalculator.calculateCost(
        {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreateTokens,
          cache_read_input_tokens: cacheReadTokens
        },
        model
      )

      // 检查是否为 1M 上下文请求
      let isLongContextRequest = false
      if (model && model.includes('[1m]')) {
        const totalInputTokens = inputTokens + cacheCreateTokens + cacheReadTokens
        isLongContextRequest = totalInputTokens > 200000
      }

      // 记录API Key级别的使用统计
      await redis.incrementTokenUsage(
        keyId,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        0, // ephemeral5mTokens - 暂时为0，后续处理
        0, // ephemeral1hTokens - 暂时为0，后续处理
        isLongContextRequest
      )

      // 记录费用统计
      if (costInfo.costs.total > 0) {
        await redis.incrementDailyCost(keyId, costInfo.costs.total)
        await redis.incrementWeeklyCost(keyId, costInfo.costs.total)
        await redis.incrementMonthlyCost(keyId, costInfo.costs.total) // 新增：月费用
        logger.database(
          `💰 Recorded cost for ${keyId}: $${costInfo.costs.total.toFixed(6)}, model: ${model}`
        )
      } else {
        logger.debug(`💰 No cost recorded for ${keyId} - zero cost for model: ${model}`)
      }

      // 更新最后使用时间到 PostgreSQL
      try {
        await prisma.apiKey.update({
          where: { id: keyId },
          data: { lastUsedAt: new Date() }
        })
      } catch (updateError) {
        logger.warn(`Failed to update lastUsedAt for API Key ${keyId}:`, updateError.message)
      }

      // 记录账户级别的使用统计（只统计实际处理请求的账户）
      if (accountId) {
        await redis.incrementAccountUsage(
          accountId,
          totalTokens,
          inputTokens,
          outputTokens,
          cacheCreateTokens,
          cacheReadTokens,
          model,
          isLongContextRequest
        )
        logger.database(
          `📊 Recorded account usage: ${accountId} - ${totalTokens} tokens (API Key: ${keyId})`
        )
      } else {
        logger.debug(
          '⚠️ No accountId provided for usage recording, skipping account-level statistics'
        )
      }

      // 记录单次请求的使用详情
      const usageCost = costInfo && costInfo.costs ? costInfo.costs.total || 0 : 0
      await redis.addUsageRecord(keyId, {
        timestamp: new Date().toISOString(),
        model,
        accountId: accountId || null,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        totalTokens,
        cost: Number(usageCost.toFixed(6)),
        costBreakdown: costInfo && costInfo.costs ? costInfo.costs : undefined
      })

      const logParts = [`Model: ${model}`, `Input: ${inputTokens}`, `Output: ${outputTokens}`]
      if (cacheCreateTokens > 0) {
        logParts.push(`Cache Create: ${cacheCreateTokens}`)
      }
      if (cacheReadTokens > 0) {
        logParts.push(`Cache Read: ${cacheReadTokens}`)
      }
      logParts.push(`Total: ${totalTokens} tokens`)

      logger.database(`📊 Recorded usage: ${keyId} - ${logParts.join(', ')}`)
    } catch (error) {
      logger.error('❌ Failed to record usage:', error)
    }
  }

  // 📊 记录 Opus 模型费用（仅限 claude 和 claude-console 账户）
  async recordOpusCost(keyId, cost, model, accountType) {
    try {
      // 判断是否为 Opus 模型
      if (!model || !model.toLowerCase().includes('claude-opus')) {
        return // 不是 Opus 模型，直接返回
      }

      // 判断是否为 claude、claude-console 或 ccr 账户
      if (
        !accountType ||
        (accountType !== 'claude' && accountType !== 'claude-console' && accountType !== 'ccr')
      ) {
        logger.debug(`⚠️ Skipping Opus cost recording for non-Claude account type: ${accountType}`)
        return // 不是 claude 账户，直接返回
      }

      // 记录 Opus 周费用
      await redis.incrementWeeklyOpusCost(keyId, cost)
      logger.database(
        `💰 Recorded Opus weekly cost for ${keyId}: $${cost.toFixed(
          6
        )}, model: ${model}, account type: ${accountType}`
      )
    } catch (error) {
      logger.error('❌ Failed to record Opus cost:', error)
    }
  }

  // 📊 记录使用情况（新版本，支持详细的缓存类型）
  async recordUsageWithDetails(
    keyId,
    usageObject,
    model = 'unknown',
    accountId = null,
    accountType = null
  ) {
    try {
      // 获取 API Key 数据（用于计费事件）
      let keyData = null
      try {
        keyData = await prisma.apiKey.findUnique({
          where: { id: keyId },
          select: { name: true, userId: true }
        })
      } catch (keyDataError) {
        logger.warn(`Failed to get API Key data for billing event: ${keyDataError.message}`)
      }

      // 提取 token 数量
      const inputTokens = usageObject.input_tokens || 0
      const outputTokens = usageObject.output_tokens || 0
      const cacheCreateTokens = usageObject.cache_creation_input_tokens || 0
      const cacheReadTokens = usageObject.cache_read_input_tokens || 0

      const totalTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

      // 计算费用（支持详细的缓存类型）- 添加错误处理
      let costInfo = { totalCost: 0, ephemeral5mCost: 0, ephemeral1hCost: 0 }
      try {
        const pricingService = require('./pricingService')
        // 确保 pricingService 已初始化
        if (!pricingService.pricingData) {
          logger.warn('⚠️ PricingService not initialized, initializing now...')
          await pricingService.initialize()
        }
        costInfo = pricingService.calculateCost(usageObject, model)

        // 验证计算结果
        if (!costInfo || typeof costInfo.totalCost !== 'number') {
          logger.error(`❌ Invalid cost calculation result for model ${model}:`, costInfo)
          // 使用 CostCalculator 作为后备
          const CostCalculator = require('../utils/costCalculator')
          const fallbackCost = CostCalculator.calculateCost(usageObject, model)
          if (fallbackCost && fallbackCost.costs && fallbackCost.costs.total > 0) {
            logger.warn(
              `⚠️ Using fallback cost calculation for ${model}: $${fallbackCost.costs.total}`
            )
            costInfo = {
              totalCost: fallbackCost.costs.total,
              ephemeral5mCost: 0,
              ephemeral1hCost: 0
            }
          } else {
            costInfo = { totalCost: 0, ephemeral5mCost: 0, ephemeral1hCost: 0 }
          }
        }
      } catch (pricingError) {
        logger.error(`❌ Failed to calculate cost for model ${model}:`, pricingError)
        logger.error(`   Usage object:`, JSON.stringify(usageObject))
        // 使用 CostCalculator 作为后备
        try {
          const CostCalculator = require('../utils/costCalculator')
          const fallbackCost = CostCalculator.calculateCost(usageObject, model)
          if (fallbackCost && fallbackCost.costs && fallbackCost.costs.total > 0) {
            logger.warn(
              `⚠️ Using fallback cost calculation for ${model}: $${fallbackCost.costs.total}`
            )
            costInfo = {
              totalCost: fallbackCost.costs.total,
              ephemeral5mCost: 0,
              ephemeral1hCost: 0
            }
          }
        } catch (fallbackError) {
          logger.error(`❌ Fallback cost calculation also failed:`, fallbackError)
        }
      }

      // 提取详细的缓存创建数据
      let ephemeral5mTokens = 0
      let ephemeral1hTokens = 0

      if (usageObject.cache_creation && typeof usageObject.cache_creation === 'object') {
        ephemeral5mTokens = usageObject.cache_creation.ephemeral_5m_input_tokens || 0
        ephemeral1hTokens = usageObject.cache_creation.ephemeral_1h_input_tokens || 0
      }

      // 记录API Key级别的使用统计 - 这个必须执行
      await redis.incrementTokenUsage(
        keyId,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        model,
        ephemeral5mTokens, // 传递5分钟缓存 tokens
        ephemeral1hTokens, // 传递1小时缓存 tokens
        costInfo.isLongContextRequest || false // 传递 1M 上下文请求标记
      )

      // 记录费用统计
      if (costInfo.totalCost > 0) {
        await redis.incrementDailyCost(keyId, costInfo.totalCost)
        logger.database(
          `💰 Recorded cost for ${keyId}: $${costInfo.totalCost.toFixed(6)}, model: ${model}`
        )

        // 记录 Opus 周费用（如果适用）
        await this.recordOpusCost(keyId, costInfo.totalCost, model, accountType)

        // 记录普通周费用 (New Feature)
        await redis.incrementWeeklyCost(keyId, costInfo.totalCost)

        // 记录详细的缓存费用（如果有）
        if (costInfo.ephemeral5mCost > 0 || costInfo.ephemeral1hCost > 0) {
          logger.database(
            `💰 Cache costs - 5m: $${costInfo.ephemeral5mCost.toFixed(
              6
            )}, 1h: $${costInfo.ephemeral1hCost.toFixed(6)}`
          )
        }
      } else {
        // 如果有 token 使用但费用为 0，记录警告
        if (totalTokens > 0) {
          logger.warn(
            `⚠️ No cost recorded for ${keyId} - zero cost for model: ${model} (tokens: ${totalTokens})`
          )
          logger.warn(`   This may indicate a pricing issue or model not found in pricing data`)
        } else {
          logger.debug(`💰 No cost recorded for ${keyId} - zero tokens for model: ${model}`)
        }
      }

      // 更新最后使用时间到 PostgreSQL
      try {
        await prisma.apiKey.update({
          where: { id: keyId },
          data: { lastUsedAt: new Date() }
        })
      } catch (updateError) {
        logger.warn(`Failed to update lastUsedAt for API Key ${keyId}:`, updateError.message)
      }

      // 记录账户级别的使用统计（只统计实际处理请求的账户）
      if (accountId) {
        await redis.incrementAccountUsage(
          accountId,
          totalTokens,
          inputTokens,
          outputTokens,
          cacheCreateTokens,
          cacheReadTokens,
          model,
          costInfo.isLongContextRequest || false
        )
        logger.database(
          `📊 Recorded account usage: ${accountId} - ${totalTokens} tokens (API Key: ${keyId})`
        )
      } else {
        logger.debug(
          '⚠️ No accountId provided for usage recording, skipping account-level statistics'
        )
      }

      const usageRecord = {
        timestamp: new Date().toISOString(),
        model,
        accountId: accountId || null,
        accountType: accountType || null,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        ephemeral5mTokens,
        ephemeral1hTokens,
        totalTokens,
        cost: Number((costInfo.totalCost || 0).toFixed(6)),
        costBreakdown: {
          input: costInfo.inputCost || 0,
          output: costInfo.outputCost || 0,
          cacheCreate: costInfo.cacheCreateCost || 0,
          cacheRead: costInfo.cacheReadCost || 0,
          ephemeral5m: costInfo.ephemeral5mCost || 0,
          ephemeral1h: costInfo.ephemeral1hCost || 0
        },
        isLongContext: costInfo.isLongContextRequest || false
      }

      await redis.addUsageRecord(keyId, usageRecord)

      const logParts = [`Model: ${model}`, `Input: ${inputTokens}`, `Output: ${outputTokens}`]
      if (cacheCreateTokens > 0) {
        logParts.push(`Cache Create: ${cacheCreateTokens}`)

        // 如果有详细的缓存创建数据，也记录它们
        if (usageObject.cache_creation) {
          const { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens } =
            usageObject.cache_creation
          if (ephemeral_5m_input_tokens > 0) {
            logParts.push(`5m: ${ephemeral_5m_input_tokens}`)
          }
          if (ephemeral_1h_input_tokens > 0) {
            logParts.push(`1h: ${ephemeral_1h_input_tokens}`)
          }
        }
      }
      if (cacheReadTokens > 0) {
        logParts.push(`Cache Read: ${cacheReadTokens}`)
      }
      logParts.push(`Total: ${totalTokens} tokens`)

      logger.database(`📊 Recorded usage: ${keyId} - ${logParts.join(', ')}`)

      // 🔔 发布计费事件到消息队列（异步非阻塞）
      this._publishBillingEvent({
        keyId,
        keyName: keyData?.name,
        userId: keyData?.userId,
        model,
        inputTokens,
        outputTokens,
        cacheCreateTokens,
        cacheReadTokens,
        ephemeral5mTokens,
        ephemeral1hTokens,
        totalTokens,
        cost: costInfo.totalCost || 0,
        costBreakdown: {
          input: costInfo.inputCost || 0,
          output: costInfo.outputCost || 0,
          cacheCreate: costInfo.cacheCreateCost || 0,
          cacheRead: costInfo.cacheReadCost || 0,
          ephemeral5m: costInfo.ephemeral5mCost || 0,
          ephemeral1h: costInfo.ephemeral1hCost || 0
        },
        accountId,
        accountType,
        isLongContext: costInfo.isLongContextRequest || false,
        requestTimestamp: usageRecord.timestamp
      }).catch((err) => {
        // 发布失败不影响主流程，只记录错误
        logger.warn('⚠️ Failed to publish billing event:', err.message)
      })
    } catch (error) {
      logger.error('❌ Failed to record usage:', error)
    }
  }

  async _fetchAccountInfo(accountId, accountType, cache, client) {
    if (!client || !accountId || !accountType) {
      return null
    }

    const cacheKey = `${accountType}:${accountId}`
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)
    }

    const accountConfig = ACCOUNT_TYPE_CONFIG[accountType]
    if (!accountConfig) {
      cache.set(cacheKey, null)
      return null
    }

    const redisKey = `${accountConfig.prefix}${accountId}`
    let accountData = null
    try {
      accountData = await client.hgetall(redisKey)
    } catch (error) {
      logger.debug(`加载账号信息失败 ${redisKey}:`, error)
    }

    if (accountData && Object.keys(accountData).length > 0) {
      const displayName =
        accountData.name ||
        accountData.displayName ||
        accountData.email ||
        accountData.username ||
        accountData.description ||
        accountId

      const info = { id: accountId, name: displayName }
      cache.set(cacheKey, info)
      return info
    }

    cache.set(cacheKey, null)
    return null
  }

  async _resolveAccountByUsageRecord(usageRecord, cache, client) {
    if (!usageRecord || !client) {
      return null
    }

    const rawAccountId = usageRecord.accountId || null
    const rawAccountType = normalizeAccountTypeKey(usageRecord.accountType)
    const modelName = usageRecord.model || usageRecord.actualModel || usageRecord.service || null

    if (!rawAccountId && !rawAccountType) {
      return null
    }

    const candidateIds = new Set()
    if (rawAccountId) {
      candidateIds.add(rawAccountId)
      if (typeof rawAccountId === 'string' && rawAccountId.startsWith('responses:')) {
        candidateIds.add(rawAccountId.replace(/^responses:/, ''))
      }
      if (typeof rawAccountId === 'string' && rawAccountId.startsWith('api:')) {
        candidateIds.add(rawAccountId.replace(/^api:/, ''))
      }
    }

    if (candidateIds.size === 0) {
      return null
    }

    const typeCandidates = []
    const pushType = (type) => {
      const normalized = normalizeAccountTypeKey(type)
      if (normalized && ACCOUNT_TYPE_CONFIG[normalized] && !typeCandidates.includes(normalized)) {
        typeCandidates.push(normalized)
      }
    }

    pushType(rawAccountType)

    if (modelName) {
      const lowerModel = modelName.toLowerCase()
      if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
        pushType('openai')
        pushType('openai-responses')
        pushType('azure-openai')
      } else if (lowerModel.includes('gemini')) {
        pushType('gemini')
        pushType('gemini-api')
      } else if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
        pushType('claude')
        pushType('claude-console')
      } else if (lowerModel.includes('droid')) {
        pushType('droid')
      }
    }

    ACCOUNT_TYPE_PRIORITY.forEach(pushType)

    for (const type of typeCandidates) {
      const accountConfig = ACCOUNT_TYPE_CONFIG[type]
      if (!accountConfig) {
        continue
      }

      for (const candidateId of candidateIds) {
        const normalizedId = sanitizeAccountIdForType(candidateId, type)
        const accountInfo = await this._fetchAccountInfo(normalizedId, type, cache, client)
        if (accountInfo) {
          return {
            accountId: normalizedId,
            accountName: accountInfo.name,
            accountType: type,
            accountCategory: ACCOUNT_CATEGORY_MAP[type] || 'other',
            rawAccountId: rawAccountId || normalizedId
          }
        }
      }
    }

    return null
  }

  async _resolveLastUsageAccount(apiKey, usageRecord, cache, client) {
    return await this._resolveAccountByUsageRecord(usageRecord, cache, client)
  }

  // 🔔 发布计费事件（内部方法）
  async _publishBillingEvent(eventData) {
    try {
      const billingEventPublisher = require('./billingEventPublisher')
      await billingEventPublisher.publishBillingEvent(eventData)
    } catch (error) {
      // 静默失败，不影响主流程
      logger.debug('Failed to publish billing event:', error.message)
    }
  }

  // 🔐 生成密钥
  _generateSecretKey() {
    return crypto.randomBytes(32).toString('hex')
  }

  // 🔒 哈希API Key
  _hashApiKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey + config.security.encryptionKey)
      .digest('hex')
  }

  // 📈 获取使用统计
  async getUsageStats(keyId, options = {}) {
    const usageStats = await redis.getUsageStats(keyId)

    // options 可能是字符串（兼容旧接口），仅当为对象时才解析
    const optionObject =
      options && typeof options === 'object' && !Array.isArray(options) ? options : {}

    if (optionObject.includeRecords === false) {
      return usageStats
    }

    const recordLimit = optionObject.recordLimit || 20
    const recentRecords = await redis.getUsageRecords(keyId, recordLimit)

    return {
      ...usageStats,
      recentRecords
    }
  }

  // 📊 获取账户使用统计
  async getAccountUsageStats(accountId) {
    return await redis.getAccountUsageStats(accountId)
  }

  // 📈 获取所有账户使用统计
  async getAllAccountsUsageStats() {
    return await redis.getAllAccountsUsageStats()
  }

  // === 用户相关方法 ===

  // 🔑 创建API Key（支持用户）
  async createApiKey(options = {}) {
    return await this.generateApiKey(options)
  }

  // 👤 获取用户的API Keys
  async getUserApiKeys(userId, includeDeleted = false) {
    try {
      const allKeys = await redis.getAllApiKeys()
      let userKeys = allKeys.filter((key) => key.userId === userId)

      // 默认过滤掉已删除的API Keys
      if (!includeDeleted) {
        userKeys = userKeys.filter((key) => key.isDeleted !== 'true')
      }

      // Populate usage stats for each user's API key (same as getAllApiKeys does)
      const userKeysWithUsage = []
      for (const key of userKeys) {
        const usage = await redis.getUsageStats(key.id)
        const dailyCost = (await redis.getDailyCost(key.id)) || 0
        const costStats = await redis.getCostStats(key.id)

        userKeysWithUsage.push({
          id: key.id,
          name: key.name,
          description: key.description,
          key: key.apiKey ? `${this.prefix}****${key.apiKey.slice(-4)}` : null, // 只显示前缀和后4位
          tokenLimit: parseInt(key.tokenLimit || 0),
          isActive: key.isActive === 'true',
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          usage,
          dailyCost,
          totalCost: costStats.total,
          dailyCostLimit: parseFloat(key.dailyCostLimit || 0),
          totalCostLimit: parseFloat(key.totalCostLimit || 0),
          userId: key.userId,
          userUsername: key.userUsername,
          createdBy: key.createdBy,
          droidAccountId: key.droidAccountId,
          // Include deletion fields for deleted keys
          isDeleted: key.isDeleted,
          deletedAt: key.deletedAt,
          deletedBy: key.deletedBy,
          deletedByType: key.deletedByType
        })
      }

      return userKeysWithUsage
    } catch (error) {
      logger.error('❌ Failed to get user API keys:', error)
      return []
    }
  }

  // 🔍 通过ID获取API Key（检查权限）
  async getApiKeyById(keyId, userId = null) {
    try {
      // 从 PostgreSQL 获取 API Key
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!keyRecord) {
        return null
      }

      // 如果指定了用户ID，检查权限
      if (userId && keyRecord.userId !== userId) {
        return null
      }

      return {
        id: keyRecord.id,
        name: keyRecord.name,
        description: keyRecord.description,
        key: keyRecord.keyHash, // 注意：这是哈希值，不是原始 key
        tokenLimit: Number(keyRecord.tokenLimit || 0),
        isActive: keyRecord.isActive,
        createdAt: keyRecord.createdAt?.toISOString(),
        lastUsedAt: keyRecord.lastUsedAt?.toISOString(),
        expiresAt: keyRecord.expiresAt?.toISOString(),
        userId: keyRecord.userId,
        userUsername: keyRecord.userUsername,
        createdBy: keyRecord.createdBy,
        permissions: keyRecord.permissions,
        dailyCostLimit: Number(keyRecord.dailyCostLimit || 0),
        totalCostLimit: Number(keyRecord.totalCostLimit || 0),
        claudeAccountId: keyRecord.claudeAccountId,
        claudeConsoleAccountId: keyRecord.claudeConsoleAccountId,
        geminiAccountId: keyRecord.geminiAccountId,
        openaiAccountId: keyRecord.openaiAccountId,
        bedrockAccountId: keyRecord.bedrockAccountId,
        droidAccountId: keyRecord.droidAccountId,
        azureOpenaiAccountId: keyRecord.azureOpenaiAccountId
      }
    } catch (error) {
      logger.error('❌ Failed to get API key by ID:', error)
      return null
    }
  }

  // 🔄 重新生成API Key
  async regenerateApiKey(keyId) {
    try {
      // 从 PostgreSQL 获取现有数据
      const existingKey = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!existingKey) {
        throw new Error('API key not found')
      }

      // 生成新的key
      const newApiKey = `${this.prefix}${this._generateSecretKey()}`
      const newHashedKey = this._hashApiKey(newApiKey)

      // 更新 PostgreSQL 中的 keyHash
      await prisma.apiKey.update({
        where: { id: keyId },
        data: { keyHash: newHashedKey }
      })

      logger.info(`🔄 Regenerated API key: ${existingKey.name} (${keyId})`)

      return {
        id: keyId,
        name: existingKey.name,
        key: newApiKey, // 返回完整的新key
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.error('❌ Failed to regenerate API key:', error)
      throw error
    }
  }

  // 🗑️ 硬删除API Key (完全移除)
  async hardDeleteApiKey(keyId) {
    try {
      // 从 PostgreSQL 获取现有数据
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId }
      })

      if (!keyRecord) {
        throw new Error('API key not found')
      }

      // 从 PostgreSQL 彻底删除
      await prisma.apiKey.delete({
        where: { id: keyId }
      })

      logger.info(`🗑️ Deleted API key: ${keyRecord.name} (${keyId})`)
      return true
    } catch (error) {
      logger.error('❌ Failed to delete API key:', error)
      throw error
    }
  }

  // 🚫 禁用用户的所有API Keys
  async disableUserApiKeys(userId) {
    try {
      const userKeys = await this.getUserApiKeys(userId)
      let disabledCount = 0

      for (const key of userKeys) {
        if (key.isActive) {
          await this.updateApiKey(key.id, { isActive: false })
          disabledCount++
        }
      }

      logger.info(`🚫 Disabled ${disabledCount} API keys for user: ${userId}`)
      return { count: disabledCount }
    } catch (error) {
      logger.error('❌ Failed to disable user API keys:', error)
      throw error
    }
  }

  // 📊 获取聚合使用统计（支持多个API Key）
  async getAggregatedUsageStats(keyIds, options = {}) {
    try {
      if (!Array.isArray(keyIds)) {
        keyIds = [keyIds]
      }

      const { period: _period = 'week', model: _model } = options
      const stats = {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        dailyStats: [],
        modelStats: []
      }

      // 汇总所有API Key的统计数据
      for (const keyId of keyIds) {
        const keyStats = await redis.getUsageStats(keyId)
        const costStats = await redis.getCostStats(keyId)
        if (keyStats && keyStats.total) {
          stats.totalRequests += keyStats.total.requests || 0
          stats.totalInputTokens += keyStats.total.inputTokens || 0
          stats.totalOutputTokens += keyStats.total.outputTokens || 0
          stats.totalCost += costStats?.total || 0
        }
      }

      // TODO: 实现日期范围和模型统计
      // 这里可以根据需要添加更详细的统计逻辑

      return stats
    } catch (error) {
      logger.error('❌ Failed to get usage stats:', error)
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        dailyStats: [],
        modelStats: []
      }
    }
  }

  // 🔓 解绑账号从所有API Keys
  async unbindAccountFromAllKeys(accountId, accountType) {
    try {
      // 账号类型与字段的映射关系
      const fieldMap = {
        claude: 'claudeAccountId',
        'claude-console': 'claudeConsoleAccountId',
        gemini: 'geminiAccountId',
        'gemini-api': 'geminiAccountId', // 特殊处理，带 api: 前缀
        openai: 'openaiAccountId',
        'openai-responses': 'openaiAccountId', // 特殊处理，带 responses: 前缀
        azure_openai: 'azureOpenaiAccountId',
        bedrock: 'bedrockAccountId',
        droid: 'droidAccountId',
        ccr: null // CCR 账号没有对应的 API Key 字段
      }

      const field = fieldMap[accountType]
      if (!field) {
        logger.info(`账号类型 ${accountType} 不需要解绑 API Key`)
        return 0
      }

      // 获取所有API Keys
      const allKeys = await this.getAllApiKeys()

      // 筛选绑定到此账号的 API Keys
      let boundKeys = []
      if (accountType === 'openai-responses') {
        // OpenAI-Responses 特殊处理：查找 openaiAccountId 字段中带 responses: 前缀的
        boundKeys = allKeys.filter((key) => key.openaiAccountId === `responses:${accountId}`)
      } else if (accountType === 'gemini-api') {
        // Gemini-API 特殊处理：查找 geminiAccountId 字段中带 api: 前缀的
        boundKeys = allKeys.filter((key) => key.geminiAccountId === `api:${accountId}`)
      } else {
        // 其他账号类型正常匹配
        boundKeys = allKeys.filter((key) => key[field] === accountId)
      }

      // 批量解绑
      for (const key of boundKeys) {
        const updates = {}
        if (accountType === 'openai-responses') {
          updates.openaiAccountId = null
        } else if (accountType === 'gemini-api') {
          updates.geminiAccountId = null
        } else if (accountType === 'claude-console') {
          updates.claudeConsoleAccountId = null
        } else {
          updates[field] = null
        }

        await this.updateApiKey(key.id, updates)
        logger.info(
          `✅ 自动解绑 API Key ${key.id} (${key.name}) 从 ${accountType} 账号 ${accountId}`
        )
      }

      if (boundKeys.length > 0) {
        logger.success(
          `🔓 成功解绑 ${boundKeys.length} 个 API Key 从 ${accountType} 账号 ${accountId}`
        )
      }

      return boundKeys.length
    } catch (error) {
      logger.error(`❌ 解绑 API Keys 失败 (${accountType} 账号 ${accountId}):`, error)
      return 0
    }
  }

  // 🧹 清理过期的API Keys
  async cleanupExpiredKeys() {
    try {
      const apiKeys = await redis.getAllApiKeys()
      const now = new Date()
      let cleanedCount = 0

      for (const key of apiKeys) {
        // 检查是否已过期且仍处于激活状态
        if (key.expiresAt && new Date(key.expiresAt) < now && key.isActive === 'true') {
          // 将过期的 API Key 标记为禁用状态，而不是直接删除
          await this.updateApiKey(key.id, { isActive: false })
          logger.info(`🔒 API Key ${key.id} (${key.name}) has expired and been disabled`)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        logger.success(`🧹 Disabled ${cleanedCount} expired API keys`)
      }

      return cleanedCount
    } catch (error) {
      logger.error('❌ Failed to cleanup expired keys:', error)
      return 0
    }
  }
}

// 导出实例和单独的方法
const apiKeyService = new ApiKeyService()

// 为了方便其他服务调用，导出 recordUsage 方法
apiKeyService.recordUsageMetrics = apiKeyService.recordUsage.bind(apiKeyService)

module.exports = apiKeyService
