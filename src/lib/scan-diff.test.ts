import { describe, expect, it, vi } from 'vitest'
import { buildGitHubCompareHref, computeScanDiff, type ComparableScanInput } from './scan-diff'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    analysis: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/server/queue', () => ({
  getAnalysisQueue: vi.fn(),
}))

vi.mock('@/server/services/quotas', () => ({
  consumeAnalysisQuota: vi.fn(),
}))

vi.mock('@/server/services/project-access', () => ({
  requireAccessibleProject: vi.fn().mockResolvedValue({
    id: 'proj_1',
    slug: 'arbor',
    defaultBranch: 'main',
    userId: 'user_1',
    workspaceId: null,
  }),
  requireProjectEditor: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getProjectTrend } from '@/server/services/insights'

describe('computeScanDiff', () => {
  it('computes 7-pillar score deltas, honors policySuppressed filtering, and preserves multiset counts', () => {
    const previousRun: ComparableScanInput = {
      id: 'scan_prev',
      createdAt: '2026-10-20T10:00:00.000Z',
      branch: 'main',
      commitSha: '1111111111111111111111111111111111111111',
      overallScore: 68,
      architectureScore: 80,
      techDebtScore: 50,
      performanceScore: 90,
      documentationScore: 60,
      securityScore: 70,
      designSystemScore: 58,
      findings: [
        // 3 occurrences of console-log in src/api.ts on previous scan
        {
          id: 'console-log',
          ruleId: 'console-log',
          category: 'techDebt',
          severity: 'info',
          title: 'Console logging in source',
          detail: 'console.log #1',
          file: 'src/api.ts',
          line: 10,
        },
        {
          id: 'console-log',
          ruleId: 'console-log',
          category: 'techDebt',
          severity: 'info',
          title: 'Console logging in source',
          detail: 'console.log #2',
          file: 'src/api.ts',
          line: 22,
        },
        {
          id: 'console-log',
          ruleId: 'console-log',
          category: 'techDebt',
          severity: 'info',
          title: 'Console logging in source',
          detail: 'console.log #3',
          file: 'src/api.ts',
          line: 38,
        },
        {
          id: 'hardcoded-secret',
          ruleId: 'secret-hardcoded-credential',
          category: 'security',
          severity: 'critical',
          title: 'Potential hardcoded credential',
          detail: 'Found credential assignment',
          file: 'src/auth.ts',
          line: 14,
        },
        // Suppressed finding must be ignored
        {
          id: 'suppressed-todo',
          ruleId: 'todo-comments',
          category: 'techDebt',
          severity: 'warning',
          title: 'TODO comments',
          detail: 'Suppressed by policy',
          policySuppressed: true,
        },
      ],
      metrics: {
        files: 100,
        loc: 12000,
        circularDeps: [['a.ts', 'b.ts', 'a.ts']],
        hotspots: { highRiskCount: 2 },
      },
    }

    const latestRun: ComparableScanInput = {
      id: 'scan_latest',
      createdAt: '2026-10-28T10:00:00.000Z',
      branch: 'main',
      commitSha: '2222222222222222222222222222222222222222',
      overallScore: 79,
      architectureScore: 86,
      techDebtScore: 65,
      performanceScore: 88,
      documentationScore: 66,
      securityScore: 92,
      designSystemScore: 58,
      findings: [
        // Only 1 console-log remains in src/api.ts (2 resolved!)
        {
          id: 'console-log',
          ruleId: 'console-log',
          category: 'techDebt',
          severity: 'info',
          title: 'Console logging in source',
          detail: 'console.log surviving',
          file: 'src/api.ts',
          line: 8,
        },
        // 1 newly introduced warning
        {
          id: 'img-tag',
          ruleId: 'raw-img-tag',
          category: 'performance',
          severity: 'warning',
          title: 'Raw <img> element without next/image',
          detail: 'Use next/image',
          file: 'src/components/hero.tsx',
          line: 19,
        },
      ],
      metrics: {
        files: 104,
        loc: 12340,
        circularDeps: [],
        hotspots: { highRiskCount: 1 },
      },
    }

    const diff = computeScanDiff(previousRun, latestRun)

    expect(diff.sameCommit).toBe(false)
    expect(diff.scores.find((s) => s.key === 'overall')?.delta).toBe(11)
    expect(diff.scores.find((s) => s.key === 'security')?.delta).toBe(22)
    expect(diff.scores.find((s) => s.key === 'performance')?.delta).toBe(-2)

    // Conservation laws: 4 visible prev -> 2 visible latest (-2 net = +1 introduced - 3 resolved)
    expect(diff.counts.previousTotal).toBe(4)
    expect(diff.counts.latestTotal).toBe(2)
    expect(diff.counts.persistingCount).toBe(1)
    expect(diff.counts.introducedCount).toBe(1)
    expect(diff.counts.resolvedCount).toBe(3)
    expect(diff.counts.netDelta).toBe(-2)
    expect(diff.counts.criticalDelta).toBe(-1)
    expect(diff.counts.warningDelta).toBe(1)

    expect(diff.introducedFindings[0]?.ruleId).toBe('raw-img-tag')
    expect(diff.resolvedFindings[0]?.severity).toBe('critical')
    expect(diff.resolvedFindings[0]?.ruleId).toBe('secret-hardcoded-credential')

    expect(diff.metrics).toEqual([
      { key: 'files', label: 'Source files', previous: 100, latest: 104, delta: 4 },
      { key: 'loc', label: 'Lines of code', previous: 12000, latest: 12340, delta: 340 },
      { key: 'circularDeps', label: 'Circular loops', previous: 1, latest: 0, delta: -1 },
      { key: 'highRiskHotspots', label: 'High-risk hotspots', previous: 2, latest: 1, delta: -1 },
    ])
  })

  it('builds GitHub compare URLs only when two distinct valid commit SHAs exist', () => {
    expect(
      buildGitHubCompareHref(
        'https://github.com/mdadeel/Arbor.git',
        'efef02783d86',
        '4b843d69f61c'
      )
    ).toBe('https://github.com/mdadeel/Arbor/compare/efef02783d86...4b843d69f61c')

    expect(
      buildGitHubCompareHref('https://github.com/mdadeel/Arbor', 'efef0278', 'efef0278')
    ).toBeNull()

    expect(buildGitHubCompareHref('https://gitlab.com/org/repo', 'aaaaaaa', 'bbbbbbb')).toBeNull()
  })

  it('integrates with getProjectTrend comparable-run filtering and optional baselineAnalysisId', async () => {
    const mockFindMany = vi.mocked(prisma.analysis.findMany)
    const rows = [
      {
        id: 'run_3_latest',
        createdAt: new Date('2026-10-29T12:00:00Z'),
        branch: 'main',
        commitSha: 'cccccccc',
        analysisVersion: 2,
        policySnapshot: { schemaVersion: 1 },
        overallScore: 84,
        architectureScore: 90,
        techDebtScore: 80,
        performanceScore: 90,
        documentationScore: 80,
        securityScore: 85,
        designSystemScore: 79,
        findings: [],
      },
      {
        id: 'run_other_branch',
        createdAt: new Date('2026-10-28T12:00:00Z'),
        branch: 'feat/experimental',
        commitSha: 'bbbbbbbb',
        analysisVersion: 2,
        policySnapshot: { schemaVersion: 1 },
        overallScore: 40,
        architectureScore: 40,
        techDebtScore: 40,
        performanceScore: 40,
        documentationScore: 40,
        securityScore: 40,
        designSystemScore: 40,
        findings: [],
      },
      {
        id: 'run_2_prev',
        createdAt: new Date('2026-10-27T12:00:00Z'),
        branch: 'main',
        commitSha: 'aaaaaaaa',
        analysisVersion: 2,
        policySnapshot: { schemaVersion: 1 },
        overallScore: 76,
        architectureScore: 85,
        techDebtScore: 70,
        performanceScore: 88,
        documentationScore: 75,
        securityScore: 78,
        designSystemScore: 60,
        findings: [
          {
            id: 'f1',
            ruleId: 'large-file',
            category: 'structure',
            severity: 'warning',
            title: 'Large file',
            detail: '800 lines',
            file: 'src/big.ts',
          },
        ],
      },
      {
        id: 'run_1_oldest',
        createdAt: new Date('2026-10-20T12:00:00Z'),
        branch: 'main',
        commitSha: '99999999',
        analysisVersion: 2,
        policySnapshot: { schemaVersion: 1 },
        overallScore: 62,
        architectureScore: 70,
        techDebtScore: 55,
        performanceScore: 80,
        documentationScore: 60,
        securityScore: 60,
        designSystemScore: 50,
        findings: [],
      },
    ]

    mockFindMany
      .mockResolvedValueOnce(rows as never)
      .mockResolvedValueOnce([
        { id: 'run_3_latest', metrics: { files: 50, loc: 5000 } },
        { id: 'run_2_prev', metrics: { files: 48, loc: 4800 } },
      ] as never)

    const defaultTrend = await getProjectTrend('user_1', 'arbor')
    expect(defaultTrend.excludedRuns).toBe(1)
    expect(defaultTrend.scanDiff?.previous.id).toBe('run_2_prev')
    expect(defaultTrend.scanDiff?.latest.id).toBe('run_3_latest')
    expect(defaultTrend.scanDiff?.counts.resolvedCount).toBe(1)

    mockFindMany
      .mockResolvedValueOnce(rows as never)
      .mockResolvedValueOnce([
        { id: 'run_3_latest', metrics: { files: 50, loc: 5000 } },
        { id: 'run_1_oldest', metrics: { files: 40, loc: 4000 } },
      ] as never)

    const customBaselineTrend = await getProjectTrend('user_1', 'arbor', 'run_1_oldest')
    expect(customBaselineTrend.scanDiff?.previous.id).toBe('run_1_oldest')
    expect(customBaselineTrend.scanDiff?.scores.find((s) => s.key === 'overall')?.delta).toBe(22)
  })
})
