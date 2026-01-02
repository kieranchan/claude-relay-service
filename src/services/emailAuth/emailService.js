/**
 * 邮件服务
 * 处理邮箱验证、密码重置等邮件发送
 */

const nodemailer = require('nodemailer')
const crypto = require('crypto')
const redis = require('../../models/redis')
const logger = require('../../utils/logger')

// Redis Key 前缀
const KEYS = {
  VERIFY_TOKEN: 'email_verify_token:',
  RESET_TOKEN: 'password_reset_token:'
}

// Token 有效期（秒）
const TOKEN_TTL = {
  VERIFY: 24 * 60 * 60, // 24小时
  RESET: 60 * 60 // 1小时
}

class EmailService {
  constructor() {
    this.transporter = null
    this.isConfigured = false
    this.initTransporter()
  }

  /**
   * 初始化邮件传输器
   */
  initTransporter() {
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASSWORD

    if (!host || !user || !pass) {
      logger.warn('⚠️ SMTP configuration incomplete. Email sending disabled.')
      this.isConfigured = false
      return
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port) || 587,
        secure: parseInt(port) === 465,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        }
      })

      this.isConfigured = true
      logger.info('✅ SMTP transporter initialized')
    } catch (error) {
      logger.error('❌ Failed to initialize SMTP transporter:', error)
      this.isConfigured = false
    }
  }

  /**
   * 生成随机 Token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * 获取发件人地址
   */
  getFromAddress() {
    return process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@example.com'
  }

  /**
   * 获取应用 URL
   */
  getAppUrl() {
    return process.env.APP_URL || 'http://localhost:3000'
  }

  /**
   * 生成并存储邮箱验证 Token
   * @param {string} userId
   * @param {string} email
   * @returns {Promise<string>} 验证 Token
   */
  async createVerificationToken(userId, email) {
    const token = this.generateToken()

    const tokenData = {
      userId,
      email,
      created_at: new Date().toISOString()
    }

    await redis.setex(`${KEYS.VERIFY_TOKEN}${token}`, TOKEN_TTL.VERIFY, JSON.stringify(tokenData))

    logger.debug(`📧 Created verification token for: ${email}`)
    return token
  }

  /**
   * 验证邮箱验证 Token
   * @param {string} token
   * @returns {Promise<Object|null>} Token 数据或 null
   */
  async verifyEmailToken(token) {
    const tokenDataStr = await redis.get(`${KEYS.VERIFY_TOKEN}${token}`)
    if (!tokenDataStr) {
      return null
    }

    // 验证后删除 Token（一次性使用）
    await redis.del(`${KEYS.VERIFY_TOKEN}${token}`)

    try {
      return JSON.parse(tokenDataStr)
    } catch (error) {
      logger.error('Failed to parse verification token data:', error)
      return null
    }
  }

  /**
   * 生成并存储密码重置 Token
   * @param {string} userId
   * @param {string} email
   * @returns {Promise<string>} 重置 Token
   */
  async createPasswordResetToken(userId, email) {
    const token = this.generateToken()

    const tokenData = {
      userId,
      email,
      created_at: new Date().toISOString()
    }

    await redis.setex(`${KEYS.RESET_TOKEN}${token}`, TOKEN_TTL.RESET, JSON.stringify(tokenData))

    logger.debug(`🔐 Created password reset token for: ${email}`)
    return token
  }

  /**
   * 验证密码重置 Token
   * @param {string} token
   * @returns {Promise<Object|null>} Token 数据或 null
   */
  async verifyPasswordResetToken(token) {
    const tokenDataStr = await redis.get(`${KEYS.RESET_TOKEN}${token}`)
    if (!tokenDataStr) {
      return null
    }

    // 验证后删除 Token（一次性使用）
    await redis.del(`${KEYS.RESET_TOKEN}${token}`)

    try {
      return JSON.parse(tokenDataStr)
    } catch (error) {
      logger.error('Failed to parse reset token data:', error)
      return null
    }
  }

  /**
   * 发送邮箱验证邮件
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async sendVerificationEmail(email, token) {
    if (!this.isConfigured) {
      logger.warn(`⚠️ Email not configured. Verification token for ${email}: ${token}`)
      return false
    }

    const verifyLink = `${this.getAppUrl()}/verify-email?token=${token}`

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: '验证您的邮箱 - Claude Relay Service',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; }
              .content { background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0; }
              .button { display: inline-block; background: #2563eb; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>欢迎注册！</h1>
              </div>
              <div class="content">
                <p>感谢您注册 Claude Relay Service。</p>
                <p>请点击下面的按钮验证您的邮箱地址：</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${verifyLink}" class="button">验证邮箱</a>
                </p>
                <p>或复制以下链接到浏览器：</p>
                <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 12px;">${verifyLink}</p>
                <p style="color: #6b7280; font-size: 14px;">此链接将在 24 小时后失效。</p>
              </div>
              <div class="footer">
                <p>如果您没有注册此账户，请忽略此邮件。</p>
              </div>
            </div>
          </body>
          </html>
        `
      })

      logger.info(`📧 Verification email sent to: ${email}`)
      return true
    } catch (error) {
      logger.error(`❌ Failed to send verification email to ${email}:`, error)
      return false
    }
  }

  /**
   * 发送密码重置邮件
   * @param {string} email
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async sendPasswordResetEmail(email, token) {
    if (!this.isConfigured) {
      logger.warn(`⚠️ Email not configured. Reset token for ${email}: ${token}`)
      return false
    }

    const resetLink = `${this.getAppUrl()}/reset-password?token=${token}`

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: '重置您的密码 - Claude Relay Service',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 20px 0; }
              .content { background: #f9fafb; border-radius: 8px; padding: 30px; margin: 20px 0; }
              .button { display: inline-block; background: #dc2626; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
              .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 12px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>密码重置请求</h1>
              </div>
              <div class="content">
                <p>我们收到了重置您密码的请求。</p>
                <p>请点击下面的按钮重置您的密码：</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" class="button">重置密码</a>
                </p>
                <p>或复制以下链接到浏览器：</p>
                <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 12px;">${resetLink}</p>
                <div class="warning">
                  <strong>⚠️ 安全提示：</strong>
                  <p style="margin: 5px 0 0 0;">此链接将在 1 小时后失效。如果您没有请求重置密码，请忽略此邮件。</p>
                </div>
              </div>
              <div class="footer">
                <p>这是一封自动发送的邮件，请勿直接回复。</p>
              </div>
            </div>
          </body>
          </html>
        `
      })

      logger.info(`📧 Password reset email sent to: ${email}`)
      return true
    } catch (error) {
      logger.error(`❌ Failed to send password reset email to ${email}:`, error)
      return false
    }
  }

  /**
   * 发送通用邮件
   * @param {Object} options
   * @param {string} options.to - 收件人
   * @param {string} options.subject - 主题
   * @param {string} options.html - HTML内容
   * @param {string} [options.text] - 纯文本内容（可选）
   * @returns {Promise<boolean>}
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.isConfigured) {
      logger.warn(`⚠️ Email not configured. Skipping email to: ${to}`)
      return false
    }

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        html,
        text
      })

      logger.info(`📧 Email sent to: ${to} | Subject: ${subject}`)
      return true
    } catch (error) {
      logger.error(`❌ Failed to send email to ${to}:`, error)
      throw error // Re-throw to let caller handle failure
    }
  }

  /**
   * 测试 SMTP 连接
   * @returns {Promise<Object>}
   */
  async testConnection() {
    if (!this.isConfigured) {
      return { success: false, message: 'SMTP not configured' }
    }

    try {
      await this.transporter.verify()
      return { success: true, message: 'SMTP connection successful' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }

  /**
   * 获取邮件服务配置状态
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured,
      host: process.env.SMTP_HOST || 'not set',
      port: process.env.SMTP_PORT || 'not set',
      from: this.getFromAddress()
    }
  }
}

module.exports = new EmailService()
