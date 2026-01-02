/**
 * 创建管理员账号
 * 运行方式: node scripts/seedAdmin.js
 *
 * 环境变量:
 *   ADMIN_EMAIL - 管理员邮箱
 *   ADMIN_PASSWORD - 管理员密码
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const bcrypt = require('bcryptjs')
const { getPrismaClient, connectDatabase, disconnectDatabase } = require('../src/models/prisma')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456'

async function seedAdmin() {
  console.log('🔐 Creating admin account...\n')

  try {
    await connectDatabase()
    const prisma = getPrismaClient()

    // 检查管理员是否已存在
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    })

    if (existing) {
      console.log(`⚠️  Admin account already exists: ${ADMIN_EMAIL}`)
      console.log(`   Role: ${existing.role}`)
      console.log(`   Status: ${existing.status}`)
      return
    }

    // 创建密码哈希
    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt)

    // 创建管理员账号
    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        emailVerified: true,
        status: 'active',
        role: 'super_admin',
        source: 'manual'
      }
    })

    console.log('✅ Admin account created successfully!')
    console.log(`   Email: ${admin.email}`)
    console.log(`   Role: ${admin.role}`)
    console.log(`   ID: ${admin.id}`)
    console.log('\n⚠️  Please change the password after first login!')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await disconnectDatabase()
  }
}

seedAdmin()
