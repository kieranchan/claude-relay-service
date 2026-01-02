const { PrismaClient } = require('@prisma/client')
const redis = require('../src/models/redis')

const prisma = new PrismaClient()

async function testListLogic(name, params = {}) {
  console.log(`\n--- Testing: ${name} ---`)
  const { page = 1, pageSize = 10, search = '', isActive = '', excludeDeleted = true } = params

  const where = {}
  if (excludeDeleted) {
    where.isDeleted = false
  }
  if (isActive !== '') {
    where.isActive = isActive === 'true'
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { keyHash: { startsWith: search } },
      { userUsername: { contains: search, mode: 'insensitive' } }
    ]
  }

  try {
    // 1. Count
    const total = await prisma.apiKey.count({ where })
    console.log(`Total Keys Found: ${total}`)

    if (total === 0) {
      return
    }

    // 2. Find
    const dbKeys = await prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        user: { select: { email: true } } // Removed invalid displayName
      }
    })

    // 3. Enrich
    const item = dbKeys[0]
    if (item) {
      const costStats = await redis.getCostStats(item.id)
      const dailyCost = await redis.getDailyCost(item.id)
      console.log(`First Item: ${item.name} (${item.id})`)
      console.log(`- Owner: ${item.userUsername || item.user?.email || 'System'}`)
      console.log(`- Redis Total Cost: ${costStats.total}`)
      console.log(`- Redis Daily Cost: ${dailyCost}`)
    }
  } catch (e) {
    console.error('Query Failed:', e)
  }
}

async function main() {
  try {
    await redis.connect()
    await testListLogic('Default List (All Active)', { excludeDeleted: true })
    await testListLogic('Search "test"', { search: 'test', excludeDeleted: false })
    await testListLogic('Include Deleted', { excludeDeleted: false })
  } finally {
    await redis.disconnect()
    await prisma.$disconnect()
  }
}

main()
