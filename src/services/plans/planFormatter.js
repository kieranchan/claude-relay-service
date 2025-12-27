/**
 * 套餐格式化工具
 * 提供套餐数据的格式化和转换功能
 */

/**
 * 格式化套餐响应
 * @param {Object} plan - Prisma 返回的套餐对象
 * @param {boolean} includeHighlights - 是否包含功能亮点
 * @returns {Object}
 */
function formatPlanResponse(plan, includeHighlights = false) {
  const response = {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    type: plan.type,
    price: parseFloat(plan.price),
    original_price: plan.originalPrice ? parseFloat(plan.originalPrice) : null,
    currency: plan.currency,
    billing_cycle: plan.billingCycle,
    features: plan.features,
    sort_order: plan.sortOrder,
    is_popular: plan.isPopular,
    is_recommended: plan.isRecommended,
    badge_text: plan.badgeText,
    badge_color: plan.badgeColor,
    trial_days: plan.trialDays,
    discount: plan.discount,
    status: plan.status,
    subscribers_count: plan.subscribersCount,
    total_revenue: parseFloat(plan.totalRevenue),
    created_at: plan.createdAt,
    updated_at: plan.updatedAt
  }

  // 添加统计计数（如果存在）
  if (plan._count) {
    response.subscriptions_count = plan._count.subscriptions
    response.orders_count = plan._count.orders
  }

  // 生成功能亮点
  if (includeHighlights && plan.features) {
    response.feature_highlights = generateFeatureHighlights(plan.features)
  }

  return response
}

/**
 * 生成功能亮点列表
 * @param {Object} features - 功能配置
 * @returns {Array<string>}
 */
function generateFeatureHighlights(features) {
  const highlights = []

  if (features.quota) {
    if (features.quota.daily_requests) {
      highlights.push(`每日 ${features.quota.daily_requests} 次请求`)
    }
    if (features.quota.monthly_tokens) {
      const tokens = features.quota.monthly_tokens
      const formatted =
        tokens >= 1000000 ? `${(tokens / 1000000).toFixed(0)}M` : `${(tokens / 1000).toFixed(0)}K`
      highlights.push(`每月 ${formatted} Token`)
    }
    if (features.quota.concurrent_requests) {
      highlights.push(`${features.quota.concurrent_requests} 并发请求`)
    }
  }

  if (features.services) {
    const services = []
    if (features.services.claude_code) {
      services.push('Claude Code')
    }
    if (features.services.gemini_cli) {
      services.push('Gemini CLI')
    }
    if (features.services.codex) {
      services.push('Codex')
    }
    if (features.services.droid) {
      services.push('Droid')
    }
    if (services.length > 0) {
      highlights.push(`支持 ${services.join('、')}`)
    }
  }

  if (features.api && features.api.enabled) {
    highlights.push('API 访问')
  }

  if (features.advanced) {
    if (features.advanced.priority_queue) {
      highlights.push('优先队列')
    }
    if (features.advanced.team_sharing) {
      highlights.push('团队共享')
    }
  }

  return highlights
}

module.exports = {
  formatPlanResponse,
  generateFeatureHighlights
}
