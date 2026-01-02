/**
 * 优惠券核心服务
 */
const { prisma } = require('../../models/prisma')
const couponFormatter = require('./couponFormatter')

class CouponService {
  /**
   * 获取可领取的优惠券列表
   */
  async getAvailableCoupons(userId) {
    const now = new Date()

    // 获取公开可领取的优惠券
    const coupons = await prisma.coupon.findMany({
      where: {
        status: 'active',
        distributionType: 'public',
        startTime: { lte: now },
        endTime: { gt: now }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 获取用户已领取的优惠券ID列表
    const userCoupons = await prisma.userCoupon.findMany({
      where: { userId },
      select: { couponId: true }
    })
    const receivedCouponIds = new Set(userCoupons.map((uc) => uc.couponId))

    // 格式化返回数据
    return coupons.map((coupon) => {
      const hasReceived = receivedCouponIds.has(coupon.id)
      const remainingQuantity = coupon.totalQuantity
        ? coupon.totalQuantity - coupon.receivedCount
        : null
      const canReceive = !hasReceived && (remainingQuantity === null || remainingQuantity > 0)

      return {
        ...couponFormatter.formatCoupon(coupon),
        can_receive: canReceive,
        received: hasReceived,
        remaining_quantity: remainingQuantity
      }
    })
  }

  /**
   * 获取用户的优惠券列表
   */
  async getMyCoupons(userId, status = null) {
    const where = { userId }
    if (status) {
      where.status = status
    }

    const userCoupons = await prisma.userCoupon.findMany({
      where,
      include: { coupon: true },
      orderBy: { receivedAt: 'desc' }
    })

    return userCoupons.map((uc) => couponFormatter.formatUserCoupon(uc))
  }

  /**
   * 领取优惠券
   */
  async receiveCoupon(userId, couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    })

    if (!coupon) {
      throw new Error('优惠券不存在')
    }

    if (coupon.status !== 'active') {
      throw new Error('优惠券未激活或已过期')
    }

    const now = new Date()
    if (now < coupon.startTime || now > coupon.endTime) {
      throw new Error('优惠券不在有效期内')
    }

    if (coupon.distributionType !== 'public') {
      throw new Error('该优惠券不支持领取')
    }

    // 检查是否已领取
    const existingUserCoupon = await prisma.userCoupon.findUnique({
      where: {
        userId_couponId: { userId, couponId }
      }
    })

    if (existingUserCoupon) {
      throw new Error('您已领取过该优惠券')
    }

    // 检查库存
    if (coupon.totalQuantity && coupon.receivedCount >= coupon.totalQuantity) {
      throw new Error('优惠券已被领完')
    }

    // 使用事务领取优惠券
    const result = await prisma.$transaction(async (tx) => {
      // 创建用户优惠券
      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId,
          expireAt: coupon.endTime
        }
      })

      // 增加领取计数
      await tx.coupon.update({
        where: { id: couponId },
        data: { receivedCount: { increment: 1 } }
      })

      return userCoupon
    })

    return {
      user_coupon_id: result.id.toString(),
      coupon: couponFormatter.formatCoupon(coupon),
      expire_at: result.expireAt
    }
  }

  /**
   * 兑换优惠码
   */
  async exchangeCode(userId, code) {
    const coupon = await prisma.coupon.findUnique({
      where: { code }
    })

    if (!coupon) {
      throw new Error('无效的优惠码')
    }

    if (coupon.status !== 'active') {
      throw new Error('优惠券未激活或已过期')
    }

    const now = new Date()
    if (now < coupon.startTime || now > coupon.endTime) {
      throw new Error('优惠券已过期')
    }

    // 检查是否已兑换
    const existingUserCoupon = await prisma.userCoupon.findUnique({
      where: {
        userId_couponId: { userId, couponId: coupon.id }
      }
    })

    if (existingUserCoupon) {
      throw new Error('您已兑换过该优惠码')
    }

    // 使用事务兑换
    const result = await prisma.$transaction(async (tx) => {
      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: coupon.id,
          expireAt: coupon.endTime
        }
      })

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { receivedCount: { increment: 1 } }
      })

      return userCoupon
    })

    return {
      user_coupon_id: result.id.toString(),
      coupon: couponFormatter.formatCoupon(coupon),
      expire_at: result.expireAt
    }
  }

  /**
   * 验证优惠券
   */
  async validate(couponCode, userId, planId, amount) {
    // 先按code查找，再按id查找
    let coupon = await prisma.coupon.findUnique({
      where: { code: couponCode }
    })
    if (!coupon) {
      coupon = await prisma.coupon.findUnique({
        where: { id: couponCode }
      })
    }

    if (!coupon) {
      return { valid: false, reason: '优惠券不存在' }
    }

    if (coupon.status !== 'active') {
      return { valid: false, reason: '优惠券未激活或已失效' }
    }

    const now = new Date()
    if (now < coupon.startTime || now > coupon.endTime) {
      return { valid: false, reason: '优惠券不在有效期内' }
    }

    // 检查用户是否拥有该优惠券
    const userCoupon = await prisma.userCoupon.findFirst({
      where: {
        userId,
        couponId: coupon.id,
        status: 'available'
      }
    })

    if (!userCoupon && coupon.distributionType !== 'code') {
      return { valid: false, reason: '您没有该优惠券' }
    }

    // 检查最低消费
    if (coupon.minPurchaseAmount && amount < parseFloat(coupon.minPurchaseAmount)) {
      return {
        valid: false,
        reason: '未达到最低消费金额',
        min_purchase_amount: parseFloat(coupon.minPurchaseAmount)
      }
    }

    // 检查适用套餐
    if (coupon.applicablePlans) {
      const { applicablePlans } = coupon
      if (Array.isArray(applicablePlans) && !applicablePlans.includes(planId)) {
        return { valid: false, reason: '该优惠券不适用于所选套餐' }
      }
    }

    // 检查排除套餐
    if (coupon.excludePlans) {
      const { excludePlans } = coupon
      if (Array.isArray(excludePlans) && excludePlans.includes(planId)) {
        return { valid: false, reason: '该优惠券不适用于所选套餐' }
      }
    }

    // 计算优惠金额
    const discountAmount = this.calculateDiscount(coupon, amount)

    return {
      valid: true,
      coupon: couponFormatter.formatCoupon(coupon),
      discount_amount: discountAmount,
      final_amount: amount - discountAmount
    }
  }

  /**
   * 计算优惠金额
   */
  calculateDiscount(coupon, amount) {
    let discount = 0
    const value = parseFloat(coupon.value)

    switch (coupon.type) {
      case 'fixed_amount':
        // 固定金额
        discount = Math.min(value, amount)
        break

      case 'percentage':
        // 百分比折扣
        discount = amount * (value / 100)
        if (coupon.maxDiscountAmount) {
          discount = Math.min(discount, parseFloat(coupon.maxDiscountAmount))
        }
        break

      case 'full_reduction':
        // 满减
        if (coupon.minPurchaseAmount && amount >= parseFloat(coupon.minPurchaseAmount)) {
          discount = value
        }
        break
    }

    return parseFloat(discount.toFixed(2))
  }

  /**
   * 使用优惠券（下单时调用）
   */
  async useCoupon(userId, couponId, orderId, originalPrice, discountAmount) {
    const userCoupon = await prisma.userCoupon.findFirst({
      where: {
        userId,
        couponId,
        status: 'available'
      }
    })

    if (!userCoupon) {
      throw new Error('优惠券不可用')
    }

    // 使用事务更新状态
    await prisma.$transaction(async (tx) => {
      // 更新用户优惠券状态
      await tx.userCoupon.update({
        where: { id: userCoupon.id },
        data: {
          status: 'used',
          orderId,
          usedAt: new Date()
        }
      })

      // 创建使用记录
      await tx.couponUsage.create({
        data: {
          userCouponId: userCoupon.id,
          userId,
          couponId,
          orderId,
          originalPrice,
          discountAmount,
          finalPrice: originalPrice - discountAmount
        }
      })

      // 更新优惠券使用计数
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } }
      })
    })

    return { success: true }
  }

  /**
   * 创建优惠券（管理员）
   */
  async createCoupon(data, adminId) {
    // 检查ID是否已存在
    const existing = await prisma.coupon.findUnique({
      where: { id: data.id }
    })
    if (existing) {
      throw new Error('优惠券ID已存在')
    }

    // 如果有code，检查是否已存在
    if (data.code) {
      const existingCode = await prisma.coupon.findUnique({
        where: { code: data.code }
      })
      if (existingCode) {
        throw new Error('优惠码已存在')
      }
    }

    const coupon = await prisma.coupon.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        code: data.code,
        type: data.type,
        value: data.value,
        minPurchaseAmount: data.min_purchase_amount,
        maxDiscountAmount: data.max_discount_amount,
        applicablePlans: data.applicable_plans,
        excludePlans: data.exclude_plans,
        totalQuantity: data.total_quantity,
        perUserLimit: data.per_user_limit || 1,
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time),
        distributionType: data.distribution_type,
        stackable: data.stackable || false,
        createdBy: adminId
      }
    })

    return couponFormatter.formatCoupon(coupon)
  }

  /**
   * 更新优惠券（管理员）
   */
  async updateCoupon(couponId, data) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    })

    if (!coupon) {
      throw new Error('优惠券不存在')
    }

    const updateData = {}
    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.description !== undefined) {
      updateData.description = data.description
    }
    if (data.status !== undefined) {
      updateData.status = data.status
    }
    if (data.total_quantity !== undefined) {
      updateData.totalQuantity = data.total_quantity
    }
    if (data.per_user_limit !== undefined) {
      updateData.perUserLimit = data.per_user_limit
    }
    if (data.start_time !== undefined) {
      updateData.startTime = new Date(data.start_time)
    }
    if (data.end_time !== undefined) {
      updateData.endTime = new Date(data.end_time)
    }
    if (data.min_purchase_amount !== undefined) {
      updateData.minPurchaseAmount = data.min_purchase_amount
    }
    if (data.max_discount_amount !== undefined) {
      updateData.maxDiscountAmount = data.max_discount_amount
    }
    if (data.applicable_plans !== undefined) {
      updateData.applicablePlans = data.applicable_plans
    }
    if (data.exclude_plans !== undefined) {
      updateData.excludePlans = data.exclude_plans
    }
    if (data.stackable !== undefined) {
      updateData.stackable = data.stackable
    }

    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data: updateData
    })

    return couponFormatter.formatCoupon(updated)
  }

  /**
   * 删除优惠券（管理员）
   */
  async deleteCoupon(couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    })

    if (!coupon) {
      throw new Error('优惠券不存在')
    }

    // 检查是否有使用记录
    const usageCount = await prisma.userCoupon.count({
      where: { couponId }
    })

    if (usageCount > 0) {
      // 有使用记录，改为inactive
      await prisma.coupon.update({
        where: { id: couponId },
        data: { status: 'inactive' }
      })
      return { deleted: false, archived: true }
    } else {
      // 无使用记录，物理删除
      await prisma.coupon.delete({
        where: { id: couponId }
      })
      return { deleted: true }
    }
  }

  /**
   * 获取优惠券列表（管理员）
   */
  async getCoupons(options = {}) {
    const { status, type, page = 1, limit = 20 } = options

    const where = {}
    if (status) {
      where.status = status
    }
    if (type) {
      where.type = type
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.coupon.count({ where })
    ])

    return {
      data: coupons.map((c) => couponFormatter.formatCoupon(c)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * 批量发放优惠券（管理员）
   */
  async distributeCoupons(couponId, targetType, targets, expireDays) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    })

    if (!coupon) {
      throw new Error('优惠券不存在')
    }

    let userIds = []

    if (targetType === 'user_ids') {
      userIds = targets
    } else if (targetType === 'user_filter') {
      // 根据过滤条件查询用户
      const where = {}
      if (targets.registered_after) {
        where.createdAt = { gte: new Date(targets.registered_after) }
      }
      if (targets.status) {
        where.status = targets.status
      }

      const users = await prisma.user.findMany({
        where,
        select: { id: true }
      })
      userIds = users.map((u) => u.id)
    }

    if (userIds.length === 0) {
      throw new Error('没有找到目标用户')
    }

    // 计算过期时间
    const expireAt = expireDays
      ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)
      : coupon.endTime

    // 批量创建用户优惠券
    const createData = userIds.map((userId) => ({
      userId,
      couponId,
      expireAt
    }))

    // 使用 createMany with skipDuplicates
    const result = await prisma.userCoupon.createMany({
      data: createData,
      skipDuplicates: true
    })

    // 更新领取计数
    await prisma.coupon.update({
      where: { id: couponId },
      data: { receivedCount: { increment: result.count } }
    })

    return {
      distributed_count: result.count,
      target_users: userIds.length
    }
  }

  /**
   * 标记过期优惠券
   */
  async markExpiredCoupons() {
    const now = new Date()

    // 更新过期的用户优惠券
    const result = await prisma.userCoupon.updateMany({
      where: {
        status: 'available',
        OR: [
          { expireAt: { lt: now } },
          {
            coupon: {
              endTime: { lt: now }
            }
          }
        ]
      },
      data: { status: 'expired' }
    })

    // 更新过期的优惠券模板
    await prisma.coupon.updateMany({
      where: {
        status: 'active',
        endTime: { lt: now }
      },
      data: { status: 'expired' }
    })

    return result.count
  }
}

module.exports = new CouponService()
