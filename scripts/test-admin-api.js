const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const axios = require('axios')

async function testAdminAPI() {
  console.log('🔍 测试 Admin API 返回数据...\n')

  try {
    // 模拟管理员登录获取 session
    const baseURL = `http://localhost:${process.env.PORT || 3000}`

    console.log('1️⃣ 测试 GET /admin/api-keys 接口...')

    // 注意：这需要管理员 session，如果没有会返回 401
    const response = await axios.get(`${baseURL}/admin/api-keys`, {
      headers: {
        Cookie: 'admin_session=your_session_here' // 需要替换为真实 session
      },
      validateStatus: () => true // 接受所有状态码
    })

    if (response.status === 401) {
      console.log('⚠️  需要管理员登录，无法直接测试 API')
      console.log('💡 请在浏览器中打开开发者工具，查看 Network 标签页')
      console.log('   找到 /admin/api-keys 请求，查看返回的 JSON 数据')
      console.log('   检查名为 "22" 的 Key 是否包含 weeklyCostLimit 字段')
      return
    }

    if (response.status === 200) {
      const keys = response.data.data || []
      const key22 = keys.find((k) => k.name === '22')

      if (key22) {
        console.log('✅ 找到 API Key "22"')
        console.log('\n📊 返回的数据:')
        console.log('   dailyCostLimit:', key22.dailyCostLimit)
        console.log('   weeklyCostLimit:', key22.weeklyCostLimit)
        console.log('   totalCostLimit:', key22.totalCostLimit)
        console.log('   weeklyOpusCostLimit:', key22.weeklyOpusCostLimit)

        if (key22.weeklyCostLimit === undefined) {
          console.log('\n❌ weeklyCostLimit 字段缺失！')
        } else if (key22.weeklyCostLimit === 0) {
          console.log('\n⚠️  weeklyCostLimit 为 0，前端会隐藏显示')
        } else {
          console.log('\n✅ weeklyCostLimit 数据正常')
        }
      } else {
        console.log('❌ 未找到名为 "22" 的 Key')
      }
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message)
    console.log('\n💡 手动测试方法:')
    console.log('1. 在浏览器中打开后台管理系统')
    console.log('2. 按 F12 打开开发者工具')
    console.log('3. 切换到 Network 标签页')
    console.log('4. 刷新 API Keys 列表页面')
    console.log('5. 找到 "api-keys" 请求，查看 Response')
    console.log('6. 搜索 "22"，查看该 Key 的 weeklyCostLimit 值')
  }
}

testAdminAPI()
