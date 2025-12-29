/**
 * 优惠券模块导出
 */

const couponService = require('./couponService');
const couponStatsService = require('./couponStatsService');
const couponFormatter = require('./couponFormatter');

module.exports = {
    // 导出子服务
    couponService,
    couponStatsService,
    couponFormatter,

    // 保持向后兼容的接口（直接从 couponService 导出所有方法）
    getAvailableCoupons: couponService.getAvailableCoupons.bind(couponService),
    getMyCoupons: couponService.getMyCoupons.bind(couponService),
    receiveCoupon: couponService.receiveCoupon.bind(couponService),
    exchangeCode: couponService.exchangeCode.bind(couponService),
    validate: couponService.validate.bind(couponService),
    calculateDiscount: couponService.calculateDiscount.bind(couponService),
    useCoupon: couponService.useCoupon.bind(couponService),
    createCoupon: couponService.createCoupon.bind(couponService),
    updateCoupon: couponService.updateCoupon.bind(couponService),
    deleteCoupon: couponService.deleteCoupon.bind(couponService),
    getCoupons: couponService.getCoupons.bind(couponService),
    distributeCoupons: couponService.distributeCoupons.bind(couponService),
    markExpiredCoupons: couponService.markExpiredCoupons.bind(couponService),

    // 统计服务方法
    getCouponStats: couponStatsService.getCouponStats.bind(couponStatsService),

    // 格式化方法
    formatCoupon: couponFormatter.formatCoupon.bind(couponFormatter),
    formatUserCoupon: couponFormatter.formatUserCoupon.bind(couponFormatter),
};
