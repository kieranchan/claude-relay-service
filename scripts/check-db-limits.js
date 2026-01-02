const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Checking latest API Keys for weeklyCostLimit...')

  const keys = await prisma.apiKey.findMany({
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      name: true,
      dailyCostLimit: true,
      weeklyCostLimit: true,
      totalCostLimit: true,
      weeklyOpusCostLimit: true
    }
  })

  console.log('Found keys:', keys)

  keys.forEach((key) => {
    console.log(`Key: ${key.name} (${key.id})`)
    console.log(`  Daily: ${key.dailyCostLimit}`)
    console.log(`  Weekly: ${key.weeklyCostLimit}`)
    console.log(`  Opus Weekly: ${key.weeklyOpusCostLimit}`)
    console.log(`  Total: ${key.totalCostLimit}`)
    console.log('---')
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
