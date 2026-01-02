require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function simpleCheck() {
  try {
    console.log('🔍 检查数据库中的 monthly_cost_limit...\n')

    // 直接查询数据
    const result = await prisma.$queryRaw`
      SELECT 
        id, 
        name,
        daily_cost_limit,
        weekly_cost_limit,
        monthly_cost_limit,
        total_cost_limit
      FROM api_keys 
      WHERE is_deleted = false
      LIMIT 5
    `

    console.log('📊 当前数据：')
    for (const row of result) {
      console.log(`\nAPI Key: ${row.name}`)
      console.log(`  daily_cost_limit: ${row.daily_cost_limit} (${typeof row.daily_cost_limit})`)
      console.log(`  weekly_cost_limit: ${row.weekly_cost_limit} (${typeof row.weekly_cost_limit})`)
      console.log(
        `  monthly_cost_limit: ${row.monthly_cost_limit} (${typeof row.monthly_cost_limit})`
      )
      console.log(`  total_cost_limit: ${row.total_cost_limit} (${typeof row.total_cost_limit})`)
    }

    console.log('\n🔧 现在让我们直接通过 Prisma 更新数据...')

    // 获取所有 API Keys
    const keys = await prisma.apiKey.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, monthlyCostLimit: true }
    })

    for (const key of keys) {
      if (key.monthlyCostLimit) {
        // 强制转换为数字并重新保存
        const numValue = parseFloat(key.monthlyCostLimit.toString())

        console.log(`\n更新 ${key.name}:`)
        console.log(`  当前值: ${key.monthlyCostLimit} (${typeof key.monthlyCostLimit})`)
        console.log(`  转换为: ${numValue} (${typeof numValue})`)

        // 使用原生 SQL 更新
        await prisma.$executeRaw`
          UPDATE api_keys 
          SET monthly_cost_limit = ${numValue}::numeric(10,2)
          WHERE id = ${key.id}::uuid
        `

        console.log(`  ✅ 已更新`)
      }
    }

    console.log('\n✅ 所有更新完成')
  } catch (error) {
    console.error('❌ 错误:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

simpleCheck()
