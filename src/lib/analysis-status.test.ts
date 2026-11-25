import { describe, expect, it } from 'vitest'
import {
  analysisAgeMs,
  formatAnalysisWait,
  getProjectScanPresentation,
  getFailureExplanation,
  QUEUED_WARNING_MS,
} from './analysis-status'

describe('analysis waiting time', () => {
  it('handles missing, invalid, and future timestamps safely', () => {
    expect(analysisAgeMs(undefined)).toBeNull()
    expect(analysisAgeMs('invalid')).toBeNull()
    expect(analysisAgeMs(new Date(2000), 1000)).toBe(0)
    expect(analysisAgeMs(new Date(1000), 2000)).toBe(1000)
  })

  it.each([
    [500, '1 second'],
    [30_000, '30 seconds'],
    [60_000, '1 minute'],
    [120_000, '2 minutes'],
    [3_600_000, '1 hour'],
    [7_200_000, '2 hours'],
    [86_400_000, '1 day'],
    [259_200_000, '3 days'],
  ])('formats %d milliseconds as %s', (time, expected) => {
    expect(formatAnalysisWait(time)).toBe(expected)
  })
})

describe('getProjectScanPresentation', () => {
  const now = 1_000_000

  it('correctly reports never analyzed projects', () => {
    const res = getProjectScanPresentation({ _count: { analyses: 0 }, analyses: [] }, now)
    expect(res.state).toBe('never_analyzed')
    expect(res.label).toBe('Not analyzed')
    expect(res.isCompleted).toBe(false)
    expect(res.hasPreviousReport).toBe(false)
  })

  it('identifies completed analyses', () => {
    const res = getProjectScanPresentation(
      {
        lastAnalyzedAt: new Date(now - 50_000),
        analyses: [{ id: '1', status: 'completed', createdAt: new Date(now - 60_000) }],
      },
      now
    )
    expect(res.state).toBe('completed')
    expect(res.isCompleted).toBe(true)
    expect(res.hasPreviousReport).toBe(true)
  })

  it('identifies queued waiting without previous report', () => {
    const res = getProjectScanPresentation(
      {
        lastAnalyzedAt: null,
        analyses: [{ id: '1', status: 'queued', createdAt: new Date(now - 30_000) }],
      },
      now
    )
    expect(res.state).toBe('waiting')
    expect(res.isWaiting).toBe(true)
    expect(res.isDelayed).toBe(false)
    expect(res.hasPreviousReport).toBe(false)
  })

  it('identifies delayed queued scans without and with previous reports', () => {
    const delayedTime = new Date(now - QUEUED_WARNING_MS - 5000)
    const withoutPrev = getProjectScanPresentation(
      {
        lastAnalyzedAt: null,
        analyses: [{ id: '1', status: 'queued', createdAt: delayedTime }],
      },
      now
    )
    expect(withoutPrev.state).toBe('delayed')
    expect(withoutPrev.isDelayed).toBe(true)
    expect(withoutPrev.hasPreviousReport).toBe(false)

    const withPrev = getProjectScanPresentation(
      {
        lastAnalyzedAt: new Date(now - 200_000),
        analyses: [{ id: '1', status: 'queued', createdAt: delayedTime }],
      },
      now
    )
    expect(withPrev.state).toBe('delayed_with_previous')
    expect(withPrev.isDelayed).toBe(true)
    expect(withPrev.hasPreviousReport).toBe(true)
    expect(withPrev.sublabel).toBe('Previous report available')
  })

  it('identifies active processing stages', () => {
    const cloning = getProjectScanPresentation(
      {
        lastAnalyzedAt: null,
        analyses: [{ id: '1', status: 'cloning', createdAt: new Date(now - 10_000) }],
      },
      now
    )
    expect(cloning.state).toBe('processing')
    expect(cloning.isProcessing).toBe(true)
    expect(cloning.label).toBe('Preparing repository')

    const analyzing = getProjectScanPresentation(
      {
        lastAnalyzedAt: new Date(now - 100_000),
        analyses: [{ id: '1', status: 'analyzing', createdAt: new Date(now - 20_000) }],
      },
      now
    )
    expect(analyzing.state).toBe('processing_with_previous')
    expect(analyzing.isProcessing).toBe(true)
    expect(analyzing.hasPreviousReport).toBe(true)
  })

  it('identifies failed analyses and whether previous report is available', () => {
    const failedNew = getProjectScanPresentation(
      {
        lastAnalyzedAt: null,
        analyses: [{ id: '1', status: 'failed', createdAt: new Date(now - 10_000) }],
      },
      now
    )
    expect(failedNew.state).toBe('failed')
    expect(failedNew.isFailed).toBe(true)
    expect(failedNew.hasPreviousReport).toBe(false)

    const failedWithOld = getProjectScanPresentation(
      {
        lastAnalyzedAt: new Date(now - 500_000),
        analyses: [{ id: '1', status: 'failed', createdAt: new Date(now - 10_000) }],
      },
      now
    )
    expect(failedWithOld.state).toBe('failed_with_previous')
    expect(failedWithOld.isFailed).toBe(true)
    expect(failedWithOld.hasPreviousReport).toBe(true)
  })
})

describe('getFailureExplanation', () => {
  it('identifies timeouts', () => {
    const exp = getFailureExplanation('Analysis timed out while the repository was being cloned.')
    expect(exp.category).toBe('timeout')
    expect(exp.actionType).toBe('retry')
  })

  it('identifies authentication issues', () => {
    const exp = getFailureExplanation('GitHub 401 Bad credentials - expired token')
    expect(exp.category).toBe('auth')
    expect(exp.actionType).toBe('settings')
  })

  it('identifies repository not found', () => {
    const exp = getFailureExplanation('Remote: Repository not found (404)')
    expect(exp.category).toBe('repo_not_found')
    expect(exp.actionType).toBe('settings')
  })

  it('identifies branch issues', () => {
    const exp = getFailureExplanation('Remote branch production not found in upstream')
    expect(exp.category).toBe('branch_not_found')
    expect(exp.actionType).toBe('settings')
  })

  it('identifies worker restarts', () => {
    const exp = getFailureExplanation('Worker process restarted during execution')
    expect(exp.category).toBe('worker_restart')
    expect(exp.actionType).toBe('retry')
  })

  it('provides sensible fallback for unknown errors', () => {
    const exp = getFailureExplanation('Uncaught syntax error in plugin AST check')
    expect(exp.category).toBe('generic')
    expect(exp.actionType).toBe('retry')
  })
})
