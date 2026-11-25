import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  analysis: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  system: { findFirst: vi.fn() }, project: { update: vi.fn() }, transaction: vi.fn(),
  recover: vi.fn(), enqueue: vi.fn(), reconcile: vi.fn(), processSystem: vi.fn(), clone: vi.fn(), run: vi.fn(),
}))
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'cron-test', ANALYSIS_TIMEOUT_MS: 300_000 } }))
vi.mock('@/lib/prisma', () => ({ prisma: { analysis: m.analysis, systemAnalysis: m.system, project: m.project, $transaction: m.transaction } }))
vi.mock('@/worker/recovery', () => ({ recoverInterruptedAnalyses: m.recover }))
vi.mock('@/server/services/analysis-dispatch', () => ({ reconcileQueuedAnalyses: m.reconcile }))
vi.mock('@/server/services/insights', () => ({ enqueueDueScheduledScans: m.enqueue }))
vi.mock('@/server/services/system-group', () => ({ processSystemAnalysis: m.processSystem }))
vi.mock('@/server/analysis', () => ({ ANALYSIS_VERSION: 'test', runAnalysis: m.run }))
vi.mock('@/server/analysis/options', () => ({ analysisOptionsFromEnv: (timeoutMs: number) => ({ timeoutMs }) }))
vi.mock('@/server/services/clone', () => ({ cloneRepo: m.clone, repoDirFor: () => '/unused' }))
vi.mock('@/server/services/github', () => ({ resolveGitHubToken: async () => ({ token: null }) }))
vi.mock('@/server/services/pull-request-checks', () => ({ startPullRequestCheck: vi.fn(), completePullRequestCheck: vi.fn(), failPullRequestAnalysis: vi.fn() }))
vi.mock('@/server/services/notifications', () => ({ notifyAnalysisCompleted: async () => {} }))
vi.mock('@/server/analysis/dependencies', () => ({ analyzeDependencies: async () => ({ inventory: {}, advisories: {}, sbom: {} }) }))
vi.mock('@/server/analysis/hotspots', () => ({ analyzeHotspots: async () => [] }))
vi.mock('@/server/analysis/ownership', () => ({ analyzeOwnership: async () => [] }))
vi.mock('@/server/analysis/supply-chain', () => ({ dependencyAdvisoryFindings: () => [], scoreWithDependencyRisk: () => ({ overall: 80 }) }))
vi.mock('@/server/analysis/policies', () => ({ POLICY_PACKS: [], applyPolicyPacks: () => [] }))
vi.mock('@/server/services/policy', () => ({ getEffectiveProjectPolicySettings: async () => [] }))
vi.mock('node:fs', () => ({ default: { rmSync: vi.fn() } }))

import { GET } from './route'

const scan = (id: string) => ({
  id, branch: 'main', requestedCommitSha: null, pullRequestAnalysis: null,
  project: { id: 'project', userId: 'user', workspaceId: null, githubAccountId: null, repoUrl: 'https://github.com/owner/repo', repoFullName: 'owner/repo' },
})
const request = () => new Request('https://arbor.example/api/worker/process', { headers: { Authorization: 'Bearer cron-test' } })

