/**
 * 支付模块导出
 */

const paymentService = require('./paymentService')

module.exports = {
  paymentService,
  // 直接导出常用方法
  getAvailablePaymentMethods: paymentService.getAvailablePaymentMethods,
  initiatePayment: paymentService.initiatePayment,
  handlePaymentCallback: paymentService.handlePaymentCallback
}
