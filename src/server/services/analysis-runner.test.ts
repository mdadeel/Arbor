import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { ANALYSIS_QUEUE_DRIVER: 'bullmq', ENCRYPTION_SECRET: 'test-secret', ANALYSIS_TIMEOUT_MS: 300_000 } }))
vi.mock('@/lib/prisma', () => ({ prisma: { analysis: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, project: { update: vi.fn() }, $transaction: vi.fn() } }))

import {
  AnalysisRunOutcome,
  classifyAnalysisError,
  formatAnalysisError,
} from './analysis-runner'
import { AnalysisLimitError } from '@/server/analysis/walk'
import { getFailureExplanation } from '@/lib/analysis-status'

describe('classifyAnalysisError', () => {
  it('maps AnalysisLimitError codes to their structured code', () => {
    expect(classifyAnalysisError(new AnalysisLimitError('too big', 'REPOSITORY_TOO_LARGE')).code).toBe('REPOSITORY_TOO_LARGE')
    expect(classifyAnalysisError(new AnalysisLimitError('deadline', 'ANALYSIS_TIMEOUT')).code).toBe('ANALYSIS_TIMEOUT')
  })

  it('classifies GitHub auth, repo-not-found, and rate-limit failures', () => {
    expect(classifyAnalysisError(new Error('Authentication failed: bad credentials (HTTP 401)')).code).toBe('GITHUB_AUTH')
    expect(classifyAnalysisError(new Error('Repository not found on GitHub (HTTP 404).')).code).toBe('REPO_NOT_FOUND')
    expect(classifyAnalysisError(new Error('GitHub API rate limit reached; resets soon (HTTP 403).')).code).toBe('GITHUB_RATE_LIMIT')
  })

  it('falls back to ANALYSIS_INTERNAL and formats with a code prefix', () => {
    const classified = classifyAnalysisError(new Error('something exploded'))
    expect(classified.code).toBe('ANALYSIS_INTERNAL')
    expect(formatAnalysisError(classified.code, classified.message)).toBe('ANALYSIS_INTERNAL: something exploded')
    expect(formatAnalysisError('ANALYSIS_INTERNAL', 'ANALYSIS_INTERNAL: already prefixed')).toBe('ANALYSIS_INTERNAL: already prefixed')
  })

  it('formats non-Error throws', () => {
    expect(classifyAnalysisError('boom').message).toBe('Unknown analysis error')
  })
})

describe('structured error codes drive user-facing explanations', () => {
  const outcomes: Array<[string, ReturnType<typeof getFailureExplanation>['category']]> = [
    ['ANALYSIS_TIMEOUT: Analysis timed out while the repository was being cloned.', 'timeout'],
    ['GITHUB_AUTH: bad credentials (HTTP 401)', 'auth'],
    ['REPO_NOT_FOUND: Repository not found on GitHub (HTTP 404).', 'repo_not_found'],
    ['GITHUB_RATE_LIMIT: rate limit reached (HTTP 403).', 'generic'],
    ['REPOSITORY_TOO_LARGE: Repository is 900 MiB, above the limit.', 'limits'],
  ]
  for (const [message, category] of outcomes) {
    it(`classifies ${message.slice(0, 40)}…`, () => {
      expect(getFailureExplanation(message).category).toBe(category)
    })
  }

  it('still classifies legacy rows without a code prefix', () => {
    expect(getFailureExplanation('Remote branch main not found').category).toBe('branch_not_found')
  })
})

// Type-level guard: outcomes stay in the documented shape.
describe('outcome typing', () => {
  it('allows the documented outcome variants', () => {
    const completed: AnalysisRunOutcome = { status: 'completed', analysisId: 'a', durationMs: 1 }
    const skipped: AnalysisRunOutcome = { status: 'skipped', analysisId: 'a', reason: 'PR closed' }
    const contended: AnalysisRunOutcome = { status: 'contended' }
    expect([completed.status, skipped.status, contended.status]).toEqual(['completed', 'skipped', 'contended'])
  })
})
