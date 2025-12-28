/**
 * 订单模块导出
 */

const orderService = require('./orderService')

module.exports = {
  orderService,
  // 直接导出常用方法
  createOrder: orderService.createOrder,
  getOrderById: orderService.getOrderById,
  getOrdersByUserId: orderService.getOrdersByUserId,
  cancelOrder: orderService.cancelOrder,
  updatePaymentInfo: orderService.updatePaymentInfo,
  handlePaymentSuccess: orderService.handlePaymentSuccess,
  processExpiredOrders: orderService.processExpiredOrders
}
