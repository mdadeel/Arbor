import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/report/test',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    reportShareLink: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import PrintableSharedReportPage from './page'

const expiredShareSlug = 'x'.repeat(43)
const validShareSlug = 'v'.repeat(43)

describe('PrintableSharedReportPage (/report/[token])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })
  })

  it('returns 404 (notFound) when the share token is expired', async () => {
    // getSharedReport filters with { revokedAt: null, expiresAt: { gt: now } },
    // so an expired link resolves to null from Prisma findFirst.
    vi.mocked(prisma.reportShareLink.findFirst).mockResolvedValue(null)

    await expect(
      PrintableSharedReportPage({ params: Promise.resolve({ token: expiredShareSlug }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(prisma.reportShareLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
      })
    )
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('returns 404 (notFound) when the share token is revoked or malformed', async () => {
    vi.mocked(prisma.reportShareLink.findFirst).mockResolvedValue(null)

    await expect(
      PrintableSharedReportPage({ params: Promise.resolve({ token: expiredShareSlug }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)

    const malformedInput = ['short', 'invalid'].join('-')
    await expect(
      PrintableSharedReportPage({ params: Promise.resolve({ token: malformedInput }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(2)
  })

  it('renders cover metadata, client branding, recommended actions, and severity-grouped findings for a valid token', async () => {
    vi.mocked(prisma.reportShareLink.findFirst).mockResolvedValue({
      clientName: 'Northstar Ventures',
      expiresAt: new Date('2026-11-15T00:00:00.000Z'),
      analysis: {
        id: 'analysis-print-1',
        status: 'completed',
        analysisVersion: 1,
        branch: 'main',
        commitSha: '9d2552242ff6aed016ea4e57b69321f388817f3b',
        durationMs: 2100,
        overallScore: 76,
        architectureScore: 91,
        techDebtScore: 68,
        performanceScore: 88,
        documentationScore: 79,
        securityScore: 72,
        designSystemScore: 64,
        techStack: {
          framework: 'Next.js',
          languages: ['TypeScript'],
          packageManager: 'npm',
        },
        structure: {
          avgFileLines: 118,
          dirs: [{ path: 'src', files: 120 }],
          hugeFiles: [{ file: 'src/server/services/admin.ts', lines: 1210 }],
        },
        metrics: {
          files: 120,
          loc: 14200,
          components: 45,
          serverComponents: 20,
          clientComponents: 25,
          hooks: 18,
          anyTypes: 12,
          consoleLogs: 2,
          unusedDeps: [],
          deadExports: [],
          circularDeps: [],
        },
        dependencyGraph: {
          nodes: ['src/lib/auth.ts', 'src/server/trpc.ts'],
          edges: [['src/server/trpc.ts', 'src/lib/auth.ts']],
        },
        policySnapshot: {
          schemaVersion: 1,
          packs: [
            { packKey: 'security', version: '1.0.0', enabled: true },
            { packKey: 'maintainability', version: '1.0.0', enabled: true },
          ],
        },
        dependencyInventory: {
          version: 1,
          directCount: 10,
          transitiveCount: 80,
          ecosystems: ['npm'],
          lockfiles: ['package-lock.json'],
          complete: true,
          truncated: false,
          packages: [
            {
              name: 'next',
              version: '15.5.27',
              ecosystem: 'npm',
              direct: true,
              dependencyType: 'prod',
            },
          ],
        },
        dependencyAdvisories: {
          status: 'complete',
          source: 'GitHub Advisory Database',
          checkedAt: '2026-10-28T00:00:00.000Z',
          queriedCount: 10,
          advisoryCount: 0,
          advisories: [],
        },
        findings: [
          {
            id: 'sec-1',
            title: 'Possible Hardcoded credential committed',
            category: 'security',
            severity: 'critical',
            detail: 'Detected secret-like literal.',
            recommendation: 'Move credential to runtime secret storage and rotate immediately.',
            file: 'src/lib/auth.ts',
            line: 125,
            evidence: ['src/lib/auth.ts:125'],
            policyPack: 'security',
            policyVersion: '1.0.0',
          },
        ],
        createdAt: new Date('2026-10-28T12:00:00.000Z'),
        project: {
          name: 'Arbor',
          slug: 'arbor',
          repoFullName: 'mdadeel/Arbor',
          defaultBranch: 'main',
        },
      },
    } as never)

    const element = await PrintableSharedReportPage({
      params: Promise.resolve({ token: validShareSlug }),
    })
    render(element)

    expect(screen.getByTestId('prepared-for-banner').textContent).toContain('Northstar Ventures')
    expect(screen.getByText('9d2552242ff6aed016ea4e57b69321f388817f3b')).toBeTruthy()
    expect(screen.getByText('security@1.0.0, maintainability@1.0.0')).toBeTruthy()
    expect(screen.getByText('Recommended Actions')).toBeTruthy()
    expect(screen.getAllByText('src/lib/auth.ts:125').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Dependency & Supply-Chain Risk')).toBeTruthy()
  })
})
