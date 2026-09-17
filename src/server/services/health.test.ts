import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import {
  calculateHealthScore,
  getProjectHealth,
  getWorkspaceHealth,
  syncProjectHealth,
  type RepositoryMetrics,
  type WorkflowRun,
} from './health'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    gitHubAccount: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((val) => `decrypted_${val}`),
}))

const DEFAULT_METRICS: RepositoryMetrics = {
  openIssues: 5,
  openPRs: 2,
  staleIssues: 1,
  stalePRs: 0,
  lastCommitDate: new Date().toISOString(),
  lastCommitMessage: 'feat: add new feature',
  lastCommitAuthor: 'developer',
  commitFrequency: 25,
  contributors: [{ login: 'developer', avatarUrl: 'https://avatar.com', contributions: 25 }],
  branchCount: 3,
}

const SUCCESS_WORKFLOWS: WorkflowRun[] = [
  {
    id: 101,
    name: 'CI / Test',
    status: 'completed',
    conclusion: 'success',
    branch: 'main',
    commitSha: 'abc1234',
    author: 'developer',
    createdAt: new Date().toISOString(),
    durationMs: 45000,
    htmlUrl: 'https://github.com/actions/runs/101',
  },
]

describe('calculateHealthScore', () => {
  it('calculates high health score for active repo with passing CI and good audit', () => {
    const result = calculateHealthScore(DEFAULT_METRICS, SUCCESS_WORKFLOWS, 90)
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.status).toBe('healthy')
    expect(result.factors).toHaveLength(5)
    expect(result.factors.some((f: any) => f.name === 'CI Build Status' && f.impact === 'positive')).toBe(true)
  })

  it('penalizes score and surfaces recommendations when builds fail and PRs are stale', () => {
    const poorMetrics: RepositoryMetrics = {
      ...DEFAULT_METRICS,
      stalePRs: 5,
      commitFrequency: 0,
      openIssues: 80,
    }
    const failingWorkflows: WorkflowRun[] = [
      {
        id: 102,
        name: 'CI / Test',
        status: 'completed',
        conclusion: 'failure',
        branch: 'main',
        commitSha: 'def5678',
        author: 'developer',
        createdAt: new Date().toISOString(),
        durationMs: 30000,
        htmlUrl: 'https://github.com/actions/runs/102',
      },
    ]

    const result = calculateHealthScore(poorMetrics, failingWorkflows, 40)
    expect(result.score).toBeLessThan(50)
    expect(['warning', 'critical']).toContain(result.status)
    const ciFactor = result.factors.find((f: any) => f.name === 'CI Build Status')
    expect(ciFactor?.impact).toBe('negative')
    expect(ciFactor?.recommendation).toBeDefined()
    const prFactor = result.factors.find((f: any) => f.name === 'Pull Request Freshness')
    expect(prFactor?.impact).toBe('negative')
  })

  it('gracefully handles empty workflows and null analysis score', () => {
    const result = calculateHealthScore(DEFAULT_METRICS, [], null)
    expect(result.score).toBeGreaterThanOrEqual(60)
    const ciFactor = result.factors.find((f: any) => f.name === 'CI Build Status')
    expect(ciFactor?.impact).toBe('neutral')
  })
})

