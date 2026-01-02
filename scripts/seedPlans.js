/**
 * Plans Seed Script - Clauddy 风格套餐
 * 运行方式: node scripts/seedPlans.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { planService } = require('../src/services/plans')
const { connectDatabase, disconnectDatabase } = require('../src/models/prisma')

const defaultPlans = [
  // 单日体验
  {
    id: 'daily_trial',
    name: '单日体验',
    description: '零门槛体验，智能编程入门首选，24小时畅享15美元AI算力',
    type: 'one-time',
    price: 19.9,
    originalPrice: 122,
    currency: 'CNY',
    billingCycle: 'lifetime', // 一次性
    validDays: 1, // 有效天数

    // API Key 配置
    dailyCostLimit: 15, // $15 每日费用限制
    weeklyCostLimit: null,
    totalCostLimit: null,
    rateLimitWindow: 300, // 5小时 = 300分钟
    rateLimitRequests: null,
    rateLimitCost: 15, // 5小时内最多 $15
    permissions: 'all', // 全部模型
    exclusiveClaudeAccount: false,
    exclusiveGeminiAccount: false,
    exclusiveOpenaiAccount: false,
    concurrencyLimit: null,

    features: {
      quota: {
        daily_limit_usd: 15,
        validity_days: 1
      },
      models: ['Claude 4.5', 'Codex', 'Gemini 3'],
      support: 'Community',
      rate_limit: {
        per_5_hours_usd: 15
      },
      highlights: ['初次体验与快速验证', '松体验Claude原版能力']
    },
    sortOrder: 1,
    isPopular: false,
    isRecommended: false,
    badgeText: null,
    badgeColor: null,
    trialDays: 0,
    discount: {
      percentage: 84,
      label: '节省 ¥102.1 (84%)'
    },
    status: 'active'
  },
  // 基础版
  {
    id: 'basic_monthly',
    name: '基础版',
    description: '性价比之王·日常开发首选 | 适合复杂度高但开发任务不高频的场景使用',
    type: 'subscription',
    price: 219,
    originalPrice: 1440,
    currency: 'CNY',
    billingCycle: 'monthly',
    validDays: 30,

    // API Key 配置
    dailyCostLimit: null,
    weeklyCostLimit: 90, // $90 每周额度
    totalCostLimit: null,
    rateLimitWindow: 300, // 5小时
    rateLimitRequests: null,
    rateLimitCost: 25, // 每5小时限额 $25
    permissions: 'all',
    exclusiveClaudeAccount: false,
    exclusiveGeminiAccount: false,
    exclusiveOpenaiAccount: false,
    concurrencyLimit: null,

    features: {
      quota: {
        weekly_limit_usd: 90,
        per_5_hours_usd: 25,
        validity_days: 30
      },
      models: ['Claude 4.5', 'Codex', 'Gemini 3'],
      support: 'Standard',
      rate_limit: {
        per_5_hours_usd: 25
      },
      use_cases: ['日常文案/学习', '低频调用'],
      highlights: ['$90 每周额度', '每5小时限额 $25']
    },
    sortOrder: 2,
    isPopular: false,
    isRecommended: false,
    badgeText: null,
    badgeColor: null,
    trialDays: 0,
    discount: {
      percentage: 85,
      label: '节省 ¥1221 (85%)'
    },
    status: 'active'
  },
  // 专业版
  {
    id: 'pro_monthly',
    name: '专业版',
    description:
      '平衡之选 | 每周 $200 算力，每周限额，支持中小团队，Opus 4.5、Sonnet 4.5 与 Gemini 3',
    type: 'subscription',
    price: 439,
    originalPrice: 1440,
    currency: 'CNY',
    billingCycle: 'monthly',
    validDays: 30,

    // API Key 配置
    dailyCostLimit: null,
    weeklyCostLimit: 200, // $200 每周额度
    totalCostLimit: null,
    rateLimitWindow: 300,
    rateLimitRequests: null,
    rateLimitCost: 30, // 每5小时限额 $30
    permissions: 'all',
    exclusiveClaudeAccount: false,
    exclusiveGeminiAccount: false,
    exclusiveOpenaiAccount: false,
    concurrencyLimit: null,

    features: {
      quota: {
        weekly_limit_usd: 200,
        per_5_hours_usd: 30,
        validity_days: 30
      },
      models: ['Claude 4.5', 'Codex', 'Gemini 3'],
      support: 'Priority',
      rate_limit: {
        per_5_hours_usd: 30
      },
      use_cases: ['个人开发者', '技术博主'],
      highlights: ['$200 每周额度', '每5小时限额 $30']
    },
    sortOrder: 3,
    isPopular: true,
    isRecommended: true,
    badgeText: '热门',
    badgeColor: '#6366f1',
    trialDays: 0,
    discount: {
      percentage: 70,
      label: '节省 ¥1001 (70%)'
    },
    status: 'active'
  },
  // 旗舰版
  {
    id: 'flagship_monthly',
    name: '旗舰版',
    description: '高效工作 | 每周 $400 算力，允许承载中型项目日常与高频任务',
    type: 'subscription',
    price: 899,
    originalPrice: 2880,
    currency: 'CNY',
    billingCycle: 'monthly',
    validDays: 30,

    // API Key 配置
    dailyCostLimit: null,
    weeklyCostLimit: 400, // $400 每周额度
    totalCostLimit: null,
    rateLimitWindow: 300,
    rateLimitRequests: null,
    rateLimitCost: 50, // 每5小时限额 $50
    permissions: 'all',
    exclusiveClaudeAccount: false,
    exclusiveGeminiAccount: false,
    exclusiveOpenaiAccount: false,
    concurrencyLimit: null,

    features: {
      quota: {
        weekly_limit_usd: 400,
        per_5_hours_usd: 50,
        validity_days: 30
      },
      models: ['Claude 4.5', 'Codex', 'Gemini 3'],
      support: 'Priority',
      rate_limit: {
        per_5_hours_usd: 50
      },
      use_cases: ['高频稳定响应', '面向专业开发者'],
      highlights: ['$400 每周额度', '每5小时限额 $50']
    },
    sortOrder: 4,
    isPopular: false,
    isRecommended: false,
    badgeText: '最畅销',
    badgeColor: '#f59e0b',
    trialDays: 0,
    discount: {
      percentage: 69,
      label: '节省 ¥1981 (69%)'
    },
    status: 'active'
  },
  // 独享版
  {
    id: 'exclusive_monthly',
    name: '独享版',
    description: '独立专属 | 每周 $800 独享额度，适合大型或多项目并行，企业可叠加',
    type: 'subscription',
    price: 1750,
    originalPrice: 5760,
    currency: 'CNY',
    billingCycle: 'monthly',
    validDays: 30,

    // API Key 配置
    dailyCostLimit: null,
    weeklyCostLimit: 800, // $800 每周独享额度
    totalCostLimit: null,
    rateLimitWindow: 300,
    rateLimitRequests: null,
    rateLimitCost: 100, // 每5小时限额 $100
    permissions: 'all',
    exclusiveClaudeAccount: true, // 专享 Claude MAX 20x 账户
    exclusiveGeminiAccount: false,
    exclusiveOpenaiAccount: false,
    concurrencyLimit: null,

    features: {
      quota: {
        weekly_limit_usd: 800,
        per_5_hours_usd: 100,
        validity_days: 30
      },
      models: ['Claude 4.5', 'Codex', 'Gemini 3'],
      support: 'Dedicated',
      rate_limit: {
        per_5_hours_usd: 100
      },
      use_cases: ['大项目/架构师', '企业级交付'],
      highlights: ['$800 每周独享额度', '每5小时限额 $100', '专享 Claude MAX 20x 账号']
    },
    sortOrder: 5,
    isPopular: false,
    isRecommended: false,
    badgeText: '独享',
    badgeColor: '#22c55e',
    trialDays: 0,
    discount: {
      percentage: 70,
      label: '节省 ¥4010 (70%)'
    },
    status: 'active'
  }
]

async function seedPlans() {
  console.log('🌱 Starting plans seed...\n')

  try {
    console.log('📦 Connecting to database...')
    await connectDatabase()
    console.log('✅ Database connected\n')

    let created = 0
    let skipped = 0
    let errors = 0

    for (const planData of defaultPlans) {
      try {
        const existing = await planService.getPlanById(planData.id)
        if (existing) {
          console.log(`⏭️  Skipped: ${planData.id} (already exists)`)
          skipped++
          continue
        }

        await planService.createPlan(planData, 'seed_script')
        console.log(`✅ Created: ${planData.id} - ${planData.name} (¥${planData.price})`)
        created++
      } catch (error) {
        console.error(`❌ Error creating ${planData.id}:`, error.message)
        errors++
      }
    }

    console.log('\n📊 Seed Summary:')
    console.log(`   Created: ${created}`)
    console.log(`   Skipped: ${skipped}`)
    console.log(`   Errors:  ${errors}`)
    console.log('\n✅ Plans seed completed!')
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  } finally {
    await disconnectDatabase()
  }
}

seedPlans()