describe('bounded fallback analysis processing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.analysis.findFirst.mockResolvedValue(null)
    m.analysis.findUnique.mockResolvedValue(null)
    m.analysis.updateMany.mockResolvedValue({ count: 1 })
    m.system.findFirst.mockResolvedValue(null)
    m.recover.mockResolvedValue(0)
    m.enqueue.mockResolvedValue(0)
    m.reconcile.mockResolvedValue(undefined)
    m.processSystem.mockResolvedValue(undefined)
    m.clone.mockResolvedValue({ sha: 'abc', gitChurn: {} })
    m.run.mockReturnValue({ metrics: {}, scores: {}, findings: [], techStack: {}, structure: {}, importGraph: {}, designSystem: {} })
    m.transaction.mockResolvedValue([])
  })
  afterEach(() => { vi.useRealTimers() })

  it('rejects unauthenticated calls before touching jobs or recovery', async () => {
    const response = await GET(new Request('https://arbor.example/api/worker/process'))
    expect(response.status).toBe(401)
    expect(m.recover).not.toHaveBeenCalled()
    expect(m.analysis.findFirst).not.toHaveBeenCalled()
  })

  it('recovers interrupted work and processes multiple small repository jobs per invocation', async () => {
    m.analysis.findFirst.mockResolvedValueOnce(scan('a')).mockResolvedValueOnce(scan('b')).mockResolvedValueOnce(scan('c'))
    m.analysis.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => scan(where.id))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'processed', results: ['a', 'b', 'c'].map((id) => ({ kind: 'repository', status: 'completed', analysisId: id })) })
    expect(m.recover).toHaveBeenCalledOnce()
    expect(m.enqueue).toHaveBeenCalledOnce()
    expect(m.reconcile).toHaveBeenCalledOnce()
    expect(m.analysis.update).toHaveBeenCalledTimes(3)
    expect(m.analysis.updateMany).toHaveBeenCalledWith({ where: { id: 'a', status: 'queued' }, data: { status: 'cloning', startedAt: expect.any(Date), errorMessage: null, completedAt: null } })
  })

  it('processes queued analyses up to the per-invocation job cap', async () => {
    m.system.findFirst.mockResolvedValue({ id: 'system' })
    m.analysis.findFirst.mockResolvedValue(scan('repo'))
    m.analysis.findUnique.mockResolvedValue(scan('repo'))
    const response = await GET(request())
    const body = await response.json()
    // 12 result slots: system and repository work interleave one-for-one.
    expect(body.results).toHaveLength(12)
    expect(m.processSystem).toHaveBeenCalledTimes(6)
    expect(m.run).toHaveBeenCalledTimes(6)
  })

  it('stops admitting new work near the execution deadline', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'))
    m.system.findFirst.mockResolvedValue({ id: 'slow-system' })
    m.processSystem.mockImplementation(async () => vi.setSystemTime(Date.now() + 190_000))
    const response = await GET(request())
    expect((await response.json()).results).toHaveLength(1)
    expect(m.analysis.findFirst).not.toHaveBeenCalled()
  })

  it('does not process a repository job claimed by another processor', async () => {
    m.analysis.findFirst.mockResolvedValueOnce(scan('claimed'))
    m.analysis.findUnique.mockResolvedValue(scan('claimed'))
    m.analysis.updateMany.mockResolvedValueOnce({ count: 0 })
    const response = await GET(request())
    expect((await response.json()).status).toBe('idle')
    expect(m.clone).not.toHaveBeenCalled()
  })

  it('continues repository processing after a failed system scan', async () => {
    m.system.findFirst.mockResolvedValueOnce({ id: 'bad-system' })
    m.processSystem.mockRejectedValueOnce(new Error('system failed'))
    m.analysis.findFirst.mockResolvedValueOnce(scan('good-repo'))
    m.analysis.findUnique.mockResolvedValue(scan('good-repo'))
    const response = await GET(request())
    expect((await response.json()).results).toEqual([
      { kind: 'system', status: 'failed', analysisId: 'bad-system' },
      { kind: 'repository', status: 'completed', analysisId: 'good-repo' },
    ])
  })

  it('processes queued work even when recovery, scheduling and reconciliation all fail', async () => {
    m.recover.mockRejectedValueOnce(new Error('recovery unavailable'))
    m.enqueue.mockRejectedValueOnce(new Error('scheduler unavailable'))
    m.reconcile.mockRejectedValueOnce(new Error('queue unavailable'))
    m.analysis.findFirst.mockResolvedValueOnce(scan('a'))
    m.analysis.findUnique.mockResolvedValue(scan('a'))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect((await response.json()).results).toEqual([
      { kind: 'repository', status: 'completed', analysisId: 'a' },
    ])
  })
})
