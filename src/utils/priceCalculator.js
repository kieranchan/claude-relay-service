/**
 * 价格计算工具
 * 处理订单价格计算，包括优惠券、邀请折扣等
 */

// 邀请优惠比例（5%）
const INVITE_DISCOUNT_RATE = 0.05

/**
 * 计算订单价格
 * @param {Object} params
 * @param {number} params.planPrice - 套餐原价
 * @param {Object} params.coupon - 优惠券信息
 * @param {string} params.invitedBy - 邀请人ID（有则享受邀请优惠）
 * @returns {Object} 价格详情
 */
function calculatePrice(params) {
  const { planPrice, coupon, invitedBy } = params

  const originalPrice = parseFloat(planPrice) || 0
  let couponDiscount = 0
  let inviteDiscount = 0

  // 1. 计算优惠券折扣
  if (coupon && coupon.enabled !== false) {
    if (coupon.type === 'percentage') {
      // 百分比折扣
      couponDiscount = originalPrice * (coupon.value / 100)
    } else if (coupon.type === 'fixed_amount' || coupon.type === 'fixed') {
      // 固定金额折扣
      couponDiscount = Math.min(coupon.value, originalPrice)
    }
  }

  // 2. 计算邀请优惠（如果有邀请人）
  if (invitedBy) {
    inviteDiscount = originalPrice * INVITE_DISCOUNT_RATE
  }

  // 3. 计算总折扣和最终价格
  const totalDiscount = couponDiscount + inviteDiscount
  let finalPrice = originalPrice - totalDiscount

  // 4. 确保价格不为负数，最低为0
  finalPrice = Math.max(finalPrice, 0)

  // 5. 保留两位小数
  return {
    originalPrice: parseFloat(originalPrice.toFixed(2)),
    couponDiscount: parseFloat(couponDiscount.toFixed(2)),
    inviteDiscount: parseFloat(inviteDiscount.toFixed(2)),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2))
  }
}

/**
 * 格式化金额显示
 * @param {number} amount - 金额
 * @param {string} currency - 货币代码
 * @returns {string}
 */
function formatAmount(amount, currency = 'CNY') {
  const symbols = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£'
  }

  const symbol = symbols[currency] || currency
  return `${symbol}${parseFloat(amount).toFixed(2)}`
}

/**
 * 将元转换为分（用于支付接口）
 * @param {number} yuan - 元
 * @returns {number} 分
 */
function yuanToFen(yuan) {
  return Math.round(parseFloat(yuan) * 100)
}

/**
 * 将分转换为元
 * @param {number} fen - 分
 * @returns {number} 元
 */
function fenToYuan(fen) {
  return parseFloat((parseInt(fen) / 100).toFixed(2))
}

module.exports = {
  calculatePrice,
  formatAmount,
  yuanToFen,
  fenToYuan,
  INVITE_DISCOUNT_RATE
}
