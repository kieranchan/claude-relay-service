/**
 * 优惠券格式化工具
 */

class CouponFormatter {
    /**
     * 格式化优惠券数据
     */
    formatCoupon(coupon) {
        return {
            id: coupon.id,
            name: coupon.name,
            description: coupon.description,
            code: coupon.code,
            type: coupon.type,
            value: parseFloat(coupon.value),
            min_purchase_amount: coupon.minPurchaseAmount
                ? parseFloat(coupon.minPurchaseAmount)
                : null,
            max_discount_amount: coupon.maxDiscountAmount
                ? parseFloat(coupon.maxDiscountAmount)
                : null,
            applicable_plans: coupon.applicablePlans,
            exclude_plans: coupon.excludePlans,
            total_quantity: coupon.totalQuantity,
            received_count: coupon.receivedCount,
            used_count: coupon.usedCount,
            per_user_limit: coupon.perUserLimit,
            start_time: coupon.startTime,
            end_time: coupon.endTime,
            status: coupon.status,
            stackable: coupon.stackable,
            distribution_type: coupon.distributionType,
            created_at: coupon.createdAt,
        };
    }

    /**
     * 格式化用户优惠券数据
     */
    formatUserCoupon(userCoupon) {
        const daysRemaining = userCoupon.expireAt
            ? Math.ceil(
                (new Date(userCoupon.expireAt) - new Date()) / (1000 * 60 * 60 * 24)
            )
            : null;

        return {
            user_coupon_id: userCoupon.id.toString(),
            coupon: this.formatCoupon(userCoupon.coupon),
            status: userCoupon.status,
            received_at: userCoupon.receivedAt,
            used_at: userCoupon.usedAt,
            expire_at: userCoupon.expireAt,
            days_remaining: daysRemaining,
            order_id: userCoupon.orderId,
        };
    }
}

module.exports = new CouponFormatter();
