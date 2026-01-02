const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔍 检查 API Key "22" 的激活状态...\n')

  const key = await prisma.apiKey.findFirst({
    where: {
      name: '22',
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      isActivated: true,
      activatedAt: true,
      createdAt: true
    }
  })

  if (!key) {
    console.log('❌ 未找到名为 "22" 的 API Key')
    return
  }

  console.log('✅ 找到 API Key "22"')
  console.log('\n📊 状态信息:')
  console.log('  isActive (启用/禁用):', key.isActive ? '✅ 启用' : '❌ 禁用')
  console.log('  isActivated (已激活):', key.isActivated ? '✅ 已激活' : '⏳ 未激活')
  console.log('  activatedAt (激活时间):', key.activatedAt || '未激活')
  console.log('  createdAt (创建时间):', key.createdAt)

  console.log('\n💡 字段说明:')
  console.log('  - isActive: 控制 API Key 是否启用（可以随时切换）')
  console.log('  - isActivated: 表示 API Key 是否已激活（首次使用后自动激活）')

  console.log('\n🎯 预期行为:')
  if (key.isActive && key.isActivated) {
    console.log('  ✅ 状态正常：已激活且已启用')
    console.log('  📱 前端应显示：')
    console.log('     - 状态列：绿色 "活跃"')
    console.log('     - 操作按钮：橙色 "禁用"（点击后可禁用）')
    console.log('     - 编辑框：复选框勾选 "激活账号"')
  } else if (!key.isActive && key.isActivated) {
    console.log('  ⚠️  已激活但已禁用')
    console.log('  📱 前端应显示：')
    console.log('     - 状态列：红色 "禁用"')
    console.log('     - 操作按钮：绿色 "激活"（点击后可启用）')
    console.log('     - 编辑框：复选框未勾选 "激活账号"')
  } else if (key.isActive && !key.isActivated) {
    console.log('  ⏳ 已启用但未激活（等待首次使用）')
    console.log('  📱 前端应显示：')
    console.log('     - 状态列：绿色 "活跃"')
    console.log('     - 操作按钮：橙色 "禁用"')
    console.log('     - 编辑框：复选框勾选 "激活账号"')
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
