/**
 * 套餐管理服务（兼容层）
 *
 * 此文件保留用于向后兼容
 * 新代码请使用: require('./plans')
 *
 * @deprecated 请使用 src/services/plans/ 模块
 */

const plans = require('./plans')

// 重新导出所有方法
module.exports = {
  getPlans: plans.getPlans,
  getPlanById: plans.getPlanById,
  createPlan: plans.createPlan,
  updatePlan: plans.updatePlan,
  deletePlan: plans.deletePlan,
  togglePlanStatus: plans.togglePlanStatus,
  getPlanStats: plans.getPlanStats
}
