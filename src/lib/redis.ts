import Redis from 'ioredis'
import { env } from './env'

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
  }
  return redisClient
}

/**
 * Checks an hourly rate limit using Redis INCR with TTL expiration.
 * Fails open if Redis is down/unreachable.
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
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, windowSeconds)
    }
    const remaining = Math.max(0, maxRequests - current)
    return {
      allowed: current <= maxRequests,
      remaining,
    }
  } catch {
    // If Redis is unreachable, fail open so development/tests are unblocked
    return { allowed: true, remaining: maxRequests }
  }
}
