import Redis from 'ioredis'
import { env } from './env'

let redisClient: Redis | null = null

const RATE_LIMIT_SCRIPT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return current
`

export function getRedisClient(): Redis {
  if (!redisClient || redisClient.status === 'end') {
    redisClient = new Redis(env.REDIS_URL, {
      // This client only serves short rate-limit commands (BullMQ owns its
      // separate connection), so a dead Redis must fail promptly, not hang.
      maxRetriesPerRequest: 1,
      connectTimeout: 1_000,
      retryStrategy: (attempt) => attempt <= 2 ? attempt * 250 : null,
      lazyConnect: true,
    })
  }
  return redisClient
}

/**
 * Checks an hourly rate limit using Redis INCR with TTL expiration.
 * Fails closed in production if Redis is down; local development/tests remain usable.
 */
export async function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowSeconds = 3600
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const redis = getRedisClient()
    if (redis.status === 'wait') {
      await redis.connect()
    }
    const current = Number(await redis.eval(RATE_LIMIT_SCRIPT, 1, key, windowSeconds))
    if (!Number.isSafeInteger(current) || current < 1) throw new Error('Redis returned an invalid rate-limit counter.')
    const remaining = Math.max(0, maxRequests - current)
    return {
      allowed: current <= maxRequests,
      remaining,
    }
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, remaining: 0 }
    }
    // Keep local development and isolated tests usable when Redis is absent.
    return { allowed: true, remaining: maxRequests }
  }
}
