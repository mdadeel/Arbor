import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryRawMock, pingMock, connectMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  pingMock: vi.fn(),
  connectMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    status: 'ready',
    connect: connectMock,
    ping: pingMock,
  }),
}))

import { GET } from './route'

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns HTTP 200 when both PostgreSQL and Redis probes succeed', async () => {
    queryRawMock.mockResolvedValueOnce([{ '?column?': 1 }])
    pingMock.mockResolvedValueOnce('PONG')

    const res = await GET(new NextRequest('http://localhost:3000/api/health'))
    const body = (await res.json()) as {
      status: string
      service: string
      checks: { database: string; redis: string }
    }

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(body.status).toBe('ok')
    expect(body.service).toBe('arbor')
    expect(body.checks).toEqual({ database: 'ok', redis: 'ok' })
  })

  it('returns HTTP 503 degraded without leaking internal errors when Redis or DB fails', async () => {
    queryRawMock.mockResolvedValueOnce([{ '?column?': 1 }])
    pingMock.mockRejectedValueOnce(new Error('ECONNREFUSED redis://secret-pass@10.0.0.5:6379'))

    const res = await GET(new NextRequest('http://localhost:3000/api/health'))
    const rawText = await res.text()
    const body = JSON.parse(rawText) as {
      status: string
      checks: { database: string; redis: string }
    }

    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ database: 'ok', redis: 'error' })
    expect(rawText).not.toContain('secret-pass')
  })

  it('supports zero-dependency process liveness checks via ?probe=liveness', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/health?probe=liveness'))
    const body = (await res.json()) as { status: string; mode: string }

    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.mode).toBe('liveness')
    expect(queryRawMock).not.toHaveBeenCalled()
    expect(pingMock).not.toHaveBeenCalled()
  })
})
