/**
 * 套餐统计服务
 * 提供套餐相关的统计和分析功能
 */

const { getPrismaClient } = require('../../models/prisma')

/**
 * 获取套餐统计信息
 * @param {string} planId - 套餐ID
 * @returns {Promise<Object>}
 */
async function getPlanStats(planId) {
  const prisma = getPrismaClient()

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: {
          subscriptions: true,
          orders: true
        }
      },
      subscriptions: {
        where: { status: 'active' },
        select: { id: true }
      },
      orders: {
        where: { status: 'paid' },
        select: { finalPrice: true }
      }
    }
  })

  if (!plan) {
    throw new Error('套餐不存在')
  }

  // 计算总收入
  const totalRevenue = plan.orders.reduce((sum, order) => sum + parseFloat(order.finalPrice), 0)

  return {
    planId: plan.id,
    planName: plan.name,
    totalSubscriptions: plan._count.subscriptions,
    activeSubscriptions: plan.subscriptions.length,
    totalOrders: plan._count.orders,
    paidOrders: plan.orders.length,
    totalRevenue: totalRevenue.toFixed(2),
    currency: plan.currency
  }
}

/**
 * 获取所有套餐的汇总统计
 * @returns {Promise<Object>}
 */
async function getAllPlansStats() {
  const prisma = getPrismaClient()

  const [planCount, subscriptionStats, orderStats] = await Promise.all([
    // 套餐总数
    prisma.plan.count(),

    // 订阅统计
    prisma.subscription.groupBy({
      by: ['status'],
      _count: true
    }),

    // 订单统计
    prisma.order.aggregate({
      where: { status: 'paid' },
      _count: true,
      _sum: { finalPrice: true }
    })
  ])

  // 转换订阅统计
  const subscriptionsByStatus = {}
  subscriptionStats.forEach((stat) => {
    subscriptionsByStatus[stat.status] = stat._count
  })

  return {
    totalPlans: planCount,
    subscriptions: {
      total: Object.values(subscriptionsByStatus).reduce((a, b) => a + b, 0),
      byStatus: subscriptionsByStatus
    },
    orders: {
      paidCount: orderStats._count,
      totalRevenue: parseFloat(orderStats._sum.finalPrice || 0).toFixed(2)
    }
  }
}

/**
 * 获取套餐收入趋势
 * @param {string} planId - 套餐ID
 * @param {number} days - 统计天数
 * @returns {Promise<Array>}
 */
async function getPlanRevenueTrend(planId, days = 30) {
  const prisma = getPrismaClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const orders = await prisma.order.findMany({
    where: {
      planId,
      status: 'paid',
      paidAt: { gte: startDate }
    },
    select: {
      finalPrice: true,
      paidAt: true
    },
    orderBy: { paidAt: 'asc' }
  })

  // 按日期分组统计
  const dailyStats = {}
  orders.forEach((order) => {
    const date = order.paidAt.toISOString().split('T')[0]
    if (!dailyStats[date]) {
      dailyStats[date] = { count: 0, revenue: 0 }
    }
    dailyStats[date].count++
    dailyStats[date].revenue += parseFloat(order.finalPrice)
  })

  // 转换为数组格式
  return Object.entries(dailyStats).map(([date, stats]) => ({
    date,
    orderCount: stats.count,
    revenue: stats.revenue.toFixed(2)
  }))
}

module.exports = {
  getPlanStats,
  getAllPlansStats,
  getPlanRevenueTrend
}
