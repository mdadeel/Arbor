import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma
  if (cached && 'projectGroup' in cached) {
    return cached
  }

  // In development, Next.js keeps @prisma/client in Node's require.cache across HMR.
  // When new models are pushed while the server is running, evict stale cache entries
  // so the freshly generated client from disk is loaded.
  if (typeof require !== 'undefined' && require.cache) {
    for (const key of Object.keys(require.cache)) {
      if (key.includes('.prisma') || key.includes('@prisma')) {
        delete require.cache[key]
      }
    }
  }

  const { PrismaClient: FreshClient } = require('@prisma/client') as { PrismaClient: typeof PrismaClient }
  const fresh = new FreshClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = fresh
  }
  return fresh
}

// Export a proxy so any callers holding a reference always access the latest model delegates
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient() as any
    const val = client[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})
