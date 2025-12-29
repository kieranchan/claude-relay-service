/**
 * 优惠券 API 测试脚本
 *
 * 使用方法：
 * 1. 启动数据库：prisma dev
 * 2. 启动服务：npm run dev
 * 3. 运行测试：node scripts/test-coupons-api.js
 */

const http = require('http')

const BASE_URL = 'http://localhost:3000'
let ADMIN_TOKEN = ''
const _USER_TOKEN = ''
const TEST_COUPON_ID = `TEST_COUPON_${Date.now()}`

/**
 * 发送 HTTP 请求
 */
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`
    }

    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({ status: res.statusCode, data: json })
        } catch (e) {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })

    req.on('error', reject)

    if (data) {
      req.write(JSON.stringify(data))
    }
    req.end()
  })
}

/**
 * 登录获取管理员 token
 */
async function loginAdmin() {
  console.log('\n📝 登录管理员账户...')

  // 读取 init.json 获取凭据
  const fs = require('fs')
  const path = require('path')
  const initPath = path.join(__dirname, '..', 'data', 'init.json')

  if (!fs.existsSync(initPath)) {
    console.error('❌ 找不到 data/init.json，请先运行 npm run setup')
    process.exit(1)
  }

  const initData = JSON.parse(fs.readFileSync(initPath, 'utf8'))

  const res = await request('POST', '/web/auth/login', {
    username: initData.adminUsername,
    password: initData.adminPassword
  })

  if (res.status === 200 && res.data.token) {
    ADMIN_TOKEN = res.data.token
    console.log('✅ 管理员登录成功')
    return true
  } else {
    console.error('❌ 管理员登录失败:', res.data)
    return false
  }
}

/**
 * 测试创建优惠券
 */
async function testCreateCoupon() {
  console.log('\n🎫 测试创建优惠券...')

  const couponData = {
    id: TEST_COUPON_ID,
    name: '测试优惠券',
    description: '这是一个测试优惠券',
    type: 'fixed_amount',
    value: 10.0,
    min_purchase_amount: 50.0,
    total_quantity: 100,
    per_user_limit: 1,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后过期
    distribution_type: 'public',
    stackable: false
  }

  const res = await request('POST', '/admin/coupons', couponData, ADMIN_TOKEN)

  if (res.status === 201 && res.data.success) {
    console.log('✅ 创建优惠券成功:', res.data.data.id)
    return true
  } else {
    console.log('❌ 创建优惠券失败:', res.data)
    return false
  }
}

/**
 * 测试获取优惠券列表
 */
async function testGetCoupons() {
  console.log('\n📋 测试获取优惠券列表...')

  const res = await request('GET', '/admin/coupons', null, ADMIN_TOKEN)

  if (res.status === 200 && res.data.success) {
    console.log('✅ 获取优惠券列表成功，共', res.data.data.length, '个优惠券')
    return true
  } else {
    console.log('❌ 获取优惠券列表失败:', res.data)
    return false
  }
}

/**
 * 测试更新优惠券
 */
async function testUpdateCoupon() {
  console.log('\n✏️ 测试更新优惠券...')

  const res = await request(
    'PUT',
    `/admin/coupons/${TEST_COUPON_ID}`,
    {
      name: '更新后的测试优惠券',
      total_quantity: 200
    },
    ADMIN_TOKEN
  )

  if (res.status === 200 && res.data.success) {
    console.log('✅ 更新优惠券成功')
    return true
  } else {
    console.log('❌ 更新优惠券失败:', res.data)
    return false
  }
}

/**
 * 测试获取优惠券统计
 */
async function testGetCouponStats() {
  console.log('\n📊 测试获取优惠券统计...')

  const res = await request('GET', `/admin/coupons/${TEST_COUPON_ID}/stats`, null, ADMIN_TOKEN)

  if (res.status === 200 && res.data.success) {
    console.log('✅ 获取优惠券统计成功:', {
      received_count: res.data.data.received_count,
      used_count: res.data.data.used_count,
      usage_rate: `${res.data.data.usage_rate}%`
    })
    return true
  } else {
    console.log('❌ 获取优惠券统计失败:', res.data)
    return false
  }
}

/**
 * 测试删除优惠券
 */
async function testDeleteCoupon() {
  console.log('\n🗑️ 测试删除优惠券...')

  const res = await request('DELETE', `/admin/coupons/${TEST_COUPON_ID}`, null, ADMIN_TOKEN)

  if (res.status === 200 && res.data.success) {
    console.log('✅ 删除优惠券成功:', res.data.message)
    return true
  } else {
    console.log('❌ 删除优惠券失败:', res.data)
    return false
  }
}

/**
 * 主测试流程
 */
async function main() {
  console.log('🚀 开始优惠券 API 测试')
  console.log('='.repeat(50))

  let passed = 0
  let failed = 0

  // 登录
  if (await loginAdmin()) {
    passed++
  } else {
    console.log('\n⚠️ 管理员登录失败，跳过后续测试')
    process.exit(1)
  }

  // 创建优惠券
  if (await testCreateCoupon()) {
    passed++
  } else {
    failed++
  }

  // 获取优惠券列表
  if (await testGetCoupons()) {
    passed++
  } else {
    failed++
  }

  // 更新优惠券
  if (await testUpdateCoupon()) {
    passed++
  } else {
    failed++
  }

  // 获取统计
  if (await testGetCouponStats()) {
    passed++
  } else {
    failed++
  }

  // 删除优惠券
  if (await testDeleteCoupon()) {
    passed++
  } else {
    failed++
  }

  // 测试结果
  console.log(`\n${'='.repeat(50)}`)
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`)

  if (failed === 0) {
    console.log('✅ 所有测试通过！')
  } else {
    console.log('❌ 有测试失败，请检查')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('💥 测试执行失败:', error)
  process.exit(1)
})
