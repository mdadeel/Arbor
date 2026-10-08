import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { APP_URL: 'https://arbor.example' } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { pullRequestAnalysis: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() } },
}))
vi.mock('./github', () => ({ resolveGitHubToken: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { resolveGitHubToken } from './github'
import { completePullRequestCheck, failPullRequestAnalysis, startPullRequestCheck } from './pull-request-checks'

const closedPullRequest = {
  id: 'pr-1', number: 42, title: 'Closed PR', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40),
  status: 'closed', checkRunId: '9001', startedAt: new Date(),
  project: { userId: 'user-1', githubAccountId: 'github-1', repoFullName: 'owner/repo', slug: 'demo' },
}

describe('closed pull-request lifecycle guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.pullRequestAnalysis.findFirst).mockResolvedValue(closedPullRequest as never)
  })

  it('does not start or publish a check after the pull request has closed', async () => {
    await startPullRequestCheck('analysis-1')
    expect(prisma.pullRequestAnalysis.updateMany).not.toHaveBeenCalled()
    expect(resolveGitHubToken).not.toHaveBeenCalled()
  })

  it('does not overwrite closed status when analysis completion arrives late', async () => {
    await completePullRequestCheck('analysis-1', { findings: [], overallScore: 90 })
    await failPullRequestAnalysis('analysis-1', 'worker timed out')
    expect(prisma.pullRequestAnalysis.updateMany).not.toHaveBeenCalled()
    expect(prisma.pullRequestAnalysis.update).not.toHaveBeenCalled()
    expect(resolveGitHubToken).not.toHaveBeenCalled()
  })
})
