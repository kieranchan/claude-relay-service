#!/usr/bin/env node

/**
 * 套餐种子数据脚本
 * 用于初始化示例套餐数据
 *
 * 使用方法:
 *   node scripts/seed-plans.js
 *   npm run db:seed:plans
 */

require('dotenv').config()
const { getPrismaClient, connectDatabase, disconnectDatabase } = require('../src/models/prisma')

// 示例套餐数据
const samplePlans = [
  {
    id: 'free',
    name: '免费版',
    description: '适合体验和轻度使用，每日有限额度',
    type: 'subscription',
    price: 0,
    currency: 'CNY',
    billingCycle: 'monthly',
    features: {
      quota: {
        daily_requests: 20,
        monthly_tokens: 100000,
        concurrent_requests: 1,
        quota_reset: 'daily'
      },
      services: {
        claude_code: true,
        gemini_cli: false,
        codex: false,
        droid: false
      },
      models: {
        allowed: ['claude-sonnet-4-5'],
        default: 'claude-sonnet-4-5'
      },
      api: {
        enabled: false,
        max_keys: 0
      },
      advanced: {
        priority_queue: false,
        custom_proxy: false,
        team_sharing: false,
        data_export: false
      },
      support: {
        level: 'basic',
        response_time: '72h',
        priority_support: false
      }
    },
    sortOrder: 1,
    isPopular: false,
    isRecommended: false,
    trialDays: 0,
    status: 'active'
  },
  {
    id: 'basic_monthly',
    name: '基础版',
    description: '适合个人轻度使用，提供基础的AI编程辅助功能',
    type: 'subscription',
    price: 49.0,
    currency: 'CNY',
    billingCycle: 'monthly',
    features: {
      quota: {
        daily_requests: 100,
        monthly_tokens: 1000000,
        concurrent_requests: 3,
        quota_reset: 'daily'
      },
      services: {
        claude_code: true,
        gemini_cli: true,
        codex: false,
        droid: false
      },
      models: {
        allowed: ['claude-sonnet-4-5', 'gemini-2.5-pro'],
        default: 'claude-sonnet-4-5'
      },
      api: {
        enabled: false,
        max_keys: 3,
        key_rate_limit: 30
      },
      advanced: {
        priority_queue: false,
        custom_proxy: false,
        team_sharing: false,
        data_export: false
      },
      support: {
        level: 'standard',
        response_time: '24h',
        priority_support: false
      }
    },
    sortOrder: 2,
    isPopular: false,
    isRecommended: false,
    trialDays: 0,
    status: 'active'
  },
  {
    id: 'pro_monthly',
    name: '专业版',
    description: '适合专业开发者，提供更多模型和高级功能',
    type: 'subscription',
    price: 99.0,
    currency: 'CNY',
    billingCycle: 'monthly',
    features: {
      quota: {
        daily_requests: 300,
        monthly_tokens: 5000000,
        concurrent_requests: 5,
        quota_reset: 'daily'
      },
      services: {
        claude_code: true,
        gemini_cli: true,
        codex: true,
        droid: false
      },
      models: {
        allowed: ['claude-opus-4', 'claude-sonnet-4-5', 'gemini-2.5-pro'],
        default: 'claude-opus-4'
      },
      api: {
        enabled: true,
        max_keys: 10,
        key_rate_limit: 60
      },
      advanced: {
        priority_queue: true,
        custom_proxy: false,
        team_sharing: false,
        data_export: true
      },
      support: {
        level: 'premium',
        response_time: '12h',
        priority_support: true
      }
    },
    sortOrder: 3,
    isPopular: true,
    isRecommended: true,
    badgeText: '最超值',
    badgeColor: 'blue',
    trialDays: 3,
    status: 'active'
  },
  {
    id: 'pro_yearly',
    name: '专业版（年付）',
    description: '年付享8折优惠，适合长期使用的专业开发者',
    type: 'subscription',
    price: 950.0,
    originalPrice: 1188.0,
    currency: 'CNY',
    billingCycle: 'yearly',
    features: {
      quota: {
        daily_requests: 300,
        monthly_tokens: 5000000,
        concurrent_requests: 5,
        quota_reset: 'daily'
      },
      services: {
        claude_code: true,
        gemini_cli: true,
        codex: true,
        droid: false
      },
      models: {
        allowed: ['claude-opus-4', 'claude-sonnet-4-5', 'gemini-2.5-pro'],
        default: 'claude-opus-4'
      },
      api: {
        enabled: true,
        max_keys: 10,
        key_rate_limit: 60
      },
      advanced: {
        priority_queue: true,
        custom_proxy: false,
        team_sharing: false,
        data_export: true
      },
      support: {
        level: 'premium',
        response_time: '12h',
        priority_support: true
      }
    },
    sortOrder: 4,
    isPopular: false,
    isRecommended: false,
    badgeText: '省238元',
    badgeColor: 'green',
    discount: {
      enabled: true,
      type: 'percentage',
      value: 20,
      label: '年付8折'
    },
    trialDays: 0,
    status: 'active'
  },
  {
    id: 'ultimate_monthly',
    name: '旗舰版',
    description: '适合团队和企业用户，无限制使用所有功能',
    type: 'subscription',
    price: 199.0,
    currency: 'CNY',
    billingCycle: 'monthly',
    features: {
      quota: {
        daily_requests: 1000,
        monthly_tokens: 20000000,
        concurrent_requests: 10,
        quota_reset: 'daily'
      },
      services: {
        claude_code: true,
        gemini_cli: true,
        codex: true,
        droid: true
      },
      models: {
        allowed: ['claude-opus-4', 'claude-sonnet-4-5', 'gemini-2.5-pro', 'gemini-3-pro'],
        default: 'claude-opus-4'
      },
      api: {
        enabled: true,
        max_keys: 50,
        key_rate_limit: 120
      },
      advanced: {
        priority_queue: true,
        custom_proxy: true,
        team_sharing: true,
        data_export: true
      },
      support: {
        level: 'enterprise',
        response_time: '4h',
        priority_support: true
      }
    },
    sortOrder: 5,
    isPopular: false,
    isRecommended: false,
    badgeText: '企业首选',
    badgeColor: 'gold',
    trialDays: 7,
    status: 'active'
  }
]

async function seed() {
  console.log('🌱 Starting seed...\n')

  try {
    // 连接数据库
    const connected = await connectDatabase()
    if (!connected) {
      console.error('❌ Failed to connect to database')
      process.exit(1)
    }

    const prisma = getPrismaClient()

    // 清理现有数据（可选）
    const existingCount = await prisma.plan.count()
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing plans`)
      console.log('   Skipping seed to avoid duplicate data')
      console.log('   To re-seed, first delete existing plans\n')
      await disconnectDatabase()
      return
    }

    // 插入示例套餐
    console.log('📦 Creating sample plans...\n')

    for (const planData of samplePlans) {
      const plan = await prisma.plan.create({
        data: planData
      })
      console.log(`   ✅ Created: ${plan.name} (${plan.id})`)
    }

    console.log('\n✅ Seed completed successfully!')
    console.log(`   Total plans created: ${samplePlans.length}`)
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message)
    process.exit(1)
  } finally {
    await disconnectDatabase()
  }
}

// 运行种子脚本
seed()
