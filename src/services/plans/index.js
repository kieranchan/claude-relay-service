/**
 * 套餐管理模块
 * 导出所有相关服务
 */

const planService = require('./planService')
const planStatsService = require('./planStatsService')
const planFormatter = require('./planFormatter')

module.exports = {
  // 核心服务
  planService,
  planStatsService,
  planFormatter,

  // 直接导出常用方法（便于使用）
  getPlans: planService.getPlans,
  getPlanById: planService.getPlanById,
  createPlan: planService.createPlan,
  updatePlan: planService.updatePlan,
  deletePlan: planService.deletePlan,
  togglePlanStatus: planService.togglePlanStatus,

  // 统计方法
  getPlanStats: planStatsService.getPlanStats,
  getAllPlansStats: planStatsService.getAllPlansStats,
  getPlanRevenueTrend: planStatsService.getPlanRevenueTrend,

  // 格式化方法
  formatPlanResponse: planFormatter.formatPlanResponse,
  generateFeatureHighlights: planFormatter.generateFeatureHighlights
}