describe('Workspace Health Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates health metrics across all active projects', async () => {
    const mockProjects = [
      {
        id: 'p1',
        name: 'Alpha Project',
        slug: 'alpha-project',
        healthData: {
          score: 85,
          status: 'healthy',
          repository: { openPRs: 3, openIssues: 4, stalePRs: 0 },
          workflows: [{ id: 1, conclusion: 'success', name: 'CI' }],
        },
      },
      {
        id: 'p2',
        name: 'Beta Project',
        slug: 'beta-project',
        healthData: {
          score: 35,
          status: 'critical',
          repository: { openPRs: 5, openIssues: 12, stalePRs: 3 },
          workflows: [{ id: 2, conclusion: 'failure', name: 'Build' }],
        },
      },
    ]

    vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects as any)

    const workspace = await getWorkspaceHealth('user-1')
    expect(workspace.totalProjects).toBe(2)
    expect(workspace.avgHealthScore).toBe(60) // (85 + 35) / 2
    expect(workspace.totalOpenPRs).toBe(8)
    expect(workspace.totalOpenIssues).toBe(16)
    expect(workspace.stalePRs).toBe(3)
    expect(workspace.failingBuilds).toBe(1)
    expect(workspace.attentionList).toHaveLength(1)
    expect(workspace.attentionList[0].slug).toBe('beta-project')
  })
})

describe('syncProjectHealth', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('falls back to unauthenticated GitHub API on 401 for public repo and correctly records commits', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const mockProject = {
      id: 'proj-1',
      userId: 'user-1',
      name: 'Frontend',
      slug: 'frontend',
      repoFullName: 'octocat/frontend',
      repoPrivate: false,
      defaultBranch: 'master',
      analyses: [],
    }

    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(mockProject as any)
    vi.mocked(prisma.gitHubAccount.findFirst).mockResolvedValueOnce({
      id: 'acc-1',
      accessToken: 'enc_expired_token',
    } as any)

    ;(global.fetch as any).mockImplementation(async (url: string, opts: any) => {
      // If authorization header is present, simulate 401 Bad credentials
      if (opts?.headers?.Authorization) {
        return { status: 401, ok: false }
      }
      // Otherwise unauthenticated retry succeeds
      if (url.includes('/commits')) {
        return {
          status: 200,
          ok: true,
          json: async () => [
            {
              commit: {
                committer: { date: yesterday },
                author: { name: 'Octocat' },
                message: 'feat(seo): optimize robots\n\nFull details',
              },
            },
          ],
        }
      }
      if (url.includes('/pulls')) {
        return { status: 200, ok: true, json: async () => [] }
      }
      if (url.includes('/actions/runs')) {
        return { status: 200, ok: true, json: async () => ({ workflow_runs: [] }) }
      }
      if (url.includes('/contributors')) {
        return { status: 200, ok: true, json: async () => [] }
      }
      // /repos/octocat/frontend
      return {
        status: 200,
        ok: true,
        json: async () => ({ open_issues_count: 3 }),
      }
    })

    const health = await syncProjectHealth('user-1', 'proj-1')

    expect(health.repository.lastCommitDate).toBe(yesterday)
    expect(health.repository.lastCommitAuthor).toBe('Octocat')
    expect(health.repository.lastCommitMessage).toBe('feat(seo): optimize robots')
    expect(health.repository.commitFrequency).toBe(1)
    expect(health.repository.openIssues).toBe(3)
    expect(health.factors.some((f) => f.name === 'Commit Activity' && f.impact === 'neutral')).toBe(true)
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-1' },
      })
    )
  })

  it('surfaces authentication failure factor for private repo when token is unauthorized', async () => {
    const mockProject = {
      id: 'proj-2',
      userId: 'user-1',
      name: 'Secret Repo',
      slug: 'secret-repo',
      repoFullName: 'octocat/secret-repo',
      repoPrivate: true,
      defaultBranch: 'main',
      analyses: [],
    }

    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(mockProject as any)
    vi.mocked(prisma.gitHubAccount.findFirst).mockResolvedValueOnce({
      id: 'acc-1',
      accessToken: 'enc_bad_token',
    } as any)

    ;(global.fetch as any).mockResolvedValue({
      status: 401,
      ok: false,
    })

    const health = await syncProjectHealth('user-1', 'proj-2')
    const authFactor = health.factors.find((f) => f.name === 'GitHub Authentication')
    expect(authFactor).toBeDefined()
    expect(authFactor?.impact).toBe('negative')
    expect(authFactor?.detail).toContain('401')
  })
})
