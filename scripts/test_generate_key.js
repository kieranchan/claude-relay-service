const apiKeyService = require('../src/services/apiKeyService')
const redis = require('../src/models/redis')
// Ensure config is loaded or mock it if necessary.
// Assuming accessing src/services directly loads config.

async function main() {
  console.log('--- Generating Test API Key ---')
  try {
    // Connect Redis first because generateApiKey needs it
    await redis.connect()

    const result = await apiKeyService.generateApiKey({
      name: 'Test-Redis-Sync-Key',
      description: 'Testing if key syncs to Redis',
      createdBy: 'script',
      isActive: true,
      dailyCostLimit: 10
    })

    console.log('Generated Key ID:', result.id)

    // Check Redis immediately
    console.log('\n--- Verifying in Redis ---')
    const redisKey = await redis.getApiKey(result.id)
    console.log('Redis Data:', JSON.stringify(redisKey, null, 2))

    if (Object.keys(redisKey).length > 0) {
      console.log('✅ SUCCESS: Key found in Redis')
    } else {
      console.error('❌ FAILURE: Key NOT found in Redis')
    }

    // Cleanup
    await apiKeyService.deleteApiKey(result.id, 'script')
    console.log('Test key deleted.')
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await redis.disconnect()
    // Prisma disconnect handled internally or process exit
    process.exit(0)
  }
}

main()
