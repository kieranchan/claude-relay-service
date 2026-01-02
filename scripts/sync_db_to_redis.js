const { PrismaClient } = require('@prisma/client')
const redis = require('../src/models/redis')

const prisma = new PrismaClient()

async function main() {
  console.log('--- Syncing API Keys from DB to Redis ---')

  try {
    await redis.connect()

    // Fetch all keys from DB
    const allKeys = await prisma.apiKey.findMany()
    console.log(`Found ${allKeys.length} keys in Database.`)

    let syncedCount = 0

    for (const key of allKeys) {
      // Format for Redis
      const redisKeyData = {
        ...key,
        tokenLimit: key.tokenLimit.toString(),
        expiresAt: key.expiresAt ? key.expiresAt.toISOString() : '',
        createdAt: key.createdAt.toISOString(),
        updatedAt: key.updatedAt.toISOString(),
        isActivated: key.isActivated ? 'true' : 'false',
        activatedAt: key.activatedAt ? key.activatedAt.toISOString() : '',
        isActive: key.isActive ? 'true' : 'false',
        enableModelRestriction: key.enableModelRestriction ? 'true' : 'false',
        enableClientRestriction: key.enableClientRestriction ? 'true' : 'false',
        isDeleted: key.isDeleted ? 'true' : 'false',
        restrictedModels: JSON.stringify(key.restrictedModels || []),
        allowedClients: JSON.stringify(key.allowedClients || []),
        tags: JSON.stringify(key.tags || [])
      }

      // Remove nulls
      Object.keys(redisKeyData).forEach((k) => {
        if (redisKeyData[k] === null || redisKeyData[k] === undefined) {
          delete redisKeyData[k]
        }
      })

      await redis.setApiKey(key.id, redisKeyData, key.keyHash)
      syncedCount++
      if (syncedCount % 10 === 0) {
        process.stdout.write('.')
      }
    }

    console.log(`\n✅ Synced ${syncedCount} keys to Redis.`)
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await redis.disconnect()
    await prisma.$disconnect()
    process.exit(0)
  }
}

main()
