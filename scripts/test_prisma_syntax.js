const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Testing Prisma JSON Array Filter...')
  try {
    // Simulate the query with tags (assuming this is where it fails)
    // Note: If tags is empty in DB, this might still work if not tested against real data structure
    // But specific syntax support depends on Prisma + Postgres version

    const count = await prisma.apiKey.count()
    console.log('Total keys:', count)

    // Test array_contains on tags
    // This replicates:
    /*
           where.tags = {
             array_contains: 'test-tag'
           }
        */
    console.log('Testing array_contains on tags...')
    const keys = await prisma.apiKey.findMany({
      where: {
        tags: {
          array_contains: 'test'
        }
      }
    })
    console.log('Success (tags)! Found:', keys.length)
  } catch (e) {
    console.error('FAILED (tags):', e.message)
    // console.error(e)
  }

  try {
    console.log('Testing array_contains on restrictedModels...')
    const keysMode = await prisma.apiKey.findMany({
      where: {
        restrictedModels: {
          array_contains: 'claude-3-opus'
        }
      }
    })
    console.log('Success (restrictedModels)! Found:', keysMode.length)
  } catch (e) {
    console.error('FAILED (restrictedModels):', e.message)
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
