/**
 * 优惠券管理端路由
 * 处理优惠券的创建、更新、删除、统计等管理功能
 */

const express = require('express')
const router = express.Router()
const couponService = require('../../services/coupons')
const { authenticateAdmin } = require('../../middleware/auth')

// 所有路由需要管理员认证
router.use(authenticateAdmin)

/**
 * GET /admin/coupons
 * 获取优惠券列表
 */
router.get('/', async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query
    const result = await couponService.getCoupons({
      status,
      type,
      page: parseInt(page),
      limit: parseInt(limit)
    })

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('获取优惠券列表失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    })
  }
})

/**
 * GET /admin/coupons/:id
 * 获取单个优惠券详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()

    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id }
    })

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COUPON_NOT_FOUND',
          message: '优惠券不存在'
        }
      })
    }

    res.json({
      success: true,
      data: couponService.formatCoupon ? couponService.formatCoupon(coupon) : coupon
    })
  } catch (error) {
    console.error('获取优惠券详情失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    })
  }
})

/**
 * POST /admin/coupons
 * 创建优惠券
 */
router.post('/', async (req, res) => {
  try {
    const adminId = req.admin?.id || null
    const data = req.body

    // 验证必填字段
    if (!data.id || !data.name || !data.type || data.value === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段：id, name, type, value'
        }
      })
    }

    if (!data.start_time || !data.end_time) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段：start_time, end_time'
        }
      })
    }

    if (!data.distribution_type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段：distribution_type'
        }
      })
    }

    const coupon = await couponService.createCoupon(data, adminId)

    res.status(201).json({
      success: true,
      message: '优惠券创建成功',
      data: coupon
    })
  } catch (error) {
    console.error('创建优惠券失败:', error)

    let statusCode = 500
    let code = 'CREATE_FAILED'
    if (error.message.includes('ID已存在')) {
      statusCode = 400
      code = 'COUPON_ID_EXISTS'
    } else if (error.message.includes('优惠码已存在')) {
      statusCode = 400
      code = 'COUPON_CODE_EXISTS'
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: error.message
      }
    })
  }
})

/**
 * PUT /admin/coupons/:id
 * 更新优惠券
 */
router.put('/:id', async (req, res) => {
  try {
    const couponId = req.params.id
    const data = req.body

    const coupon = await couponService.updateCoupon(couponId, data)

    res.json({
      success: true,
      message: '优惠券更新成功',
      data: coupon
    })
  } catch (error) {
    console.error('更新优惠券失败:', error)

    let statusCode = 500
    if (error.message.includes('不存在')) {
      statusCode = 404
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error.message
      }
    })
  }
})

/**
 * DELETE /admin/coupons/:id
 * 删除优惠券
 */
router.delete('/:id', async (req, res) => {
  try {
    const couponId = req.params.id
    const result = await couponService.deleteCoupon(couponId)

    res.json({
      success: true,
      message: result.deleted ? '优惠券已删除' : '优惠券已归档（有使用记录无法删除）',
      data: result
    })
  } catch (error) {
    console.error('删除优惠券失败:', error)

    let statusCode = 500
    if (error.message.includes('不存在')) {
      statusCode = 404
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error.message
      }
    })
  }
})

/**
 * GET /admin/coupons/:id/stats
 * 获取优惠券统计信息
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const couponId = req.params.id
    const stats = await couponService.getCouponStats(couponId)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('获取优惠券统计失败:', error)

    let statusCode = 500
    if (error.message.includes('不存在')) {
      statusCode = 404
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: error.message
      }
    })
  }
})

/**
 * POST /admin/coupons/:id/distribute
 * 批量发放优惠券
 */
router.post('/:id/distribute', async (req, res) => {
  try {
    const couponId = req.params.id
    const { target_type, targets, expire_days } = req.body

    if (!target_type || !targets) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: '缺少必要参数：target_type, targets'
        }
      })
    }

    const result = await couponService.distributeCoupons(
      couponId,
      target_type,
      targets,
      expire_days
    )

    res.json({
      success: true,
      message: '优惠券发放成功',
      data: result
    })
  } catch (error) {
    console.error('批量发放优惠券失败:', error)

    let statusCode = 500
    if (error.message.includes('不存在')) {
      statusCode = 404
    } else if (error.message.includes('没有找到')) {
      statusCode = 400
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'DISTRIBUTE_FAILED',
        message: error.message
      }
    })
  }
})

module.exports = router
