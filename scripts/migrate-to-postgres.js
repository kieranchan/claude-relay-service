#!/usr/bin/env node
/**
 * Redis → PostgreSQL 数据迁移脚本
 *
 * 将邮箱用户和 API Keys 从 Redis 迁移到 PostgreSQL
 *
 * 使用方法：
 *   node scripts/migrate-to-postgres.js [--dry-run] [--users-only] [--keys-only]
 *
 * 参数：
 *   --dry-run     仅预览，不实际执行迁移
 *   --users-only  仅迁移用户数据
 *   --keys-only   仅迁移 API Keys 数据
 */

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const redis = require('../src/models/redis')

const prisma = new PrismaClient()

// 解析命令行参数
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const usersOnly = args.includes('--users-only')
const keysOnly = args.includes('--keys-only')

// 统计信息
const stats = {
  users: { total: 0, migrated: 0, skipped: 0, failed: 0 },
  apiKeys: { total: 0, migrated: 0, skipped: 0, failed: 0 }
}

/**
 * 迁移邮箱用户数据
 */
async function migrateUsers() {
  console.log('\n📧 开始迁移邮箱用户数据...')

  const client = redis.getClientSafe()

  // 获取所有用户 keys
  const userKeys = await client.keys('email_user:*')
  stats.users.total = userKeys.length

  console.log(`   发现 ${userKeys.length} 个用户记录`)

  for (const key of userKeys) {
    try {
      const userData = await client.hGetAll(key)
      if (!userData || !userData.email) {
        console.log(`   ⚠️ 跳过无效用户记录: ${key}`)
        stats.users.skipped++
        continue
      }

      // 检查用户是否已存在于 PostgreSQL
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email.toLowerCase() }
      })

      if (existingUser) {
        console.log(`   ⏭️ 跳过已存在的用户: ${userData.email}`)
        stats.users.skipped++
        continue
      }

      if (dryRun) {
        console.log(`   🔍 [DRY-RUN] 将迁移用户: ${userData.email}`)
        stats.users.migrated++
        continue
      }

      // 创建用户
      await prisma.user.create({
        data: {
          id: userData.id,
          email: userData.email.toLowerCase(),
          passwordHash: userData.password_hash,
          emailVerified: userData.email_verified === 'true',
          status: userData.status || 'pending',
          role: userData.role || 'user',
          referralCode: userData.referral_code || null,
          invitedById: userData.invited_by || null,
          loginCount: parseInt(userData.login_count || '0'),
          createdAt: userData.created_at ? new Date(userData.created_at) : new Date(),
          updatedAt: userData.updated_at ? new Date(userData.updated_at) : new Date(),
          lastLoginAt: userData.last_login_at ? new Date(userData.last_login_at) : null
        }
      })

      console.log(`   ✅ 迁移用户成功: ${userData.email}`)
      stats.users.migrated++
    } catch (error) {
      console.error(`   ❌ 迁移用户失败 (${key}):`, error.message)
      stats.users.failed++
    }
  }
}

/**
 * 迁移 API Keys 数据
 */
