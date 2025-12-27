/**
 * 邮箱登录功能测试脚本
 * 测试用户注册、登录、Token刷新、用户信息等API
 */

const BASE_URL = 'http://localhost:3000'

// 测试数据
const testUser = {
  email: 'test@example.com',
  password: 'Test1234',
  confirmPassword: 'Test1234'
}

// 存储测试过程中的数据
let accessToken = null
let refreshToken = null
let userId = null

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

// 辅助函数：发送请求
async function request(method, path, body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options = {
    method,
    headers
  }
  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${path}`, options)
  const data = await response.json()
  return { status: response.status, data }
}

// 辅助函数：记录测试结果
function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`${status}: ${name}${details ? ` - ${details}` : ''}`)
  results.tests.push({ name, passed, details })
  if (passed) {
    results.passed++
  } else {
    results.failed++
  }
}

// ===========================
// 测试用例
// ===========================

// 测试1: 注册 - 成功
async function testRegisterSuccess() {
  const { status, data } = await request('POST', '/api/v1/auth/register', testUser)

  const passed = status === 201 && data.success === true && data.data?.userId
  if (passed) {
    ;({ userId } = data.data)
  }
  logTest('注册新用户', passed, passed ? `userId: ${userId}` : JSON.stringify(data))
  return passed
}

// 测试2: 注册 - 重复邮箱
async function testRegisterDuplicate() {
  const { status, data } = await request('POST', '/api/v1/auth/register', testUser)

  const passed = status === 409 && data.error?.code === 'AUTH_001'
  logTest('注册重复邮箱应返回409', passed, JSON.stringify(data.error))
  return passed
}

// 测试3: 注册 - 无效邮箱
async function testRegisterInvalidEmail() {
  const { status, data } = await request('POST', '/api/v1/auth/register', {
    email: 'invalid-email',
    password: 'Test1234',
    confirmPassword: 'Test1234'
  })

  const passed = status === 400 && data.error?.code === 'VALIDATION_ERROR'
  logTest('注册无效邮箱应返回400', passed)
  return passed
}

// 测试4: 注册 - 密码太短
async function testRegisterShortPassword() {
  const { status, data } = await request('POST', '/api/v1/auth/register', {
    email: 'test2@example.com',
    password: 'Test1',
    confirmPassword: 'Test1'
  })

  const passed = status === 400 && data.error?.code === 'VALIDATION_ERROR'
  logTest('注册短密码应返回400', passed)
  return passed
}

// 测试5: 注册 - 密码不一致
async function testRegisterPasswordMismatch() {
  const { status, data } = await request('POST', '/api/v1/auth/register', {
    email: 'test3@example.com',
    password: 'Test1234',
    confirmPassword: 'Test5678'
  })

  const passed = status === 400 && data.error?.code === 'VALIDATION_ERROR'
  logTest('注册密码不一致应返回400', passed)
  return passed
}

// 测试6: 登录 - 邮箱未验证（根据配置可能跳过验证）
async function testLoginUnverified() {
  const { status, data } = await request('POST', '/api/v1/auth/login', {
    email: testUser.email,
    password: testUser.password
  })

  // 如果配置了跳过邮箱验证，则登录成功；否则返回403
  if (status === 200 && data.success && data.data?.accessToken) {
    ;({ accessToken, refreshToken } = data.data)
    logTest('登录成功（邮箱验证已跳过）', true, `accessToken: ${accessToken.substring(0, 20)}...`)
    return true
  } else if (status === 403 && data.error?.code === 'AUTH_002') {
    logTest('登录失败 - 邮箱未验证', true, '需要先验证邮箱')
    return true
  } else {
    logTest('登录测试', false, JSON.stringify(data))
    return false
  }
}

// 测试7: 登录 - 错误密码
async function testLoginWrongPassword() {
  const { status, data } = await request('POST', '/api/v1/auth/login', {
    email: testUser.email,
    password: 'WrongPassword123'
  })

  const passed = status === 401 && data.error?.code === 'AUTH_INVALID_CREDENTIALS'
  logTest('登录错误密码应返回401', passed, data.error?.message)
  return passed
}

// 测试8: 登录 - 不存在的用户
async function testLoginNonexistent() {
  const { status, data } = await request('POST', '/api/v1/auth/login', {
    email: 'nonexistent@example.com',
    password: 'Test1234'
  })

  const passed = status === 401 && data.error?.code === 'AUTH_INVALID_CREDENTIALS'
  logTest('登录不存在的用户应返回401', passed)
  return passed
}

// 测试9: Token 刷新 - 成功
async function testRefreshTokenSuccess() {
  if (!refreshToken) {
    logTest('Token刷新', false, '跳过 - 没有refreshToken')
    return false
  }

  const { status, data } = await request('POST', '/api/v1/auth/refresh', {
    refreshToken
  })

  const passed = status === 200 && data.success && data.data?.accessToken
  if (passed) {
    ;({ accessToken } = data.data)
  }
  logTest('Token刷新成功', passed, passed ? '获取新accessToken' : JSON.stringify(data))
  return passed
}

// 测试10: Token 刷新 - 无效token
async function testRefreshTokenInvalid() {
  const { status, data } = await request('POST', '/api/v1/auth/refresh', {
    refreshToken: 'invalid-token'
  })

  const passed = status === 401 && data.error?.code === 'AUTH_REFRESH_INVALID'
  logTest('无效Token刷新应返回401', passed)
  return passed
}

// 测试11: 检查登录状态 - 已登录
async function testAuthCheckLoggedIn() {
  if (!accessToken) {
    logTest('检查登录状态', false, '跳过 - 没有accessToken')
    return false
  }

  const { status, data } = await request('GET', '/api/v1/auth/check', null, accessToken)

  const passed = status === 200 && data.success && data.data?.user
  logTest(
    '检查登录状态 - 已登录',
    passed,
    passed ? `email: ${data.data.user.email}` : JSON.stringify(data)
  )
  return passed
}

// 测试12: 检查登录状态 - 未登录
async function testAuthCheckNotLoggedIn() {
  const { status } = await request('GET', '/api/v1/auth/check')

  const passed = status === 401
  logTest('检查登录状态 - 未登录应返回401', passed)
  return passed
}

// 测试13: 获取用户信息
async function testGetUserProfile() {
  if (!accessToken) {
    logTest('获取用户信息', false, '跳过 - 没有accessToken')
    return false
  }

  const { status, data } = await request('GET', '/api/v1/user/profile', null, accessToken)

  const passed = status === 200 && data.success && data.data?.email
  logTest('获取用户信息', passed, passed ? `email: ${data.data.email}` : JSON.stringify(data))
  return passed
}

// 测试14: 修改密码 - 错误的旧密码
async function testChangePasswordWrongOld() {
  if (!accessToken) {
    logTest('修改密码-错误旧密码', false, '跳过 - 没有accessToken')
    return false
  }

  const { status, data } = await request(
    'POST',
    '/api/v1/auth/change-password',
    {
      oldPassword: 'WrongOldPassword1',
      newPassword: 'NewTest1234',
      confirmPassword: 'NewTest1234'
    },
    accessToken
  )

  const passed = status === 400 && data.error?.code === 'AUTH_INVALID_PASSWORD'
  logTest('修改密码-错误旧密码应返回400', passed)
  return passed
}

// 测试15: 忘记密码
async function testForgotPassword() {
  const { status, data } = await request('POST', '/api/v1/auth/forgot-password', {
    email: testUser.email
  })

  // 无论邮箱是否存在都应返回成功（防止邮箱枚举）
  const passed = status === 200 && data.success
  logTest('忘记密码请求', passed, data.message || '')
  return passed
}

// 测试16: 登出
async function testLogout() {
  if (!accessToken) {
    logTest('登出', false, '跳过 - 没有accessToken')
    return false
  }

  const { status, data } = await request(
    'POST',
    '/api/v1/auth/logout',
    {
      refreshToken
    },
    accessToken
  )

  const passed = status === 200 && data.success
  logTest('登出', passed, data.message || '')
  return passed
}

// 测试17: 登出后检查登录状态
async function testAuthCheckAfterLogout() {
  if (!accessToken) {
    logTest('登出后检查状态', false, '跳过 - 没有accessToken')
    return false
  }

  const { status } = await request('GET', '/api/v1/auth/check', null, accessToken)

  // 登出后应该返回401（token在黑名单中）
  const passed = status === 401
  logTest('登出后检查状态应返回401', passed)
  return passed
}

// ===========================
// 主函数
// ===========================

async function runTests() {
  console.log('='.repeat(60))
  console.log('📧 邮箱登录功能测试')
  console.log('='.repeat(60))
  console.log()

  // 检查服务器是否运行
  try {
    await fetch(`${BASE_URL}/health`)
  } catch (error) {
    console.log('❌ 服务器未运行，请先启动服务器：npm run dev')
    process.exit(1)
  }

  console.log('📋 注册测试')
  console.log('-'.repeat(40))
  await testRegisterSuccess()
  await testRegisterDuplicate()
  await testRegisterInvalidEmail()
  await testRegisterShortPassword()
  await testRegisterPasswordMismatch()
  console.log()

  console.log('🔐 登录测试')
  console.log('-'.repeat(40))
  await testLoginUnverified()
  await testLoginWrongPassword()
  await testLoginNonexistent()
  console.log()

  console.log('🔄 Token测试')
  console.log('-'.repeat(40))
  await testRefreshTokenSuccess()
  await testRefreshTokenInvalid()
  console.log()

  console.log('👤 用户状态测试')
  console.log('-'.repeat(40))
  await testAuthCheckLoggedIn()
  await testAuthCheckNotLoggedIn()
  await testGetUserProfile()
  console.log()

  console.log('🔑 密码测试')
  console.log('-'.repeat(40))
  await testChangePasswordWrongOld()
  await testForgotPassword()
  console.log()

  console.log('🚪 登出测试')
  console.log('-'.repeat(40))
  await testLogout()
  await testAuthCheckAfterLogout()
  console.log()

  // 打印总结
  console.log('='.repeat(60))
  console.log('📊 测试结果总结')
  console.log('='.repeat(60))
  console.log(`✅ 通过: ${results.passed}`)
  console.log(`❌ 失败: ${results.failed}`)
  console.log(`📝 总计: ${results.passed + results.failed}`)
  console.log()

  if (results.failed > 0) {
    console.log('❌ 失败的测试:')
    results.tests
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`  - ${t.name}: ${t.details}`)
      })
  }

  process.exit(results.failed > 0 ? 1 : 0)
}

runTests().catch((error) => {
  console.error('测试运行错误:', error)
  process.exit(1)
})
