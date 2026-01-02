/**
 * 将所有旧套餐设为非活跃，不删除（避免外键约束）
 * 运行方式: node scripts/clearPlans.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { getPrismaClient, connectDatabase, disconnectDatabase } = require('../src/models/prisma')

async function clearPlans() {
  console.log('🔄 Deactivating old plans...\n')

  try {
    await connectDatabase()
    const prisma = getPrismaClient()

    // 将所有现有套餐设为非活跃状态（而非删除，避免外键约束）
    const result = await prisma.plan.updateMany({
      where: { status: 'active' },
      data: { status: 'inactive' }
    })
    console.log(`✅ Deactivated ${result.count} plans`)

    console.log('\n✅ Done! Now run: node scripts/seedPlans.js')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await disconnectDatabase()
  }
}

clearPlans()