async function migrateApiKeys() {
  console.log('\n🔑 开始迁移 API Keys 数据...')

  const client = redis.getClientSafe()

  // 获取所有 API Key keys
  const apiKeyKeys = await client.keys('apikey:*')
  stats.apiKeys.total = apiKeyKeys.length

  console.log(`   发现 ${apiKeyKeys.length} 个 API Key 记录`)

  for (const key of apiKeyKeys) {
    try {
      const keyData = await client.hGetAll(key)
      if (!keyData || !keyData.id) {
        console.log(`   ⚠️ 跳过无效 API Key 记录: ${key}`)
        stats.apiKeys.skipped++
        continue
      }

      // 检查 API Key 是否已存在于 PostgreSQL
      const existingKey = await prisma.apiKey.findUnique({
        where: { id: keyData.id }
      })

      if (existingKey) {
        console.log(`   ⏭️ 跳过已存在的 API Key: ${keyData.name || keyData.id}`)
        stats.apiKeys.skipped++
        continue
      }

      if (dryRun) {
        console.log(`   🔍 [DRY-RUN] 将迁移 API Key: ${keyData.name || keyData.id}`)
        stats.apiKeys.migrated++
        continue
      }

      // 解析 JSON 字段
      let restrictedModels = []
      let allowedClients = []
      let tags = []

      try {
        restrictedModels = keyData.restrictedModels ? JSON.parse(keyData.restrictedModels) : []
      } catch (e) {
        restrictedModels = []
      }

      try {
        allowedClients = keyData.allowedClients ? JSON.parse(keyData.allowedClients) : []
      } catch (e) {
        allowedClients = []
      }

      try {
        tags = keyData.tags ? JSON.parse(keyData.tags) : []
      } catch (e) {
        tags = []
      }

      // 创建 API Key
      await prisma.apiKey.create({
        data: {
          id: keyData.id,
          name: keyData.name || 'Unnamed Key',
          description: keyData.description || null,
          keyHash: keyData.apiKey, // 存储的是哈希值
          isActive: keyData.isActive === 'true',
          isDeleted: keyData.isDeleted === 'true',
          deletedAt: keyData.deletedAt ? new Date(keyData.deletedAt) : null,
          deletedBy: keyData.deletedBy || null,
          deletedByType: keyData.deletedByType || null,
          tokenLimit: BigInt(keyData.tokenLimit || 0),
          concurrencyLimit: parseInt(keyData.concurrencyLimit || '0'),
          rateLimitWindow: parseInt(keyData.rateLimitWindow || '0'),
          rateLimitRequests: parseInt(keyData.rateLimitRequests || '0'),
          rateLimitCost: parseFloat(keyData.rateLimitCost || '0'),
          dailyCostLimit: parseFloat(keyData.dailyCostLimit || '0'),
          totalCostLimit: parseFloat(keyData.totalCostLimit || '0'),
          weeklyOpusCostLimit: parseFloat(keyData.weeklyOpusCostLimit || '0'),
          permissions: keyData.permissions || 'all',
          claudeAccountId: keyData.claudeAccountId || null,
          claudeConsoleAccountId: keyData.claudeConsoleAccountId || null,
          geminiAccountId: keyData.geminiAccountId || null,
          openaiAccountId: keyData.openaiAccountId || null,
          azureOpenaiAccountId: keyData.azureOpenaiAccountId || null,
          bedrockAccountId: keyData.bedrockAccountId || null,
          droidAccountId: keyData.droidAccountId || null,
          enableModelRestriction: keyData.enableModelRestriction === 'true',
          restrictedModels,
          enableClientRestriction: keyData.enableClientRestriction === 'true',
          allowedClients,
          tags,
          expirationMode: keyData.expirationMode || 'fixed',
          expiresAt: keyData.expiresAt ? new Date(keyData.expiresAt) : null,
          activationDays: parseInt(keyData.activationDays || '0'),
          activationUnit: keyData.activationUnit || 'days',
          isActivated: keyData.isActivated === 'true',
          activatedAt: keyData.activatedAt ? new Date(keyData.activatedAt) : null,
          icon: keyData.icon || null,
          createdBy: keyData.createdBy || 'admin',
          userId: keyData.userId || null,
          userUsername: keyData.userUsername || null,
          createdAt: keyData.createdAt ? new Date(keyData.createdAt) : new Date(),
          lastUsedAt: keyData.lastUsedAt ? new Date(keyData.lastUsedAt) : null
        }
      })

      console.log(`   ✅ 迁移 API Key 成功: ${keyData.name || keyData.id}`)
      stats.apiKeys.migrated++
    } catch (error) {
      console.error(`   ❌ 迁移 API Key 失败 (${key}):`, error.message)
      stats.apiKeys.failed++
    }
  }
}

/**
 * 打印迁移统计
 */
function printStats() {
  console.log(`\n${'='.repeat(50)}`)
  console.log('📊 迁移统计')
  console.log('='.repeat(50))

  if (!keysOnly) {
    console.log('\n📧 邮箱用户:')
    console.log(`   总数: ${stats.users.total}`)
    console.log(`   成功: ${stats.users.migrated}`)
    console.log(`   跳过: ${stats.users.skipped}`)
    console.log(`   失败: ${stats.users.failed}`)
  }

  if (!usersOnly) {
    console.log('\n🔑 API Keys:')
    console.log(`   总数: ${stats.apiKeys.total}`)
    console.log(`   成功: ${stats.apiKeys.migrated}`)
    console.log(`   跳过: ${stats.apiKeys.skipped}`)
    console.log(`   失败: ${stats.apiKeys.failed}`)
  }

  console.log(`\n${'='.repeat(50)}`)

  if (dryRun) {
    console.log('⚠️ 这是 DRY-RUN 模式，没有实际执行迁移')
    console.log('   移除 --dry-run 参数以执行实际迁移')
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(50))
  console.log('🚀 Redis → PostgreSQL 数据迁移工具')
  console.log('='.repeat(50))

  if (dryRun) {
    console.log('\n⚠️ DRY-RUN 模式：仅预览，不实际执行迁移')
  }

  try {
    // 等待 Redis 连接
    console.log('\n⏳ 等待 Redis 连接...')
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 测试数据库连接
    console.log('⏳ 测试 PostgreSQL 连接...')
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 执行迁移
    if (!keysOnly) {
      await migrateUsers()
    }

    if (!usersOnly) {
      await migrateApiKeys()
    }

    // 打印统计
    printStats()

    console.log('\n✅ 迁移完成!')
  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    process.exit(0)
  }
}

// 运行
main()
