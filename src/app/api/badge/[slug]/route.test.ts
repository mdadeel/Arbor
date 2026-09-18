import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { GET } from './route'

describe('Badge API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "not found" badge if project does not exist', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/badge/nonexistent')
    const res = await GET(req, { params: { slug: 'nonexistent' } })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    const svg = await res.text()
    expect(svg).toContain('Arbor: not found')
  })

  it('returns "unscored" badge if project has no overall score', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      name: 'Unscored Project',
      latestScores: null,
    } as any)

    const req = new NextRequest('http://localhost:3000/api/badge/unscored')
    const res = await GET(req, { params: { slug: 'unscored' } })

    expect(res.status).toBe(200)
    const svg = await res.text()
    expect(svg).toContain('Arbor: unscored')
  })

  it('returns green badge for score >= 80', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      name: 'High Score Project',
      latestScores: { overall: 85 },
    } as any)

    const req = new NextRequest('http://localhost:3000/api/badge/healthy')
    const res = await GET(req, { params: { slug: 'healthy' } })

    expect(res.status).toBe(200)
    const svg = await res.text()
    expect(svg).toContain('Arbor Audit: 85/100')
    expect(svg).toContain('#10b981')
  })

  it('returns amber badge for 60 <= score < 80', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      name: 'Mid Score Project',
      latestScores: { overall: 65 },
    } as any)

    const req = new NextRequest('http://localhost:3000/api/badge/warning')
    const res = await GET(req, { params: { slug: 'warning' } })

    expect(res.status).toBe(200)
    const svg = await res.text()
    expect(svg).toContain('Arbor Audit: 65/100')
    expect(svg).toContain('#f59e0b')
  })

  it('returns red badge for score < 60', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      name: 'Low Score Project',
      latestScores: { overall: 45 },
    } as any)

    const req = new NextRequest('http://localhost:3000/api/badge/critical')
    const res = await GET(req, { params: { slug: 'critical' } })

    expect(res.status).toBe(200)
    const svg = await res.text()
    expect(svg).toContain('Arbor Audit: 45/100')
    expect(svg).toContain('#ef4444')
  })
})
