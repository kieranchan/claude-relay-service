const { PrismaClient } = require('@prisma/client')
const redis = require('../src/models/redis')
// Mock config for redis connection if needed, but redis model should handle it via ../config/config
// We might need to adjust paths if running from root

const prisma = new PrismaClient()

async function main() {
  console.log('--- Checking Postgres (Last 5 Keys) ---')
  const dbKeys = await prisma.apiKey.findMany({
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: true
    }
  })

  console.log(
    JSON.stringify(
      dbKeys,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    )
  )

  console.log('\n--- Checking Redis (Scanning all keys) ---')
  try {
    await redis.connect()
    const allRedisKeys = await redis.getApiKeysPaginated({
      page: 1,
      pageSize: 5,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      excludeDeleted: false
    })
    console.log(JSON.stringify(allRedisKeys.items, null, 2))
  } catch (e) {
    console.error('Redis Error:', e)
  } finally {
    await redis.disconnect()
    await prisma.$disconnect()
  }
}

main()
