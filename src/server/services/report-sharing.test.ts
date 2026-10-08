import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analysis: { findFirst: vi.fn() },
    reportShareLink: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  },
}))
vi.mock('./project-access', () => ({
  requireAccessibleProject: vi.fn(),
  requireProjectEditor: vi.fn(),
}))
vi.mock('./audit', () => ({ logAuditEvent: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import { logAuditEvent } from './audit'
import { createReportShareLink, getSharedReport, listReportShareLinks, revokeReportShareLink } from './report-sharing'

const project = {
  id: 'project-1', slug: 'demo', userId: 'user-1', workspaceId: null,
  repoUrl: 'https://github.com/owner/repo', repoFullName: 'owner/repo', githubAccountId: null,
  defaultBranch: 'main', name: 'Demo', repoPrivate: false,
}

describe('report share links', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(requireAccessibleProject).mockResolvedValue(project)
    vi.mocked(requireProjectEditor).mockResolvedValue(undefined)
  })

  it('stores only a token hash and returns the raw secret once', async () => {
    vi.mocked(prisma.analysis.findFirst).mockResolvedValue({ id: 'analysis-1' } as never)
    vi.mocked(prisma.reportShareLink.create).mockImplementation(async (args: never) => ({
      id: 'share-1', createdAt: new Date('2026-10-08T00:00:00Z'), expiresAt: new Date('2026-10-15T00:00:00Z'),
    } as never))

    const result = await createReportShareLink({ userId: 'user-1', slug: 'demo', analysisId: 'analysis-1', expiresInDays: 7 })
    const stored = vi.mocked(prisma.reportShareLink.create).mock.calls[0][0].data

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(stored.tokenHash).toBe(createHash('sha256').update(result.token).digest('hex'))
    expect(stored).not.toHaveProperty('token')
    expect(result).not.toHaveProperty('tokenHash')
    expect(vi.mocked(requireProjectEditor)).toHaveBeenCalledWith('user-1', project)
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'report_share.created', entityId: 'share-1', metadata: expect.objectContaining({ analysisId: 'analysis-1' }),
    }))
    expect(JSON.stringify(vi.mocked(logAuditEvent).mock.calls)).not.toContain(result.token)
  })

  it('rejects malformed tokens before database lookup and returns only bounded report fields', async () => {
    await expect(getSharedReport('malformed')).resolves.toBeNull()
    expect(prisma.reportShareLink.findFirst).not.toHaveBeenCalled()

    const token = 'a'.repeat(43)
    vi.mocked(prisma.reportShareLink.findFirst).mockResolvedValue({
      expiresAt: new Date('2026-10-15T00:00:00Z'),
      analysis: {
        id: 'analysis-1', status: 'completed', branch: 'main', commitSha: 'a'.repeat(40),
        overallScore: 90, architectureScore: 91, techDebtScore: 82, performanceScore: 95,
        documentationScore: 80, securityScore: 88, designSystemScore: 77,
        findings: [{ id: 'f1', title: 'Finding', detail: 'Detail', evidence: ['src/app.ts'], secret: 'must-not-be-returned' }],
        createdAt: new Date('2026-10-08T00:00:00Z'), project: { name: 'Demo' },
      },
    } as never)

    const report = await getSharedReport(token)
    const where = vi.mocked(prisma.reportShareLink.findFirst).mock.calls[0][0].where
    expect(where).toMatchObject({
      tokenHash: createHash('sha256').update(token).digest('hex'),
      revokedAt: null,
      expiresAt: { gt: expect.any(Date) },
    })
    expect(report?.analysis.findings[0]).not.toHaveProperty('secret')
    expect(report?.analysis.findings[0]).toHaveProperty('evidence')
    expect(report?.analysis).not.toHaveProperty('repoUrl')
  })

  it('requires edit access to manage and list link metadata', async () => {
    vi.mocked(prisma.reportShareLink.findMany).mockResolvedValue([{ id: 'share-1' }] as never)
    await expect(listReportShareLinks('user-1', 'demo')).resolves.toEqual([{ id: 'share-1' }])
    expect(requireProjectEditor).toHaveBeenCalledWith('user-1', project)
  })

  it('revokes a link only within an authorized project', async () => {
    vi.mocked(prisma.reportShareLink.updateMany).mockResolvedValue({ count: 1 } as never)
    await expect(revokeReportShareLink('user-1', 'demo', 'share-1')).resolves.toEqual({ revoked: true })
    expect(prisma.reportShareLink.updateMany).toHaveBeenCalledWith({
      where: { id: 'share-1', projectId: 'project-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
