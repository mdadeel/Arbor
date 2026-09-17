import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
  },
}))

import { checkRateLimit, getRedisClient } from './redis'

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      status: 'ready',
      connect: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
    })),
  }
})

describe('Redis & Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows requests within rate limit and sets TTL on first hit', async () => {
    const redis = getRedisClient()
    vi.mocked(redis.incr).mockResolvedValueOnce(1)
    vi.mocked(redis.expire).mockResolvedValueOnce(1 as any)

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
    expect(redis.incr).toHaveBeenCalledWith('test-key')
    expect(redis.expire).toHaveBeenCalledWith('test-key', 3600)
  })

  it('rejects requests when rate limit is exceeded', async () => {
    const redis = getRedisClient()
    vi.mocked(redis.incr).mockResolvedValueOnce(11)

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(redis.expire).not.toHaveBeenCalled()
  })

  it('fails open if Redis raises an error', async () => {
    const redis = getRedisClient()
    vi.mocked(redis.incr).mockRejectedValueOnce(new Error('Connection lost'))

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(10)
  })
})
