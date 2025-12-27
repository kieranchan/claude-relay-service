#!/usr/bin/env node

/**
 * 套餐管理 API 测试脚本
 * 用于测试套餐 API 的基本功能
 *
 * 使用方法:
 *   node scripts/test-plans-api.js [baseUrl] [adminToken]
 *
 * 示例:
 *   node scripts/test-plans-api.js http://localhost:3000 your-admin-token
 */

const https = require('https')
const http = require('http')

// 配置
const BASE_URL = process.argv[2] || 'http://localhost:3000'
const ADMIN_TOKEN = process.argv[3] || ''

// 测试用套餐数据
const testPlan = {
  id: `test_plan_${Date.now()}`,
  name: '测试套餐',
  description: '这是一个用于测试的套餐',
  type: 'subscription',
  price: 99.0,
  currency: 'CNY',
  billing_cycle: 'monthly',
  features: {
    quota: {
      daily_requests: 100,
      monthly_tokens: 1000000,
      concurrent_requests: 3
    },
    services: {
      claude_code: true,
      gemini_cli: true,
      codex: false
    },
    models: {
      allowed: ['claude-sonnet-4-5'],
      default: 'claude-sonnet-4-5'
    },
    api: {
      enabled: false,
      max_keys: 3
    }
  },
  sort_order: 999,
  trial_days: 3
}

// 辅助函数：发送 HTTP 请求
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (ADMIN_TOKEN) {
      options.headers['Authorization'] = `Bearer ${ADMIN_TOKEN}`
    }

    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({ status: res.statusCode, data: json })
        } catch {
          resolve({ status: res.statusCode, data })
        }
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

// 测试用例
async function runTests() {
  console.log('========================================')
  console.log('🧪 套餐管理 API 测试')
  console.log('========================================')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Admin Token: ${ADMIN_TOKEN ? '已配置' : '未配置'}`)
  console.log('')

  let passed = 0
  let failed = 0
  let createdPlanId = null

  // 测试 1: 获取套餐列表（公开接口）
  console.log('📋 测试 1: 获取套餐列表')
  try {
    const res = await request('GET', '/api/v1/plans')
    if (res.status === 200 && res.data.success) {
      console.log(`   ✅ 通过 - 返回 ${res.data.data.length} 个套餐`)
      passed++
    } else {
      console.log(`   ❌ 失败 - 状态码: ${res.status}`)
      failed++
    }
  } catch (error) {
    console.log(`   ❌ 失败 - ${error.message}`)
    failed++
  }

  // 测试 2: 获取套餐列表（带筛选）
  console.log('\n📋 测试 2: 获取套餐列表（月付）')
  try {
    const res = await request('GET', '/api/v1/plans?billing_cycle=monthly')
    if (res.status === 200 && res.data.success) {
      console.log(`   ✅ 通过 - 返回 ${res.data.data.length} 个月付套餐`)
      passed++
    } else {
      console.log(`   ❌ 失败 - 状态码: ${res.status}`)
      failed++
    }
  } catch (error) {
    console.log(`   ❌ 失败 - ${error.message}`)
    failed++
  }

  // 以下测试需要管理员 Token
  if (!ADMIN_TOKEN) {
    console.log('\n⚠️  未提供管理员 Token，跳过管理员接口测试')
    console.log('   请运行: node scripts/test-plans-api.js <url> <admin-token>')
  } else {
    // 测试 3: 创建套餐
    console.log('\n📋 测试 3: 创建套餐')
    try {
      const res = await request('POST', '/api/v1/plans/admin', testPlan)
      if (res.status === 201 && res.data.success) {
        createdPlanId = res.data.data.id
        console.log(`   ✅ 通过 - 创建套餐: ${createdPlanId}`)
        passed++
      } else {
        console.log(`   ❌ 失败 - ${res.data.error?.message || res.status}`)
        failed++
      }
    } catch (error) {
      console.log(`   ❌ 失败 - ${error.message}`)
      failed++
    }

    // 测试 4: 获取套餐详情
    if (createdPlanId) {
      console.log('\n📋 测试 4: 获取套餐详情')
      try {
        const res = await request('GET', `/api/v1/plans/${createdPlanId}`)
        if (res.status === 200 && res.data.success) {
          console.log(`   ✅ 通过 - 套餐名称: ${res.data.data.name}`)
          passed++
        } else {
          console.log(`   ❌ 失败 - ${res.data.error?.message || res.status}`)
          failed++
        }
      } catch (error) {
        console.log(`   ❌ 失败 - ${error.message}`)
        failed++
      }

      // 测试 5: 更新套餐
      console.log('\n📋 测试 5: 更新套餐')
      try {
        const res = await request('PUT', `/api/v1/plans/admin/${createdPlanId}`, {
          price: 79.0,
          description: '更新后的描述'
        })
        if (res.status === 200 && res.data.success) {
          console.log(`   ✅ 通过 - 新价格: ${res.data.data.price}`)
          passed++
        } else {
          console.log(`   ❌ 失败 - ${res.data.error?.message || res.status}`)
          failed++
        }
      } catch (error) {
        console.log(`   ❌ 失败 - ${error.message}`)
        failed++
      }

      // 测试 6: 下架套餐
      console.log('\n📋 测试 6: 下架套餐')
      try {
        const res = await request('POST', `/api/v1/plans/admin/${createdPlanId}/toggle`, {
          status: 'inactive'
        })
        if (res.status === 200 && res.data.success) {
          console.log(`   ✅ 通过 - 状态: ${res.data.data.status}`)
          passed++
        } else {
          console.log(`   ❌ 失败 - ${res.data.error?.message || res.status}`)
          failed++
        }
      } catch (error) {
        console.log(`   ❌ 失败 - ${error.message}`)
        failed++
      }

      // 测试 7: 删除套餐
      console.log('\n📋 测试 7: 删除套餐')
      try {
        const res = await request('DELETE', `/api/v1/plans/admin/${createdPlanId}`)
        if (res.status === 200 && res.data.success) {
          console.log(`   ✅ 通过 - 套餐已删除`)
          passed++
        } else {
          console.log(`   ❌ 失败 - ${res.data.error?.message || res.status}`)
          failed++
        }
      } catch (error) {
        console.log(`   ❌ 失败 - ${error.message}`)
        failed++
      }
    }
  }

  // 输出结果
  console.log('\n========================================')
  console.log('📊 测试结果')
  console.log('========================================')
  console.log(`   ✅ 通过: ${passed}`)
  console.log(`   ❌ 失败: ${failed}`)
  console.log(`   📋 总计: ${passed + failed}`)
  console.log('')

  if (failed > 0) {
    process.exit(1)
  }
}

// 运行测试
runTests().catch((error) => {
  console.error('测试执行失败:', error)
  process.exit(1)
})
