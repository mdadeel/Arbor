import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateSarifLog } from '@/server/analysis/sarif-validator'

const { getServerSessionMock, requireAccessibleProjectMock, prismaMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  requireAccessibleProjectMock: vi.fn(),
  prismaMock: {
    analysis: {
      findFirst: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    findingTriage: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/server/services/project-access', () => ({
  requireAccessibleProject: requireAccessibleProjectMock,
}))

import { GET } from './route'

describe('GET /api/projects/[slug]/analyses/[analysisId]/sarif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when caller is unauthenticated', async () => {
    getServerSessionMock.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost:3000/api/projects/arbor/analyses/a1/sarif'), {
      params: Promise.resolve({ slug: 'arbor', analysisId: 'a1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when completed analysis does not exist for project', async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: 'u1' } })
    requireAccessibleProjectMock.mockResolvedValueOnce({ id: 'p1', slug: 'arbor' })
    prismaMock.analysis.findFirst.mockResolvedValueOnce(null)
    prismaMock.project.findUnique.mockResolvedValueOnce({ repoUrl: 'https://github.com/mdadeel/Arbor' })
    prismaMock.findingTriage.findMany.mockResolvedValueOnce([])

    const res = await GET(new Request('http://localhost:3000/api/projects/arbor/analyses/missing/sarif'), {
      params: Promise.resolve({ slug: 'arbor', analysisId: 'missing' }),
    })
    expect(res.status).toBe(404)
  })

  it('serves schema-validated SARIF 2.1.0 with triage suppressions and attachment headers', async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: 'u1' } })
    requireAccessibleProjectMock.mockResolvedValueOnce({ id: 'p1', slug: 'arbor-repo' })
    prismaMock.analysis.findFirst.mockResolvedValueOnce({
      id: 'a1',
      branch: 'main',
      commitSha: 'b35e44f9004631efab4800cdd2f7941569b92742',
      findings: [
        {
          id: 'large-file',
          ruleId: 'large-file',
          category: 'techDebt',
          severity: 'warning',
          title: 'Large source file',
          detail: 'src/app.ts has 900 non-empty lines.',
          recommendation: 'Split responsibilities into focused modules.',
          fingerprint: 'fp-large-1',
          file: 'src/app.ts',
          line: 1,
        },
      ],
    })
    prismaMock.project.findUnique.mockResolvedValueOnce({
      repoUrl: 'https://github.com/mdadeel/Arbor',
    })
    prismaMock.findingTriage.findMany.mockResolvedValueOnce([
      {
        fingerprint: 'fp-large-1',
        status: 'accepted_risk',
        note: 'Tracked for Q4 refactor.',
      },
    ])

    const res = await GET(
      new Request('http://localhost:3000/api/projects/arbor-repo/analyses/a1/sarif'),
      {
        params: Promise.resolve({ slug: 'arbor-repo', analysisId: 'a1' }),
      }
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/sarif+json')
    expect(res.headers.get('Content-Disposition')).toContain('arbor-repo-analysis.sarif')

    const parsed: unknown = await res.json()
    expect(validateSarifLog(parsed)).toEqual({ valid: true, errors: [] })
  })
})
