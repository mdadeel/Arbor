import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ redis: vi.fn(), queue: vi.fn(), disconnect: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { REDIS_URL: 'redis://example.test:6379' } }))
vi.mock('ioredis', () => ({ default: m.redis }))
vi.mock('bullmq', async () => {
  const { EventEmitter } = await import('node:events')
  m.queue.mockImplementation(() => new EventEmitter())
  return { Queue: m.queue }
})

describe('HTTP queue producers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    m.redis.mockImplementation(() => ({ disconnect: m.disconnect }))
  })

  it('shares one producer per queue and keeps finite command retries', async () => {
    const { getAnalysisQueue, getSystemAnalysisQueue } = await import('./queue')
    const repository = getAnalysisQueue()
    expect(getAnalysisQueue()).toBe(repository)
    expect(getSystemAnalysisQueue()).not.toBe(repository)
    expect(m.queue).toHaveBeenCalledTimes(2)
    const options = m.redis.mock.calls[0][1]
    expect(options.maxRetriesPerRequest).toBe(1)
    expect(options.commandTimeout).toBe(5_000)
    expect(options.connectTimeout).toBe(2_500)
    expect(options.retryStrategy(4)).toBeNull()
  })

  it('discards a failed producer so the next request can reconnect', async () => {
    const { getAnalysisQueue, getSystemAnalysisQueue } = await import('./queue')
    const repository = getAnalysisQueue()
    const system = getSystemAnalysisQueue()
    repository.emit('error', new Error('connection unavailable'))
    expect(m.disconnect).toHaveBeenCalledOnce()
    expect(getAnalysisQueue()).not.toBe(repository)
    expect(getSystemAnalysisQueue()).toBe(system)
  })
})
