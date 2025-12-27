# 套餐管理模块 (Plans)

## 概述

套餐管理模块提供完整的套餐 CRUD 操作、统计分析和格式化功能。

## 目录结构

```
src/services/plans/
├── planService.js        # 套餐核心服务（CRUD）
├── planStatsService.js   # 套餐统计服务
├── planFormatter.js      # 格式化工具
├── index.js              # 模块导出入口
└── README.md             # 模块文档
```

## 模块说明

### planService.js

套餐核心服务，提供 CRUD 操作：

- `getPlans(options)` - 获取套餐列表
- `getPlanById(planId, includeStats)` - 获取套餐详情
- `createPlan(data, adminId)` - 创建套餐
- `updatePlan(planId, data, adminId)` - 更新套餐
- `deletePlan(planId, force, adminId)` - 删除套餐
- `togglePlanStatus(planId, newStatus, adminId)` - 上下架套餐

### planStatsService.js

套餐统计服务，提供分析功能：

- `getPlanStats(planId)` - 获取单个套餐统计
- `getAllPlansStats()` - 获取所有套餐汇总统计
- `getPlanRevenueTrend(planId, days)` - 获取收入趋势

### planFormatter.js

格式化工具：

- `formatPlanResponse(plan, includeHighlights)` - 格式化套餐响应
- `generateFeatureHighlights(features)` - 生成功能亮点列表

## 使用示例

```javascript
// 方式1：导入整个模块
const plans = require('./services/plans')
const allPlans = await plans.getPlans({ status: 'active' })
const stats = await plans.getPlanStats('basic_monthly')

// 方式2：导入具体服务
const { planService, planStatsService } = require('./services/plans')
const plan = await planService.getPlanById('pro_yearly')
const trend = await planStatsService.getPlanRevenueTrend('pro_yearly', 30)

// 方式3：直接导入方法
const { getPlans, createPlan } = require('./services/plans')
const newPlan = await createPlan({
  id: 'enterprise_monthly',
  name: '企业版',
  type: 'subscription',
  price: 999,
  features: { /* ... */ }
}, 'admin_001')
```

## 数据存储

- **PostgreSQL**：套餐配置、订阅记录、订单数据
- **Redis**：热点数据缓存（可选）

## API 路由

套餐相关的 API 端点定义在 `src/routes/planRoutes.js`：

### 公开接口

- `GET /api/v1/plans` - 获取套餐列表
- `GET /api/v1/plans/:id` - 获取套餐详情

### 管理员接口

- `GET /api/v1/plans/admin/list` - 管理员获取所有套餐
- `POST /api/v1/plans/admin` - 创建套餐
- `PUT /api/v1/plans/admin/:id` - 更新套餐
- `DELETE /api/v1/plans/admin/:id` - 删除套餐
- `POST /api/v1/plans/admin/:id/toggle` - 上下架套餐
- `GET /api/v1/plans/admin/:id/stats` - 获取套餐统计

## 套餐字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 套餐唯一标识 |
| name | String | 套餐名称 |
| description | String | 套餐描述 |
| type | String | 类型：subscription / one-time |
| price | Decimal | 价格 |
| originalPrice | Decimal | 原价 |
| currency | String | 货币（默认 CNY） |
| billingCycle | String | 计费周期：monthly / yearly / lifetime |
| features | JSON | 功能配置 |
| sortOrder | Int | 排序顺序 |
| isPopular | Boolean | 是否热门 |
| isRecommended | Boolean | 是否推荐 |
| badgeText | String | 标签文本 |
| badgeColor | String | 标签颜色 |
| trialDays | Int | 试用天数 |
| discount | JSON | 优惠配置 |
| status | String | 状态：active / inactive / archived |

## features 配置示例

```json
{
  "quota": {
    "daily_requests": 1000,
    "monthly_tokens": 10000000,
    "concurrent_requests": 5
  },
  "services": {
    "claude_code": true,
    "gemini_cli": true,
    "codex": false,
    "droid": false
  },
  "models": {
    "allowed": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    "excluded": []
  },
  "api": {
    "enabled": true,
    "rate_limit": 100
  },
  "advanced": {
    "priority_queue": false,
    "team_sharing": false,
    "custom_domain": false
  }
}
```
