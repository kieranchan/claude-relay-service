/**
 * 优惠券统计服务
 */
const { prisma } = require('../../models/prisma')

class CouponStatsService {
  /**
   * 获取优惠券统计（管理员）
   */
  async getCouponStats(couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    })

    if (!coupon) {
      throw new Error('优惠券不存在')
    }

    // 获取使用率
    const usageRate =
      coupon.receivedCount > 0 ? ((coupon.usedCount / coupon.receivedCount) * 100).toFixed(2) : 0

    // 获取财务数据
    const financialData = await prisma.couponUsage.aggregate({
      where: { couponId },
      _sum: {
        discountAmount: true,
        finalPrice: true
      },
      _avg: {
        discountAmount: true
      }
    })

    // 获取每日统计
    const _dailyStats = await prisma.userCoupon.groupBy({
      by: ['receivedAt'],
      where: { couponId },
      _count: { id: true }
    })

    return {
      coupon_id: coupon.id,
      name: coupon.name,
      total_quantity: coupon.totalQuantity,
      received_count: coupon.receivedCount,
      used_count: coupon.usedCount,
      usage_rate: parseFloat(usageRate),
      total_discount: parseFloat(financialData._sum.discountAmount || 0),
      total_revenue: parseFloat(financialData._sum.finalPrice || 0),
      avg_discount_per_order: parseFloat(financialData._avg.discountAmount || 0)
    }
  }
}

module.exports = new CouponStatsService()
