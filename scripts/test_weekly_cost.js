const redis = require('../src/models/redis')
const config = require('../config/config')

async function testWeeklyCost() {
  try {
    console.log('Connecting to Redis...')
    await redis.connect()

    const testKeyId = `test_weekly_limit_key_${Date.now()}`
    const costAmount = 1.5

    console.log(`Testing key: ${testKeyId}`)

    // 1. Check initial cost (should be 0)
    let cost = await redis.getWeeklyCost(testKeyId)
    console.log(`Initial Weekly Cost: ${cost}`)
    if (cost !== 0) {
      throw new Error('Initial cost should be 0')
    }

    // 2. Increment cost
    console.log(`Incrementing cost by ${costAmount}...`)
    await redis.incrementWeeklyCost(testKeyId, costAmount)

    // 3. Check cost again
    cost = await redis.getWeeklyCost(testKeyId)
    console.log(`Updated Weekly Cost: ${cost}`)
    if (cost !== costAmount) {
      throw new Error(`Cost should be ${costAmount}, got ${cost}`)
    }

    // 4. Increment again
    await redis.incrementWeeklyCost(testKeyId, 0.5)
    cost = await redis.getWeeklyCost(testKeyId)
    console.log(`Final Weekly Cost: ${cost}`)
    if (cost !== 2.0) {
      throw new Error(`Cost should be 2.0, got ${cost}`)
    }

    // Clean up
    await redis.getClient().del(`usage:cost:weekly:${testKeyId}:${getWeekStringInTimezone()}`)
    console.log('✅ Test Passed!')
  } catch (error) {
    console.error('❌ Test Failed:', error)
  } finally {
    await redis.disconnect()
  }
}

// Reuse helper from redis.js or mock it locally if not exported
function getDateInTimezone(date = new Date()) {
  const offset = config.system.timezoneOffset || 8
  const offsetMs = offset * 3600000
  return new Date(date.getTime() + offsetMs)
}

function getWeekStringInTimezone(date = new Date()) {
  const tzDate = getDateInTimezone(date)
  const year = tzDate.getUTCFullYear()
  const dateObj = new Date(tzDate)
  const dayOfWeek = dateObj.getUTCDay() || 7
  const firstThursday = new Date(dateObj)
  firstThursday.setUTCDate(dateObj.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(firstThursday.getUTCFullYear(), 0, 1)
  const weekNumber = Math.ceil(((firstThursday - yearStart) / 86400000 + 1) / 7)
  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

testWeeklyCost()
