require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkApiKey22() {
  try {
    console.log('🔍 检查 API Key 22 的月限额数据...\n')

    const key = await prisma.apiKey.findUnique({
      where: { id: '22' }
    })

    if (!key) {
      console.log('❌ 未找到 API Key 22')
      return
    }

    console.log('📊 API Key 22 的费用限制：')
    console.log('  dailyCostLimit:', key.dailyCostLimit.toString())
    console.log('  weeklyCostLimit:', key.weeklyCostLimit.toString())
    console.log('  monthlyCostLimit:', key.monthlyCostLimit.toString())
    console.log('  totalCostLimit:', key.totalCostLimit.toString())
    console.log('  weeklyOpusCostLimit:', key.weeklyOpusCostLimit.toString())

    console.log('\n✅ 检查完成')
  } catch (error) {
    console.error('❌ 错误:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkApiKey22()
