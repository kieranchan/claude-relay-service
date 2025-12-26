/**
 * 套餐管理路由
 * 提供套餐的 API 端点
 */

const express = require('express')
const { body, param, query, validationResult } = require('express-validator')
const planService = require('../services/planService')
const { authenticateAdmin } = require('../middleware/auth')
const logger = require('../utils/logger')

const router = express.Router()

// ========================================
// 公开接口（无需认证）
// ========================================

/**
 * GET /api/v1/plans
 * 获取套餐列表
 */
router.get(
  '/',
  [
    query('billing_cycle')
      .optional()
      .isIn(['monthly', 'yearly', 'lifetime'])
      .withMessage('无效的计费周期')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: errors.array()
          }
        })
      }

      const options = {
        status: 'active', // 公开接口只返回活跃套餐
        billingCycle: req.query.billing_cycle
      }

      const plans = await planService.getPlans(options)

      res.json({
        success: true,
        data: plans,
        meta: {
          total: plans.length
        }
      })
    } catch (error) {
      logger.error('获取套餐列表失败:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误'
        }
      })
    }
  }
)

/**
 * GET /api/v1/plans/:id
 * 获取套餐详情
 */
router.get('/:id', [param('id').notEmpty().withMessage('套餐ID不能为空')], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          details: errors.array()
        }
      })
    }

    const plan = await planService.getPlanById(req.params.id, true)

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: '套餐不存在'
        }
      })
    }

    // 公开接口不返回下架的套餐
    if (plan.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: '套餐不存在'
        }
      })
    }

    res.json({
      success: true,
      data: plan
    })
  } catch (error) {
    logger.error('获取套餐详情失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    })
  }
})

// ========================================
// 管理员接口（需要认证）
// ========================================

/**
 * GET /api/v1/admin/plans
 * 管理员获取所有套餐（包括下架的）
 */
router.get('/admin/list', authenticateAdmin, async (req, res) => {
  try {
    const options = {
      status: req.query.status || 'all',
      billingCycle: req.query.billing_cycle,
      includeStats: true
    }

    const plans = await planService.getPlans(options)

    res.json({
      success: true,
      data: plans,
      meta: {
        total: plans.length
      }
    })
  } catch (error) {
    logger.error('管理员获取套餐列表失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    })
  }
})

/**
 * POST /api/v1/admin/plans
 * 创建套餐
 */
router.post(
  '/admin',
  authenticateAdmin,
  [
    body('id')
      .notEmpty()
      .withMessage('套餐ID不能为空')
      .matches(/^[a-z0-9_]+$/)
      .withMessage('套餐ID只能包含小写字母、数字和下划线'),
    body('name').notEmpty().withMessage('套餐名称不能为空'),
    body('type').isIn(['subscription', 'one-time']).withMessage('无效的套餐类型'),
    body('price').isFloat({ min: 0 }).withMessage('价格必须是非负数'),
    body('features').isObject().withMessage('功能配置必须是对象'),
    body('billing_cycle')
      .optional()
      .isIn(['monthly', 'yearly', 'lifetime'])
      .withMessage('无效的计费周期'),
    body('trial_days').optional().isInt({ min: 0 }).withMessage('试用天数必须是非负整数')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: errors.array()
          }
        })
      }

      const planData = {
        id: req.body.id,
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        price: req.body.price,
        originalPrice: req.body.original_price,
        currency: req.body.currency,
        billingCycle: req.body.billing_cycle,
        features: req.body.features,
        sortOrder: req.body.sort_order,
        isPopular: req.body.is_popular,
        isRecommended: req.body.is_recommended,
        badgeText: req.body.badge_text,
        badgeColor: req.body.badge_color,
        trialDays: req.body.trial_days,
        discount: req.body.discount,
        status: req.body.status
      }

      const plan = await planService.createPlan(planData, req.admin?.id)

      res.status(201).json({
        success: true,
        data: plan,
        message: '套餐创建成功'
      })
    } catch (error) {
      logger.error('创建套餐失败:', error)

      if (error.message === '套餐ID已存在') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'PLAN_EXISTS',
            message: error.message
          }
        })
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || '服务器内部错误'
        }
      })
    }
  }
)

