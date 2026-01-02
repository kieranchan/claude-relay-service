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

async function main() {
  const keyId = '013798b7-02f0-4dc4-b97f-c8d1e8fd3508'

  console.log('🔍 检查 API Key "22" 的数据流...\n')

  // 1. 检查 PostgreSQL
  const dbKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: {
      id: true,
      name: true,
      weeklyCostLimit: true,
      dailyCostLimit: true
    }
  })

  console.log('1️⃣ PostgreSQL 数据:')
  console.log('   weeklyCostLimit:', dbKey?.weeklyCostLimit?.toString() || 'null')
  console.log('   dailyCostLimit:', dbKey?.dailyCostLimit?.toString() || 'null')

  // 2. 检查 Redis
  const redisKey = `api_key:${keyId}`
  const redisData = await redis.hgetall(redisKey)

  console.log('\n2️⃣ Redis 缓存数据:')
  if (Object.keys(redisData).length === 0) {
    console.log('   ⚠️  Redis 中没有该 Key 的缓存')
  } else {
    console.log('   weeklyCostLimit:', redisData.weeklyCostLimit || 'undefined')
    console.log('   dailyCostLimit:', redisData.dailyCostLimit || 'undefined')
  }

  // 3. 检查 weeklyCost
  const weeklyCost = await redis.get(`weekly_cost:${keyId}`)
  console.log('\n3️⃣ 当前周费用 (weeklyCost):', weeklyCost || '0')

  console.log('\n📊 诊断结果:')
  if (parseFloat(dbKey?.weeklyCostLimit || 0) > 0) {
    console.log('✅ 数据库中 weeklyCostLimit 正常')

    if (!redisData.weeklyCostLimit || parseFloat(redisData.weeklyCostLimit) === 0) {
      console.log('❌ Redis 缓存中 weeklyCostLimit 缺失或为 0')
      console.log('💡 建议: 重启后端服务以刷新 Redis 缓存')
    } else {
      console.log('✅ Redis 缓存正常')
      console.log('💡 问题可能在前端数据获取或渲染逻辑')
    }
  }
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
