require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixMonthlyCostLimitType() {
  try {
    console.log('🔍 检查所有 API Keys 的 monthlyCostLimit 数据类型...\n')

    // 获取所有有 monthlyCostLimit 的 API Keys
    const keys = await prisma.apiKey.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        name: true,
        monthlyCostLimit: true,
        dailyCostLimit: true,
        weeklyCostLimit: true
      }
    })

    console.log(`找到 ${keys.length} 个 API Keys\n`)

    for (const key of keys) {
      console.log(`📊 API Key: ${key.name} (${key.id})`)
      console.log(`  monthlyCostLimit 类型: ${typeof key.monthlyCostLimit}`)
      console.log(`  monthlyCostLimit 值: ${key.monthlyCostLimit}`)
      console.log(`  dailyCostLimit 类型: ${typeof key.dailyCostLimit}`)
      console.log(`  weeklyCostLimit 类型: ${typeof key.weeklyCostLimit}`)

      // 检查是否需要修复
      if (key.monthlyCostLimit && key.monthlyCostLimit.toString() !== '0') {
        const currentValue = key.monthlyCostLimit
        const numericValue = Number(currentValue)

        console.log(`  → 当前值: ${currentValue} (${typeof currentValue})`)
        console.log(`  → 转换后: ${numericValue} (${typeof numericValue})`)

        // 更新为确保是数字类型
        await prisma.apiKey.update({
          where: { id: key.id },
          data: {
            monthlyCostLimit: numericValue
          }
        })

        console.log(`  ✅ 已更新为数字类型`)
      }
      console.log('')
    }

    console.log('✅ 检查和修复完成')
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

fixMonthlyCostLimitType()