/**
 * PUT /api/v1/admin/plans/:id
 * 更新套餐
 */
router.put(
  '/admin/:id',
  authenticateAdmin,
  [
    param('id').notEmpty().withMessage('套餐ID不能为空'),
    body('price').optional().isFloat({ min: 0 }).withMessage('价格必须是非负数'),
    body('trial_days').optional().isInt({ min: 0 }).withMessage('试用天数必须是非负整数')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: errors.array()
          }
        })
      }

      const updateData = {}
      const fieldMapping = {
        name: 'name',
        description: 'description',
        price: 'price',
        original_price: 'originalPrice',
        currency: 'currency',
        billing_cycle: 'billingCycle',
        features: 'features',
        sort_order: 'sortOrder',
        is_popular: 'isPopular',
        is_recommended: 'isRecommended',
        badge_text: 'badgeText',
        badge_color: 'badgeColor',
        trial_days: 'trialDays',
        discount: 'discount',
        status: 'status'
      }

      for (const [apiField, serviceField] of Object.entries(fieldMapping)) {
        if (req.body[apiField] !== undefined) {
          updateData[serviceField] = req.body[apiField]
        }
      }

      const plan = await planService.updatePlan(req.params.id, updateData, req.admin?.id)

      res.json({
        success: true,
        data: plan,
        message: '套餐更新成功'
      })
    } catch (error) {
      logger.error('更新套餐失败:', error)

      if (error.message === '套餐不存在') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: error.message
          }
        })
      }

      if (error.message.includes('不能修改核心功能配置')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_MODIFY',
            message: error.message
          }
        })
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || '服务器内部错误'
        }
      })
    }
  }
)

/**
 * DELETE /api/v1/admin/plans/:id
 * 删除套餐
 */
router.delete(
  '/admin/:id',
  authenticateAdmin,
  [param('id').notEmpty().withMessage('套餐ID不能为空')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: errors.array()
          }
        })
      }

      const force = req.query.force === 'true'
      await planService.deletePlan(req.params.id, force, req.admin?.id)

      res.json({
        success: true,
        message: '套餐删除成功'
      })
    } catch (error) {
      logger.error('删除套餐失败:', error)

      if (error.message === '套餐不存在') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: error.message
          }
        })
      }

      if (error.message.includes('活跃订阅')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'HAS_ACTIVE_SUBSCRIBERS',
            message: error.message
          }
        })
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || '服务器内部错误'
        }
      })
    }
  }
)

/**
 * POST /api/v1/admin/plans/:id/toggle
 * 上下架套餐
 */
router.post(
  '/admin/:id/toggle',
  authenticateAdmin,
  [
    param('id').notEmpty().withMessage('套餐ID不能为空'),
    body('status').isIn(['active', 'inactive']).withMessage('状态必须是 active 或 inactive')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: errors.array()
          }
        })
      }

      const plan = await planService.togglePlanStatus(req.params.id, req.body.status, req.admin?.id)

      res.json({
        success: true,
        data: plan,
        message: `套餐已${req.body.status === 'active' ? '上架' : '下架'}`
      })
    } catch (error) {
      logger.error('切换套餐状态失败:', error)

      if (error.message === '套餐不存在') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: error.message
          }
        })
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || '服务器内部错误'
        }
      })
    }
  }
)

/**
 * GET /api/v1/admin/plans/:id/stats
 * 获取套餐统计
 */
router.get(
  '/admin/:id/stats',
  authenticateAdmin,
  [param('id').notEmpty().withMessage('套餐ID不能为空')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: errors.array()
          }
        })
      }

      const stats = await planService.getPlanStats(req.params.id)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('获取套餐统计失败:', error)

      if (error.message === '套餐不存在') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: error.message
          }
        })
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || '服务器内部错误'
        }
      })
    }
  }
)

module.exports = router
