const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('查询名为 "22" 的 API Key...\n')

  const key = await prisma.apiKey.findFirst({
    where: {
      name: '22',
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      dailyCostLimit: true,
      weeklyCostLimit: true,
      totalCostLimit: true,
      weeklyOpusCostLimit: true,
      isActive: true,
      createdAt: true
    }
  })

  if (!key) {
    console.log('❌ 未找到名为 "22" 的 API Key')
    return
  }

  console.log('✅ 找到 API Key:')
  console.log('ID:', key.id)
  console.log('名称:', key.name)
  console.log('状态:', key.isActive ? '激活' : '禁用')
  console.log('创建时间:', key.createdAt)
  console.log('\n💰 费用限制:')
  console.log('  每日限制 (dailyCostLimit):', key.dailyCostLimit.toString())
  console.log('  每周限制 (weeklyCostLimit):', key.weeklyCostLimit.toString())
  console.log('  Opus周限制 (weeklyOpusCostLimit):', key.weeklyOpusCostLimit.toString())
  console.log('  总限制 (totalCostLimit):', key.totalCostLimit.toString())

  if (parseFloat(key.weeklyCostLimit) === 0) {
    console.log('\n⚠️  警告: weeklyCostLimit 为 0，前端会隐藏该限制显示！')
  }
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
