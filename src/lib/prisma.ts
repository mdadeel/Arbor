import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function getDatasourceUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) return undefined

  // Ensure connection limit is bounded to avoid exhausting PostgreSQL connection
  // slots on hobby tier cloud databases (Aiven max_connections: 20-25).
  // Serverless functions (Vercel) should use 1 connection per instance; local uses 3.
  if (!rawUrl.includes('connection_limit=')) {
    const sep = rawUrl.includes('?') ? '&' : '?'
    const limit = process.env.VERCEL ? '1' : '3'
    return `${rawUrl}${sep}connection_limit=${limit}&pool_timeout=15`
  }
  return rawUrl
}

function getPrismaClient(): PrismaClient {
  const datasourceUrl = getDatasourceUrl()

  if (process.env.NODE_ENV === 'production') {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = datasourceUrl
        ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } })
        : new PrismaClient()
    }
    return globalForPrisma.prisma
  }

  const cached = globalForPrisma.prisma
  if (cached) {
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
  const fresh = datasourceUrl
    ? new FreshClient({ datasources: { db: { url: datasourceUrl } } })
    : new FreshClient()
  globalForPrisma.prisma = fresh
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
