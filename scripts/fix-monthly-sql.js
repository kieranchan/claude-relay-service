require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkAndFixWithRawSQL() {
  try {
    console.log('🔍 使用原生 SQL 检查数据库...\n')

    // 1. 查看当前数据
    const result = await prisma.$queryRaw`
      SELECT 
        id, 
        name,
        daily_cost_limit,
        weekly_cost_limit,
        monthly_cost_limit,
        total_cost_limit,
        pg_typeof(daily_cost_limit) as daily_type,
        pg_typeof(weekly_cost_limit) as weekly_type,
        pg_typeof(monthly_cost_limit) as monthly_type,
        pg_typeof(total_cost_limit) as total_type
      FROM api_keys 
      WHERE is_deleted = false
      LIMIT 5
    `

    console.log('📊 数据库中的数据类型：')
    for (const row of result) {
      console.log(`\nAPI Key: ${row.name} (${row.id})`)
      console.log(`  daily_cost_limit: ${row.daily_cost_limit} (${row.daily_type})`)
      console.log(`  weekly_cost_limit: ${row.weekly_cost_limit} (${row.weekly_type})`)
      console.log(`  monthly_cost_limit: ${row.monthly_cost_limit} (${row.monthly_type})`)
      console.log(`  total_cost_limit: ${row.total_cost_limit} (${row.total_type})`)
    }

    // 2. 如果 monthly_cost_limit 的类型不对，修复它
    console.log('\n🔧 尝试修复 monthly_cost_limit...')

    await prisma.$executeRaw`
      UPDATE api_keys 
      SET monthly_cost_limit = CAST(monthly_cost_limit AS NUMERIC(10,2))
      WHERE is_deleted = false
    `

    console.log('✅ 已执行更新')

    // 3. 再次检查
    const resultAfter = await prisma.$queryRaw`
      SELECT 
        id, 
        name,
        monthly_cost_limit,
        pg_typeof(monthly_cost_limit) as monthly_type
      FROM api_keys 
      WHERE is_deleted = false
      LIMIT 5
    `

    console.log('\n📊 更新后的数据：')
    for (const row of resultAfter) {
      console.log(`  ${row.name}: ${row.monthly_cost_limit} (${row.monthly_type})`)
    }
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAndFixWithRawSQL()
