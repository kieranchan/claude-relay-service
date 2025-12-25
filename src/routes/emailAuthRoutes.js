/**
 * 邮箱认证路由
 * 处理用户注册、登录、登出、邮箱验证、密码重置等
 *
 * 路由前缀: /api/v1/auth
 */

const express = require('express')
const { body, validationResult } = require('express-validator')
const router = express.Router()
const { emailAuthService } = require('../services/emailAuth')
const { authenticateJwt } = require('../middleware/authenticateJwt')
const logger = require('../utils/logger')

// ===========================
// 输入验证规则
// ===========================

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('请提供有效的邮箱地址'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为8个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含大小写字母和数字'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('两次输入的密码不一致')
    }
    return true
  })
]

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('请提供有效的邮箱地址'),
  body('password').notEmpty().withMessage('请输入密码')
]

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('请提供重置令牌'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为8个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含大小写字母和数字'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('两次输入的密码不一致')
    }
    return true
  })
]

const changePasswordValidation = [
  body('oldPassword').notEmpty().withMessage('请输入当前密码'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('新密码长度至少为8个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('新密码必须包含大小写字母和数字'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('两次输入的密码不一致')
    }
    return true
  })
]

// ===========================
// 验证错误处理
// ===========================

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '输入验证失败',
        details: errors.array()
      }
    })
  }
  next()
}

// ===========================
// 路由定义
// ===========================

/**
 * POST /api/v1/auth/register
 * 用户注册
 */
router.post('/register', registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body

    const result = await emailAuthService.register({ email, password })

    res.status(201).json(result)
  } catch (error) {
    logger.error('Registration error:', error)

    if (error.code === 'AUTH_001') {
      return res.status(409).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '注册过程中发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body
    const ip = req.ip || req.connection?.remoteAddress || 'unknown'

    const result = await emailAuthService.login({ email, password, ip })

    res.json(result)
  } catch (error) {
    logger.error('Login error:', error)

    // 处理各种登录错误
    if (error.code === 'AUTH_003') {
      res.set('Retry-After', String(error.retryAfter || 900))
      return res.status(429).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    if (error.code === 'AUTH_002') {
      return res.status(403).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    if (error.code === 'AUTH_INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    if (error.code === 'AUTH_SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '登录过程中发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/logout
 * 用户登出
 */
router.post('/logout', authenticateJwt, async (req, res) => {
  try {
    const { accessToken } = req
    const { refreshToken } = req.body

    const result = await emailAuthService.logout(accessToken, refreshToken)

    logger.info(`👋 Email user logout: ${req.emailUser.email}`)

    res.json(result)
  } catch (error) {
    logger.error('Logout error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '登出过程中发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/refresh
 * 刷新 Access Token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供刷新令牌' }
      })
    }

    const result = await emailAuthService.refreshToken(refreshToken)

    res.json(result)
  } catch (error) {
    logger.error('Token refresh error:', error)

    if (error.code === 'AUTH_REFRESH_INVALID') {
      return res.status(401).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '刷新令牌过程中发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/verify-email
 * 验证邮箱
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供验证令牌' }
      })
    }

    const result = await emailAuthService.verifyEmail(token)

    res.json(result)
  } catch (error) {
    logger.error('Email verification error:', error)

    if (error.code === 'AUTH_TOKEN_INVALID' || error.code === 'AUTH_USER_NOT_FOUND') {
      return res.status(400).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '邮箱验证过程中发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/resend-verification
 * 重发验证邮件
 */
router.post('/resend-verification', authenticateJwt, async (req, res) => {
  try {
    const result = await emailAuthService.resendVerificationEmail(req.emailUser.id)

    res.json(result)
  } catch (error) {
    logger.error('Resend verification error:', error)

    if (error.code === 'AUTH_ALREADY_VERIFIED') {
      return res.status(400).json({
        success: false,
        error: { code: error.code, message: error.message }
      })
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '发送验证邮件过程中发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/forgot-password
 * 忘记密码（发送重置邮件）
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请提供邮箱地址' }
      })
    }

    const result = await emailAuthService.forgotPassword(email)

    // 无论邮箱是否存在都返回成功（防止邮箱枚举）
    res.json(result)
  } catch (error) {
    logger.error('Forgot password error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '处理密码重置请求时发生错误' }
    })
  }
})

/**
 * POST /api/v1/auth/reset-password
 * 重置密码
 */
router.post(
  '/reset-password',
  resetPasswordValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { token, password } = req.body

      const result = await emailAuthService.resetPassword({ token, password })

      res.json(result)
    } catch (error) {
      logger.error('Reset password error:', error)

      if (error.code === 'AUTH_TOKEN_INVALID' || error.code === 'AUTH_USER_NOT_FOUND') {
        return res.status(400).json({
          success: false,
          error: { code: error.code, message: error.message }
        })
      }

      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: '重置密码过程中发生错误' }
      })
    }
  }
)

/**
 * POST /api/v1/auth/change-password
 * 修改密码（已登录用户）
 */
router.post(
  '/change-password',
  authenticateJwt,
  changePasswordValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body

      const result = await emailAuthService.changePassword({
        userId: req.emailUser.id,
        oldPassword,
        newPassword
      })

      res.json(result)
    } catch (error) {
      logger.error('Change password error:', error)

      if (error.code === 'AUTH_INVALID_PASSWORD') {
        return res.status(400).json({
          success: false,
          error: { code: error.code, message: error.message }
        })
      }

      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: '修改密码过程中发生错误' }
      })
    }
  }
)

/**
 * GET /api/v1/auth/check
 * 检查登录状态
 */
router.get('/check', authenticateJwt, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.emailUser
      }
    })
  } catch (error) {
    logger.error('Auth check error:', error)
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: '检查登录状态时发生错误' }
    })
  }
})

module.exports = router
