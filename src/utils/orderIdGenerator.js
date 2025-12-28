/**
 * 订单号生成工具
 * 生成唯一的订单号和退款单号
 */

/**
 * 生成订单号
 * 格式：ORD + 年月日 + 9位随机数
 * 例如：ORD20240126123456789
 * @returns {string}
 */
function generateOrderId() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  // 生成9位随机数
  const random = Math.floor(100000000 + Math.random() * 900000000)

  return `ORD${year}${month}${day}${random}`
}

/**
 * 生成退款单号
 * 格式：REF + 年月日 + 9位随机数
 * 例如：REF20240126123456789
 * @returns {string}
 */
function generateRefundId() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  const random = Math.floor(100000000 + Math.random() * 900000000)

  return `REF${year}${month}${day}${random}`
}

/**
 * 验证订单号格式
 * @param {string} orderId
 * @returns {boolean}
 */
function isValidOrderId(orderId) {
  return /^ORD\d{17}$/.test(orderId)
}

/**
 * 验证退款单号格式
 * @param {string} refundId
 * @returns {boolean}
 */
function isValidRefundId(refundId) {
  return /^REF\d{17}$/.test(refundId)
}

module.exports = {
  generateOrderId,
  generateRefundId,
  isValidOrderId,
  isValidRefundId
}
