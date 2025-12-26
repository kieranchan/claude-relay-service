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
 */
async function connectDatabase() {
  try {
    const client = getPrismaClient()
    await client.$connect()
    logger.info('🗄️  PostgreSQL connected successfully')
    return true
  } catch (error) {
    logger.error('❌ PostgreSQL connection failed:', error.message)
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

module.exports = {
  getPrismaClient,
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  healthCheck
}
