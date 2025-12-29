/**
 * 订阅管理系统 API 测试脚本
 *
 * 前置条件:
 * 1. 启动 PostgreSQL 数据库: prisma dev
 * 2. 运行 npx prisma db push
 * 3. 启动服务 npm run dev
 * 4. 运行此脚本: node scripts/test-subscriptions-api.js
 *
 * 测试流程:
 * 1. 健康检查
 * 2. 用户注册/登录
 * 3. 确保套餐存在
 * 4. 创建订单并支付
 * 5. 测试订阅 API
 */

const http = require('http')

const BASE_URL = 'http://localhost:3000'
let authToken = null
let _testUserId = null
let testOrderId = null
let testSubscriptionId = null
let testPlanId = 'pro_monthly' // 测试用套餐ID

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

/**
 * HTTP 请求工具
 */
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`
    }

    const req = http.request(options, (res) => {
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

/**
 * 测试用例执行器
 */
async function runTest(name, fn) {
  try {
    await fn()
    results.passed++
    results.tests.push({ name, status: 'passed' })
    console.log(`  ✅ ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'failed', error: error.message })
    console.log(`  ❌ ${name}: ${error.message}`)
  }
}

/**
 * 断言工具
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

// ========================================
// 测试用例
// ========================================

async function testHealthCheck() {
  const res = await request('GET', '/health')
  assert(res.status === 200, `期望状态码 200，实际 ${res.status}`)
  assert(res.data.status === 'healthy', '服务不健康')
}

// 保存测试用户信息用于登录
let testUserEmail = null
let testUserPassword = null

async function testUserRegistration() {
  const timestamp = Date.now()
  testUserEmail = `sub_test_${timestamp}@test.com`
  testUserPassword = 'Test123456!'

  const res = await request('POST', '/api/v1/auth/register', {
    email: testUserEmail,
    password: testUserPassword,
    confirmPassword: testUserPassword
  })

  // 可能返回 201 (新用户) 或其他状态
  if (res.status === 201 && res.data.success) {
    _testUserId = res.data.data?.userId
  }

  assert(res.status === 201 || res.status === 200, `注册失败: ${JSON.stringify(res.data)}`)
}

async function testUserLogin() {
  // 使用刚注册的账号登录
  const email = testUserEmail || 'test@test.com'
  const password = testUserPassword || 'Test123456!'

  const res = await request('POST', '/api/v1/auth/login', {
    email,
    password
  })

  if (res.status === 200 && res.data.success) {
    authToken = res.data.data?.accessToken
    _testUserId = res.data.data?.user?.id
  }

  assert(authToken, `无法获取认证 token: ${JSON.stringify(res.data)}`)
}

async function testEnsurePlanExists() {
  // 使用管理员接口创建测试套餐
  // 假设测试用户是管理员，使用 authToken 进行认证

  // 先检查套餐是否存在
  const checkRes = await request('GET', `/api/v1/plans/${testPlanId}`)

  if (checkRes.status === 200 && checkRes.data.success) {
    console.log(`    套餐已存在: ${testPlanId}`)
    return
  }

  // 创建测试套餐
  const createRes = await request('POST', '/api/v1/plans/admin', {
    id: testPlanId,
    name: '专业版',
    description: '测试用专业版套餐',
    type: 'subscription',
    price: 99.0,
    billingCycle: 'monthly',
    features: {
      quota: { dailyRequests: 300, monthlyTokens: 5000000 },
      services: { claudeCode: true, geminiCli: true }
    },
    status: 'active'
  })

  // 如果创建失败（可能需要管理员权限），尝试运行 seed 脚本
  if (createRes.status !== 201) {
    console.log('    套餐创建需要管理员权限，请确保已运行 npm run seed:plans')
  }
}

async function testCreateOrderAndPay() {
  // 先检查套餐是否存在
  const plansRes = await request('GET', '/api/v1/plans')
  if (!plansRes.data.data || plansRes.data.data.length === 0) {
    console.log('    没有可用的套餐，请先运行 npm run seed:plans')
    throw new Error('没有可用的套餐')
  }

  // 优先使用 pro_monthly 或其他付费套餐
  const paidPlan = plansRes.data.data.find((p) => p.id === 'pro_monthly' || p.price > 0)
  testPlanId = paidPlan ? paidPlan.id : plansRes.data.data[0].id
  console.log(`    使用套餐: ${testPlanId}`)

  // 创建订单（注意路由是 /create）
  const orderRes = await request('POST', '/api/v1/orders/create', {
    plan_id: testPlanId,
    payment_method: 'alipay'
  })

  if (orderRes.status !== 201) {
    console.log(`    订单创建失败: ${JSON.stringify(orderRes.data)}`)
    throw new Error(`订单创建失败: ${orderRes.data?.error?.message || '未知错误'}`)
  }

  testOrderId = orderRes.data.data?.orderId
  assert(testOrderId, '订单ID为空')
  console.log(`    订单ID: ${testOrderId}`)

  // 模拟支付成功
  const payRes = await request('POST', `/api/v1/orders/${testOrderId}/simulate-pay`)
  assert(payRes.status === 200, `支付模拟失败: ${JSON.stringify(payRes.data)}`)
  console.log('    支付模拟成功')
}

async function testGetCurrentSubscription() {
  const res = await request('GET', '/api/v1/subscriptions/current')

  assert(res.status === 200, `获取当前订阅失败: ${res.status}`)
  assert(res.data.success, `响应不成功: ${JSON.stringify(res.data)}`)

  if (res.data.data) {
    testSubscriptionId = res.data.data.subscriptionId
    console.log(`    订阅ID: ${testSubscriptionId}`)
    console.log(`    套餐: ${res.data.data.plan?.name}`)
    console.log(`    状态: ${res.data.data.status}`)
    console.log(`    到期日: ${res.data.data.expireDate}`)
  } else {
    console.log('    暂无有效订阅')
  }
}

async function testGetSubscriptionHistory() {
  const res = await request('GET', '/api/v1/subscriptions/history?page=1&limit=10')

  assert(res.status === 200, `获取订阅历史失败: ${res.status}`)
  assert(res.data.success, `响应不成功: ${JSON.stringify(res.data)}`)
  assert(Array.isArray(res.data.data), '响应数据格式错误')

  console.log(`    历史记录数: ${res.data.data.length}`)
}

async function testToggleAutoRenew() {
  if (!testSubscriptionId) {
    console.log('    跳过: 无有效订阅')
    return
  }

  // 关闭自动续费
  const offRes = await request('POST', '/api/v1/subscriptions/toggle-renew', {
    auto_renew: false
  })

  assert(offRes.status === 200, `关闭自动续费失败: ${JSON.stringify(offRes.data)}`)
  assert(offRes.data.data?.autoRenew === false, '自动续费未关闭')

  // 开启自动续费
  const onRes = await request('POST', '/api/v1/subscriptions/toggle-renew', {
    auto_renew: true
  })

  assert(onRes.status === 200, `开启自动续费失败: ${JSON.stringify(onRes.data)}`)
  assert(onRes.data.data?.autoRenew === true, '自动续费未开启')
}

async function testManualRenew() {
  if (!testSubscriptionId) {
    console.log('    跳过: 无有效订阅')
    return
  }

  const res = await request('POST', '/api/v1/subscriptions/renew', {
    payment_method: 'alipay'
  })

  assert(res.status === 200, `手动续费失败: ${JSON.stringify(res.data)}`)
  assert(res.data.data?.amount !== undefined, '续费金额为空')

  console.log(`    续费金额: ${res.data.data.amount}`)
}

async function testCancelSubscription() {
  if (!testSubscriptionId) {
    console.log('    跳过: 无有效订阅')
    return
  }

  const res = await request('POST', '/api/v1/subscriptions/cancel', {
    cancel_mode: 'end_of_cycle',
    reason: 'API测试取消'
  })

  assert(res.status === 200, `取消订阅失败: ${JSON.stringify(res.data)}`)
  assert(res.data.data?.autoRenew === false, '取消后自动续费应为关闭')

  console.log(`    取消模式: ${res.data.data.mode}`)
}

async function testNoSubscriptionErrors() {
  // 临时清除 token 测试未认证错误
  const savedToken = authToken
  authToken = null

  const res = await request('GET', '/api/v1/subscriptions/current')
  assert(res.status === 401, `未认证应返回 401，实际 ${res.status}`)

  authToken = savedToken
}

// ========================================
// 主测试流程
// ========================================

async function runAllTests() {
  console.log('\n========================================')
  console.log('订阅管理系统 API 测试')
  console.log('========================================\n')

  console.log('📌 阶段1: 基础检查')
  await runTest('健康检查', testHealthCheck)

  console.log('\n📌 阶段2: 用户认证')
  await runTest('用户注册', testUserRegistration)
  await runTest('用户登录', testUserLogin)

  if (!authToken) {
    console.log('\n⚠️ 无法获取认证 token，跳过后续测试')
    console.log('请确保:')
    console.log('  1. 邮箱认证系统已配置 (SKIP_EMAIL_VERIFICATION=true)')
    console.log('  2. 数据库已正确初始化')
    return
  }

  console.log('\n📌 阶段3: 准备测试数据')
  await runTest('确保套餐存在', testEnsurePlanExists)
  await runTest('创建订单并支付', testCreateOrderAndPay)

  console.log('\n📌 阶段4: 订阅查询')
  await runTest('获取当前订阅', testGetCurrentSubscription)
  await runTest('获取订阅历史', testGetSubscriptionHistory)

  console.log('\n📌 阶段5: 订阅操作')
  await runTest('切换自动续费', testToggleAutoRenew)
  await runTest('手动续费', testManualRenew)
  await runTest('取消订阅', testCancelSubscription)

  console.log('\n📌 阶段6: 错误处理')
  await runTest('未认证错误', testNoSubscriptionErrors)

  // 测试结果汇总
  console.log('\n========================================')
  console.log('测试结果汇总')
  console.log('========================================')
  console.log(`✅ 通过: ${results.passed}`)
  console.log(`❌ 失败: ${results.failed}`)
  console.log(`📊 总计: ${results.passed + results.failed}`)

  if (results.failed > 0) {
    console.log('\n失败的测试:')
    results.tests
      .filter((t) => t.status === 'failed')
      .forEach((t) => console.log(`  - ${t.name}: ${t.error}`))
  }

  console.log('\n========================================\n')

  process.exit(results.failed > 0 ? 1 : 0)
}

// 执行测试
runAllTests().catch((error) => {
  console.error('测试执行失败:', error)
  process.exit(1)
})
