/**
 * Prisma 数据库连接管理
 * PostgreSQL + Redis 混合架构的数据库层
 */

const { PrismaClient } = require('@prisma/client')
const logger = require('../utils/logger')

// 创建 Prisma Client 单例
let prisma = null

/**
 * 获取 Prisma Client 实例
 * @returns {PrismaClient}
 */
function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' }
      ]
    })

    // 开发环境下记录查询日志
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug('Prisma Query:', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`
        })
      })
    }
  }
  return prisma
}

/**
 * 连接数据库
 * @param {Object} options - 连接选项
 * @param {boolean} options.silent - 是否静默模式（不输出日志）
 * @returns {Promise<boolean>}
 */
async function connectDatabase(options = {}) {
  const { silent = false } = options
  try {
    const client = getPrismaClient()
    await client.$connect()
    if (!silent) {
      logger.info('🗄️  PostgreSQL connected successfully')
    }
    return true
  } catch (error) {
    const errorMsg = `❌ PostgreSQL connection failed: ${error.message || error}`
    if (!silent) {
      logger.error(errorMsg)
    } else {
      console.error(errorMsg)
    }
    // 输出完整错误堆栈便于调试
    if (process.env.DEBUG_DB === 'true') {
      console.error('Full error:', error)
    }
    return false
  }
}

/**
 * 断开数据库连接
 */
async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
    logger.info('🗄️  PostgreSQL disconnected')
  }
}

/**
 * 检查数据库连接状态
 */
async function isDatabaseConnected() {
  try {
    const client = getPrismaClient()
    await client.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

/**
 * 执行数据库健康检查
 */
async function healthCheck() {
  try {
    const client = getPrismaClient()
    const start = Date.now()
    await client.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    return {
      status: 'healthy',
      latency: `${latency}ms`
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    }
  }
}

// 创建一个代理对象，确保始终返回最新的 Prisma Client 实例
const prismaProxy = new Proxy(
  {},
  {
    get(target, prop) {
      const client = getPrismaClient()
      return client[prop]
    }
  }
)

module.exports = {
  // 直接导出 prisma 实例（通过代理）
  prisma: prismaProxy,
  // 保持向后兼容的函数导出
  getPrismaClient,
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  healthCheck
}
