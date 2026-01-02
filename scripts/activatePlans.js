/**
 * 激活所有新套餐
 * 运行方式: node scripts/activatePlans.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { getPrismaClient, connectDatabase, disconnectDatabase } = require('../src/models/prisma')

const planIds = [
  'daily_trial',
  'basic_monthly',
  'pro_monthly',
  'flagship_monthly',
  'exclusive_monthly'
]

async function activatePlans() {
  console.log('🔄 Activating plans...\n')

  try {
    await connectDatabase()
    const prisma = getPrismaClient()

    const result = await prisma.plan.updateMany({
      where: { id: { in: planIds } },
      data: { status: 'active' }
    })

    console.log(`✅ Activated ${result.count} plans`)
    console.log('\n✅ Done!')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await disconnectDatabase()
  }
}

activatePlans()
