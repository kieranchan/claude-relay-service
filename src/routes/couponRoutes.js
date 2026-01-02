/**
 * 优惠券用户端路由
 * 处理用户领取、查看、验证优惠券
 */

const express = require('express')
const router = express.Router()
const couponService = require('../services/coupons')
const { authenticateJwt } = require('../middleware/authenticateJwt')

/**
 * GET /api/v1/coupons/available
 * 获取可领取的优惠券列表
 */
router.get('/available', authenticateJwt, async (req, res) => {
  try {
    const userId = req.emailUser.id
    const coupons = await couponService.getAvailableCoupons(userId)

    res.json({
      success: true,
      data: coupons
    })
  } catch (error) {
    console.error('获取可领取优惠券失败:', error)
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
 * GET /api/v1/coupons/my
 * 获取我的优惠券列表
 */
router.get('/my', authenticateJwt, async (req, res) => {
  try {
    const userId = req.emailUser.id
    const { status } = req.query
    const coupons = await couponService.getMyCoupons(userId, status)

    res.json({
      success: true,
      data: coupons
    })
  } catch (error) {
    console.error('获取我的优惠券失败:', error)
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
 * POST /api/v1/coupons/receive/:id
 * 领取优惠券
 */
router.post('/receive/:id', authenticateJwt, async (req, res) => {
  try {
    const userId = req.emailUser.id
    const couponId = req.params.id
    const result = await couponService.receiveCoupon(userId, couponId)

    res.json({
      success: true,
      message: '优惠券领取成功',
      data: result
    })
  } catch (error) {
    console.error('领取优惠券失败:', error)

    // 根据错误类型返回不同的错误码
    let code = 'RECEIVE_FAILED'
    if (error.message.includes('不存在')) {
      code = 'COUPON_NOT_FOUND'
    } else if (error.message.includes('已领取')) {
      code = 'COUPON_ALREADY_RECEIVED'
    } else if (error.message.includes('领完')) {
      code = 'COUPON_LIMIT_REACHED'
    } else if (error.message.includes('过期')) {
      code = 'COUPON_EXPIRED'
    }

    res.status(400).json({
      success: false,
      error: {
        code,
        message: error.message
      }
    })
  }
})

/**
 * POST /api/v1/coupons/exchange
 * 兑换优惠码
 */
router.post('/exchange', authenticateJwt, async (req, res) => {
  try {
    const userId = req.emailUser.id
    const { code } = req.body

    if (!code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CODE',
          message: '请输入优惠码'
        }
      })
    }

    const result = await couponService.exchangeCode(userId, code)

    res.json({
      success: true,
      message: '优惠码兑换成功',
      data: result
    })
  } catch (error) {
    console.error('兑换优惠码失败:', error)

    let code = 'EXCHANGE_FAILED'
    if (error.message.includes('无效')) {
      code = 'INVALID_COUPON_CODE'
    } else if (error.message.includes('已兑换')) {
      code = 'CODE_ALREADY_USED'
    }

    res.status(400).json({
      success: false,
      error: {
        code,
        message: error.message
      }
    })
  }
})

/**
 * POST /api/v1/coupons/validate
 * 验证优惠券（下单前调用）
 */
router.post('/validate', authenticateJwt, async (req, res) => {
  try {
    const userId = req.emailUser.id
    const { coupon_code, plan_id, amount } = req.body

    if (!coupon_code || !plan_id || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: '缺少必要参数'
        }
      })
    }

    const result = await couponService.validate(coupon_code, userId, plan_id, parseFloat(amount))

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('验证优惠券失败:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATE_FAILED',
        message: error.message
      }
    })
  }
})

module.exports = router
