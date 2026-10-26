import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { GET } from './route'

async function callBadge(identifier: string) {
  const req = new NextRequest(`http://localhost:3000/api/badge/${identifier}`)
  return GET(req, { params: Promise.resolve({ identifier }) })
}

describe('Badge API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.project.findMany).mockResolvedValue([])
  })

  it('returns "not found" badge if project does not exist', async () => {
    const res = await callBadge('nonexistent')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    const svg = await res.text()
    expect(svg).toContain('Arbor: not found')
  })

  it('resolves a project by ID, restricted to public active projects', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce({
      name: 'By Id',
      latestScores: { overall: 91 },
      healthData: null,
    } as any)

    const res = await callBadge('clx123abc')
    const svg = await res.text()

    expect(svg).toContain('Arbor Audit: 91/100')
    expect(vi.mocked(prisma.project.findFirst).mock.calls[0][0]).toMatchObject({
      where: { id: 'clx123abc', status: 'active', repoPrivate: false },
    })
  })

  it('returns "unscored" badge if project has no overall score and no health score', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      { name: 'Unscored Project', latestScores: null, healthData: null },
    ] as any)

    const res = await callBadge('unscored')
    const svg = await res.text()

    expect(res.status).toBe(200)
    expect(svg).toContain('Arbor: unscored')
  })

  it('falls back to healthData.score when latestScores is null', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      { name: 'Health Only Project', latestScores: null, healthData: { score: 82 } },
    ] as any)

    const res = await callBadge('health-only')
    const svg = await res.text()

    expect(res.status).toBe(200)
    expect(svg).toContain('Arbor Audit: 82/100')
    expect(svg).toContain('#10b981')
  })

  it('resolves a slug only when it matches exactly one public project', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      { name: 'Unique', latestScores: { overall: 85 }, healthData: null },
    ] as any)

    const res = await callBadge('healthy')
    const svg = await res.text()

    expect(svg).toContain('Arbor Audit: 85/100')
    expect(svg).toContain('#10b981')
    expect(vi.mocked(prisma.project.findMany).mock.calls[0][0]).toMatchObject({
      where: { slug: 'healthy', status: 'active', repoPrivate: false },
    })
  })

  it('treats an ambiguous slug as not found instead of picking one user\'s project', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      { name: 'A', latestScores: { overall: 10 }, healthData: null },
      { name: 'B', latestScores: { overall: 20 }, healthData: null },
    ] as any)

    const res = await callBadge('api')
    const svg = await res.text()

    expect(svg).toContain('Arbor: not found')
    expect(svg).not.toContain('/100')
  })

  it('returns amber badge for 60 <= score < 80', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      { name: 'Mid Score Project', latestScores: { overall: 65 }, healthData: null },
    ] as any)

    const res = await callBadge('warning')
    const svg = await res.text()

    expect(res.status).toBe(200)
    expect(svg).toContain('Arbor Audit: 65/100')
    expect(svg).toContain('#f59e0b')
  })

  it('returns red badge for score < 60', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      { name: 'Low Score Project', latestScores: { overall: 45 }, healthData: null },
    ] as any)

    const res = await callBadge('critical')
    const svg = await res.text()

    expect(res.status).toBe(200)
    expect(svg).toContain('Arbor Audit: 45/100')
    expect(svg).toContain('#ef4444')
  })
})
