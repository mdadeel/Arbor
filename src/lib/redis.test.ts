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
      eval: vi.fn(),
    })),
  }
})

describe('Redis & Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows requests within rate limit and atomically sets TTL on the first hit', async () => {
    const redis = getRedisClient()
    vi.mocked(redis.eval).mockResolvedValueOnce(1)

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('EXPIRE'"), 1, 'test-key', 3600)
  })

  it('rejects requests when rate limit is exceeded', async () => {
    const redis = getRedisClient()
    vi.mocked(redis.eval).mockResolvedValueOnce(11)

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('keeps local development usable if Redis raises an error', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const redis = getRedisClient()
    vi.mocked(redis.eval).mockRejectedValueOnce(new Error('Connection lost'))

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(10)
    vi.unstubAllEnvs()
  })

  it('fails closed in production if Redis raises an error', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const redis = getRedisClient()
    vi.mocked(redis.eval).mockRejectedValueOnce(new Error('Connection lost'))

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    vi.unstubAllEnvs()
  })

  it('handles an unavailable Redis connection without counting a request', async () => {
    const redis = getRedisClient()
    Object.defineProperty(redis, 'status', { value: 'wait', configurable: true })
    vi.mocked(redis.connect).mockRejectedValueOnce(new Error('Connection refused'))

    const result = await checkRateLimit('test-key', 10, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(10)
    expect(redis.eval).not.toHaveBeenCalled()
    Object.defineProperty(redis, 'status', { value: 'ready', configurable: true })
  })
})
