/**
 * 邮箱认证模块
 * 导出所有相关服务
 */

const emailAuthService = require('./emailAuthService')
const emailUserService = require('./emailUserService')
const tokenService = require('./tokenService')
const emailService = require('./emailService')

module.exports = {
  emailAuthService,
  emailUserService,
  tokenService,
  emailService
}
