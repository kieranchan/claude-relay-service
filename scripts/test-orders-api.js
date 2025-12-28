/**
 * 订单支付系统 API 测试脚本
 *
 * 前置条件:
 * 1. 启动 PostgreSQL 数据库 (端口 51214)
 * 2. 运行 npx prisma db push
 * 3. 启动服务 npm run dev
 * 4. 运行此脚本: node scripts/test-orders-api.js
 */

const http = require('http')

const BASE_URL = 'http://localhost:3000'
let authToken = null
let testUserId = null
let testOrderId = null
let testPlanId = null

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
    console.log(`✅ ${name}`)
  } catch (error) {
    results.failed++
    results.tests.push({ name, status: 'failed', error: error.message })
    console.log(`❌ ${name}: ${error.message}`)
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

async function testUserRegister() {
  const email = `test_order_${Date.now()}@test.com`
  const res = await request('POST', '/api/v1/auth/register', {
    email,
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
    name: '订单测试用户'
  })

  // 如果邮箱已存在，尝试登录
  if (res.status === 400 && res.data.error?.code === 'AUTH_EMAIL_EXISTS') {
    console.log('  用户已存在，跳过注册')
    return
  }

  assert(res.status === 201 || res.status === 200, `注册失败: ${JSON.stringify(res.data)}`)
}

async function testUserLogin() {
  const res = await request('POST', '/api/v1/auth/login', {
    email: 'admin@example.com', // 使用测试账号
    password: 'admin123'
  })

  if (res.status === 200 && res.data.data?.accessToken) {
    authToken = res.data.data.accessToken
    testUserId = res.data.data.user?.id
    console.log(`  已登录, userId: ${testUserId}`)
  } else {
    // 如果默认账号不存在，创建测试账号
    const email = `test_order_api_${Date.now()}@test.com`
    const regRes = await request('POST', '/api/v1/auth/register', {
      email,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      name: '订单测试用户'
    })

    if (regRes.status === 201 || regRes.status === 200) {
      const loginRes = await request('POST', '/api/v1/auth/login', {
        email,
        password: 'TestPassword123!'
      })
      assert(loginRes.status === 200, `登录失败: ${JSON.stringify(loginRes.data)}`)
      authToken = loginRes.data.data.accessToken
      testUserId = loginRes.data.data.user?.id
    } else {
      throw new Error(`无法创建测试用户: ${JSON.stringify(regRes.data)}`)
    }
  }

  assert(authToken, '未获取到 authToken')
}

async function testGetPlans() {
  const res = await request('GET', '/api/v1/plans')
  assert(res.status === 200, `获取套餐失败: ${res.status}`)

  if (res.data.data && res.data.data.length > 0) {
    testPlanId = res.data.data[0].id
    console.log(`  获取到 ${res.data.data.length} 个套餐, 使用: ${testPlanId}`)
  } else {
    console.log('  警告: 没有可用套餐，将跳过订单创建测试')
  }
}

async function testGetPaymentMethods() {
  const res = await request('GET', '/api/v1/orders/payment-methods')
  assert(res.status === 200, `获取支付方式失败: ${res.status}`)
  console.log(`  可用支付方式: ${JSON.stringify(res.data.data)}`)
}

async function testCreateOrder() {
  if (!testPlanId) {
    console.log('  跳过: 没有可用套餐')
    return
  }

  const res = await request('POST', '/api/v1/orders/create', {
    plan_id: testPlanId,
    payment_method: 'alipay'
  })

  assert(res.status === 201, `创建订单失败: ${res.status} - ${JSON.stringify(res.data)}`)
  assert(res.data.data?.orderId, '返回数据中没有 orderId')

  testOrderId = res.data.data.orderId
  console.log(`  订单创建成功: ${testOrderId}`)
}

async function testGetOrderDetail() {
  if (!testOrderId) {
    console.log('  跳过: 没有测试订单')
    return
  }

  const res = await request('GET', `/api/v1/orders/${testOrderId}`)
  assert(res.status === 200, `获取订单详情失败: ${res.status}`)
  assert(res.data.data?.orderId === testOrderId, '订单ID不匹配')
  console.log(`  订单状态: ${res.data.data.status}`)
}

async function testGetOrderStatus() {
  if (!testOrderId) {
    console.log('  跳过: 没有测试订单')
    return
  }

  const res = await request('GET', `/api/v1/orders/${testOrderId}/status`)
  assert(res.status === 200, `获取订单状态失败: ${res.status}`)
  assert(res.data.data?.status === 'pending', '订单状态应为 pending')
}

async function testGetOrderList() {
  const res = await request('GET', '/api/v1/orders/list')
  assert(res.status === 200, `获取订单列表失败: ${res.status}`)
  assert(Array.isArray(res.data.data), '返回数据不是数组')
  console.log(`  订单列表: ${res.data.data.length} 条`)
}

async function testInitiatePayment() {
  if (!testOrderId) {
    console.log('  跳过: 没有测试订单')
    return
  }

  const res = await request('POST', `/api/v1/orders/${testOrderId}/pay`, {
    payment_method: 'alipay'
  })

  // 支付可能因为未配置而失败，这是预期的
  if (res.status === 200) {
    console.log(`  支付信息: ${JSON.stringify(res.data.data?.paymentInfo)}`)
  } else if (res.data.error?.message?.includes('未配置')) {
    console.log('  支付方式未配置（预期行为）')
  } else {
    assert(false, `发起支付失败: ${JSON.stringify(res.data)}`)
  }
}

async function testCancelOrder() {
  if (!testOrderId) {
    console.log('  跳过: 没有测试订单')
    return
  }

  const res = await request('POST', `/api/v1/orders/${testOrderId}/cancel`, {
    reason: '测试取消'
  })

  assert(res.status === 200, `取消订单失败: ${res.status} - ${JSON.stringify(res.data)}`)
  console.log('  订单已取消')
}

async function testCreateDuplicateOrder() {
  if (!testPlanId) {
    console.log('  跳过: 没有可用套餐')
    return
  }

  // 先创建一个新订单
  const res1 = await request('POST', '/api/v1/orders/create', {
    plan_id: testPlanId,
    payment_method: 'alipay'
  })

  if (res1.status !== 201) {
    console.log(`  跳过: 无法创建订单 - ${JSON.stringify(res1.data)}`)
    return
  }

  // 尝试创建重复订单（应该被拒绝）
  const res2 = await request('POST', '/api/v1/orders/create', {
    plan_id: testPlanId,
    payment_method: 'alipay'
  })

  assert(
    res2.status === 400 && res2.data.error?.code === 'PENDING_ORDER_EXISTS',
    `应该拒绝重复订单: ${res2.status} - ${JSON.stringify(res2.data)}`
  )
  console.log('  正确拒绝重复订单')

  // 清理: 取消第一个订单
  await request('POST', `/api/v1/orders/${res1.data.data.orderId}/cancel`, {
    reason: '测试清理'
  })
}

async function testUnauthorizedAccess() {
  const savedToken = authToken
  authToken = null

  const res = await request('GET', '/api/v1/orders/list')
  assert(res.status === 401, `应该返回 401，实际 ${res.status}`)

  authToken = savedToken
}

// ========================================
// 主函数
// ========================================

async function main() {
  console.log('🧪 订单支付系统 API 测试')
  console.log('========================\n')

  // 检查服务健康
  console.log('📋 准备测试...')
  await runTest('健康检查', testHealthCheck)

  // 用户认证
  console.log('\n🔐 用户认证测试...')
  await runTest('用户注册', testUserRegister)
  await runTest('用户登录', testUserLogin)

  // 套餐获取
  console.log('\n📦 套餐测试...')
  await runTest('获取套餐列表', testGetPlans)

  // 订单功能
  console.log('\n🛒 订单功能测试...')
  await runTest('获取支付方式', testGetPaymentMethods)
  await runTest('创建订单', testCreateOrder)
  await runTest('获取订单详情', testGetOrderDetail)
  await runTest('查询订单状态', testGetOrderStatus)
  await runTest('获取订单列表', testGetOrderList)
  await runTest('发起支付', testInitiatePayment)
  await runTest('取消订单', testCancelOrder)

  // 边界条件
  console.log('\n🔒 边界条件测试...')
  await runTest('重复订单检测', testCreateDuplicateOrder)
  await runTest('未授权访问', testUnauthorizedAccess)

  // 输出结果
  console.log('\n========================')
  console.log(`✅ 通过: ${results.passed}`)
  console.log(`❌ 失败: ${results.failed}`)
  console.log('========================')

  if (results.failed > 0) {
    console.log('\n失败的测试:')
    results.tests
      .filter((t) => t.status === 'failed')
      .forEach((t) => console.log(`  - ${t.name}: ${t.error}`))
    process.exit(1)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error('💥 测试执行失败:', error)
  process.exit(1)
})
