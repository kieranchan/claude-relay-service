const config = require('../../config/config')

/**
 * 格式化日期时间为指定时区的本地时间字符串
 * @param {Date|number} date - Date对象或时间戳（秒或毫秒）
 * @param {boolean} includeTimezone - 是否在输出中包含时区信息
 * @returns {string} 格式化后的时间字符串
 */
function formatDateWithTimezone(date, includeTimezone = true) {
  // 处理不同类型的输入
  let dateObj
  if (typeof date === 'number') {
    // 判断是秒还是毫秒时间戳
    // Unix时间戳（秒）通常小于 10^10，毫秒时间戳通常大于 10^12
    if (date < 10000000000) {
      dateObj = new Date(date * 1000) // 秒转毫秒
    } else {
      dateObj = new Date(date) // 已经是毫秒
    }
  } else if (date instanceof Date) {
    dateObj = date
  } else {
    dateObj = new Date(date)
  }

  // 获取配置的时区偏移（小时）
  const timezoneOffset = config.system.timezoneOffset || 8 // 默认 UTC+8

  // 计算本地时间
  const offsetMs = timezoneOffset * 3600000 // 转换为毫秒
  const localTime = new Date(dateObj.getTime() + offsetMs)

  // 格式化为 YYYY-MM-DD HH:mm:ss
  const year = localTime.getUTCFullYear()
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localTime.getUTCDate()).padStart(2, '0')
  const hours = String(localTime.getUTCHours()).padStart(2, '0')
  const minutes = String(localTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(localTime.getUTCSeconds()).padStart(2, '0')

  let formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

  // 添加时区信息
  if (includeTimezone) {
    const sign = timezoneOffset >= 0 ? '+' : ''
    formattedDate += ` (UTC${sign}${timezoneOffset})`
  }

  return formattedDate
}

/**
 * 获取指定时区的ISO格式时间字符串
 * @param {Date|number} date - Date对象或时间戳
 * @returns {string} ISO格式的时间字符串
 */
function getISOStringWithTimezone(date) {
  // 先获取本地格式的时间（不含时区后缀）
  const localTimeStr = formatDateWithTimezone(date, false)

  // 获取时区偏移
  const timezoneOffset = config.system.timezoneOffset || 8

  // 构建ISO格式，添加时区偏移
  const sign = timezoneOffset >= 0 ? '+' : '-'
  const absOffset = Math.abs(timezoneOffset)
  const offsetHours = String(Math.floor(absOffset)).padStart(2, '0')
  const offsetMinutes = String(Math.round((absOffset % 1) * 60)).padStart(2, '0')

  // 将空格替换为T，并添加时区
  return `${localTimeStr.replace(' ', 'T')}${sign}${offsetHours}:${offsetMinutes}`
}

/**
 * 计算时间差并格式化为人类可读的字符串
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间差字符串
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}秒`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分钟`
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  } else {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    return hours > 0 ? `${days}天${hours}小时` : `${days}天`
  }
}

// ========================================
// 订阅系统日期函数
// ========================================

/**
 * 增加天数
 * @param {Date|string} date - 起始日期
 * @param {number} days - 天数
 * @returns {Date} 新日期
 */
function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 增加月份
 * @param {Date|string} date - 起始日期
 * @param {number} months - 月数
 * @returns {Date} 新日期
 */
function addMonths(date, months) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * 增加年份
 * @param {Date|string} date - 起始日期
 * @param {number} years - 年数
 * @returns {Date} 新日期
 */
function addYears(date, years) {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)
  return result
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} date - 日期
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 计算两个日期之间的天数
 * @param {Date|string} date1 - 日期1
 * @param {Date|string} date2 - 日期2
 * @returns {number} 天数差（绝对值）
 */
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.round(Math.abs((d1 - d2) / oneDay))
}

/**
 * 计算从现在到指定日期的剩余天数
 * @param {Date|string} expireDate - 到期日期
 * @returns {number} 剩余天数
 */
function daysRemaining(expireDate) {
  const now = new Date()
  const expire = new Date(expireDate)
  const diff = expire - now
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * 根据计费周期计算到期日期
 * @param {Date|string} startDate - 起始日期
 * @param {string} billingCycle - 计费周期 (monthly | quarterly | yearly | lifetime)
 * @returns {Date} 到期日期
 */
function calculateExpireDate(startDate, billingCycle) {
  const date = new Date(startDate)

  switch (billingCycle) {
    case 'monthly':
      return addMonths(date, 1)
    case 'quarterly':
      return addMonths(date, 3)
    case 'yearly':
      return addYears(date, 1)
    case 'lifetime':
      return addYears(date, 100) // 100年后
    default:
      return addMonths(date, 1)
  }
}

/**
 * 根据计费周期获取总天数
 * @param {string} billingCycle - 计费周期
 * @returns {number} 周期天数
 */
function getCycleDays(billingCycle) {
  switch (billingCycle) {
    case 'monthly':
      return 30
    case 'quarterly':
      return 90
    case 'yearly':
      return 365
    case 'lifetime':
      return 36500 // 100年
    default:
      return 30
  }
}

/**
 * 判断日期是否已过期
 * @param {Date|string} date - 日期
 * @returns {boolean} 是否已过期
 */
function isExpired(date) {
  return new Date(date) < new Date()
}

/**
 * 判断日期是否在指定天数内
 * @param {Date|string} date - 日期
 * @param {number} days - 天数
 * @returns {boolean} 是否在指定天数内
 */
function isWithinDays(date, days) {
  const targetDate = new Date(date)
  const now = new Date()
  const futureDate = addDays(now, days)
  return targetDate > now && targetDate <= futureDate
}

/**
 * 获取今天的日期（不含时间）
 * @returns {Date} 今天的日期
 */
function getToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

module.exports = {
  formatDateWithTimezone,
  getISOStringWithTimezone,
  formatDuration,
  // 订阅系统日期函数
  addDays,
  addMonths,
  addYears,
  formatDate,
  daysBetween,
  daysRemaining,
  calculateExpireDate,
  getCycleDays,
  isExpired,
  isWithinDays,
  getToday
}
