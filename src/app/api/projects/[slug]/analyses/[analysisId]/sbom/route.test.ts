import { beforeEach, describe, expect, it, vi } from 'vitest'
import { validateCycloneDx15Sbom } from '@/server/analysis/cyclonedx-validator'

const { getServerSessionMock, findFirstMock, requireAccessibleProjectMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  findFirstMock: vi.fn(),
  requireAccessibleProjectMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analysis: {
      findFirst: findFirstMock,
    },
  },
}))

vi.mock('@/server/services/project-access', () => ({
  requireAccessibleProject: requireAccessibleProjectMock,
}))

import { GET } from './route'

describe('GET /api/projects/[slug]/analyses/[analysisId]/sbom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests with HTTP 401', async () => {
    getServerSessionMock.mockResolvedValueOnce(null)
    const res = await GET(new Request('http://localhost/api/projects/arbor/analyses/a1/sbom'), {
      params: Promise.resolve({ slug: 'arbor', analysisId: 'a1' }),
    })
    expect(res.status).toBe(401)
  })

  it('rebuilds legacy schema-invalid stored SBOMs from inventory/advisories and serves valid CycloneDX 1.5 JSON', async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: 'user_1' } })
    requireAccessibleProjectMock.mockResolvedValueOnce({ id: 'proj_1', slug: 'arbor' })

    const pkg = {
      name: 'lodash',
      version: '4.17.20',
      ecosystem: 'npm' as const,
      direct: true,
      dependencyType: 'prod' as const,
      purl: 'pkg:npm/lodash@4.17.20',
      dependencyPath: ['lodash'],
      license: 'MIT',
      resolved: true,
    }

    findFirstMock.mockResolvedValueOnce({
      // Legacy pre-schema-validation SBOM with invalid nested `{ range: { range } }`
      sbom: {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: 'urn:uuid:00000000-0000-4000-8000-000000000001',
        version: 1,
        metadata: { timestamp: '2026-10-01T00:00:00.000Z' },
        components: [
          {
            type: 'library',
            'bom-ref': pkg.purl,
            name: pkg.name,
            version: pkg.version,
            purl: pkg.purl,
          },
        ],
        vulnerabilities: [
          {
            id: 'GHSA-legacy-1',
            affects: [
              {
                ref: pkg.purl,
                versions: [{ version: '4.17.20', range: { range: '<4.17.21' }, status: 'affected' }],
              },
            ],
          },
        ],
      },
      dependencyInventory: {
        version: 1,
        packages: [pkg],
        ecosystems: ['npm'],
        lockfiles: ['package-lock.json'],
        directCount: 1,
        transitiveCount: 0,
        complete: true,
        truncated: false,
      },
      dependencyAdvisories: {
        status: 'complete',
        source: 'GitHub Advisory Database',
        checkedAt: '2026-10-01T00:00:00.000Z',
        queriedCount: 1,
        advisoryCount: 1,
        advisories: [
          {
            id: 'GHSA-legacy-1',
            packageName: 'lodash',
            ecosystem: 'npm',
            severity: 'high',
            summary: 'Prototype pollution',
            vulnerableRange: '<4.17.21',
            patchedVersion: '4.17.21',
            url: 'https://github.com/advisories/GHSA-legacy-1',
          },
        ],
      },
    })

    const res = await GET(new Request('http://localhost/api/projects/arbor/analyses/a1/sbom'), {
      params: Promise.resolve({ slug: 'arbor', analysisId: 'a1' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/vnd.cyclonedx+json; version=1.5')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="arbor-sbom.cdx.json"')

    const payload: unknown = await res.json()
    expect(validateCycloneDx15Sbom(payload)).toEqual({ valid: true, errors: [] })
  })

  it('returns HTTP 500 rather than serving an unrecoverable schema-invalid SBOM', async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: 'user_1' } })
    requireAccessibleProjectMock.mockResolvedValueOnce({ id: 'proj_1', slug: 'arbor' })
    findFirstMock.mockResolvedValueOnce({
      sbom: { bomFormat: 'NotCycloneDX', specVersion: '0.0' },
      dependencyInventory: null,
      dependencyAdvisories: null,
    })

    const res = await GET(new Request('http://localhost/api/projects/arbor/analyses/a1/sbom'), {
      params: Promise.resolve({ slug: 'arbor', analysisId: 'a1' }),
    })
    expect(res.status).toBe(500)
  })
})
