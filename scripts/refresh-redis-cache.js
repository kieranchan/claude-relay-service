const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('@prisma/client')
const Redis = require('ioredis')

const prisma = new PrismaClient()
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0
})

async function refreshApiKeyCache(keyId) {
  console.log(`🔄 刷新 API Key ${keyId} 的 Redis 缓存...\n`)

  // 从数据库获取完整数据
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { id: keyId }
  })

  if (!apiKeyRecord) {
    console.log('❌ API Key 不存在')
    return
  }

  // 准备 Redis 数据
  const redisKeyData = {
    id: apiKeyRecord.id,
    name: apiKeyRecord.name,
    description: apiKeyRecord.description || '',
    keyHash: apiKeyRecord.keyHash,
    tokenLimit: apiKeyRecord.tokenLimit.toString(),
    concurrencyLimit: apiKeyRecord.concurrencyLimit.toString(),
    rateLimitWindow: apiKeyRecord.rateLimitWindow.toString(),
    rateLimitRequests: apiKeyRecord.rateLimitRequests.toString(),
    rateLimitCost: apiKeyRecord.rateLimitCost.toString(),
    dailyCostLimit: apiKeyRecord.dailyCostLimit.toString(),
    weeklyCostLimit: apiKeyRecord.weeklyCostLimit.toString(),
    totalCostLimit: apiKeyRecord.totalCostLimit.toString(),
    weeklyOpusCostLimit: apiKeyRecord.weeklyOpusCostLimit.toString(),
    permissions: apiKeyRecord.permissions,
    expiresAt: apiKeyRecord.expiresAt ? apiKeyRecord.expiresAt.toISOString() : '',
    createdAt: apiKeyRecord.createdAt.toISOString(),
    updatedAt: apiKeyRecord.updatedAt.toISOString(),
    isActivated: apiKeyRecord.isActivated ? 'true' : 'false',
    activatedAt: apiKeyRecord.activatedAt ? apiKeyRecord.activatedAt.toISOString() : '',
    isActive: apiKeyRecord.isActive ? 'true' : 'false',
    isDeleted: apiKeyRecord.isDeleted ? 'true' : 'false',
    enableModelRestriction: apiKeyRecord.enableModelRestriction ? 'true' : 'false',
    enableClientRestriction: apiKeyRecord.enableClientRestriction ? 'true' : 'false',
    restrictedModels: JSON.stringify(apiKeyRecord.restrictedModels || []),
    allowedClients: JSON.stringify(apiKeyRecord.allowedClients || []),
    tags: JSON.stringify(apiKeyRecord.tags || []),
    expirationMode: apiKeyRecord.expirationMode,
    activationDays: apiKeyRecord.activationDays.toString(),
    activationUnit: apiKeyRecord.activationUnit,
    createdBy: apiKeyRecord.createdBy,
    claudeAccountId: apiKeyRecord.claudeAccountId || '',
    claudeConsoleAccountId: apiKeyRecord.claudeConsoleAccountId || '',
    geminiAccountId: apiKeyRecord.geminiAccountId || '',
    openaiAccountId: apiKeyRecord.openaiAccountId || '',
    azureOpenaiAccountId: apiKeyRecord.azureOpenaiAccountId || '',
    bedrockAccountId: apiKeyRecord.bedrockAccountId || '',
    droidAccountId: apiKeyRecord.droidAccountId || '',
    userId: apiKeyRecord.userId || '',
    userUsername: apiKeyRecord.userUsername || '',
    icon: apiKeyRecord.icon || ''
  }

  // 移除空值
  Object.keys(redisKeyData).forEach((key) => {
    if (redisKeyData[key] === null || redisKeyData[key] === undefined || redisKeyData[key] === '') {
      delete redisKeyData[key]
    }
  })

  // 写入 Redis
  const redisKey = `api_key:${keyId}`
  await redis.del(redisKey)
  await redis.hset(redisKey, redisKeyData)

  // 建立哈希映射
  const hashMapKey = `api_key_hash:${apiKeyRecord.keyHash}`
  await redis.set(hashMapKey, keyId)

  console.log('✅ Redis 缓存已刷新')
  console.log('\n📊 刷新后的数据:')
  console.log('   weeklyCostLimit:', redisKeyData.weeklyCostLimit)
  console.log('   dailyCostLimit:', redisKeyData.dailyCostLimit)

  // 验证
  const verify = await redis.hgetall(redisKey)
  console.log('\n🔍 验证读取:')
  console.log('   weeklyCostLimit:', verify.weeklyCostLimit)
  console.log('   dailyCostLimit:', verify.dailyCostLimit)
}

async function main() {
  const keyId = '013798b7-02f0-4dc4-b97f-c8d1e8fd3508'
  await refreshApiKeyCache(keyId)
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await redis.quit()
  })
