/**
 * 更新 Pro 套餐的 support 字段
 * 运行方式: node scripts/updateProSupport.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { getPrismaClient, connectDatabase, disconnectDatabase } = require('../src/models/prisma')

async function updateProSupport() {
  console.log('🔄 Updating Pro plans support level...\n')

  try {
    await connectDatabase()
    const prisma = getPrismaClient()

    // Update pro_monthly
    const proMonthly = await prisma.plan.findUnique({ where: { id: 'pro_monthly' } })
    if (proMonthly) {
      const features = { ...proMonthly.features, support: 'Standard' }
      await prisma.plan.update({
        where: { id: 'pro_monthly' },
        data: { features }
      })
      console.log('✅ Updated: pro_monthly')
    }

    // Update pro_yearly
    const proYearly = await prisma.plan.findUnique({ where: { id: 'pro_yearly' } })
    if (proYearly) {
      const features = { ...proYearly.features, support: 'Standard' }
      await prisma.plan.update({
        where: { id: 'pro_yearly' },
        data: { features }
      })
      console.log('✅ Updated: pro_yearly')
    }

    console.log('\n✅ Done!')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await disconnectDatabase()
  }
}

updateProSupport()
