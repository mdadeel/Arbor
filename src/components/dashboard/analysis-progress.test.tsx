import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalysisProgress } from './analysis-progress'
import { AnalysisHistory } from './analysis-history'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('waiting analysis experience', () => {
  it('warns about a days-old queued scan without pretending inspection is running', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'))
    const retry = vi.fn()
    const view = render(<AnalysisProgress status="queued" createdAt="2026-11-06T12:00:00Z" analysisId="scan-1" onRetry={retry} />)
    expect(screen.getByText('Your scan is still waiting')).toBeDefined()
    expect(screen.getByText('Waiting for 3 days.')).toBeDefined()
    expect(view.container.textContent).not.toContain('Analysis in progress')
    expect(view.container.querySelector('.animate-spin')).toBeNull()
    expect(view.container.querySelector('[aria-current="step"]')?.textContent).toContain('Queued')
    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('explains missing workers and points at the scheduled processor', () => {
    render(<AnalysisProgress status="queued" health={{ queue: 'available', worker: 'not-detected', paused: false }} />)
    expect(screen.getByText(/No continuous worker connection/)).toBeDefined()
    expect(screen.getByText(/scheduled background processor/)).toBeDefined()
  })

  it('explains delivery outages and displays retry errors inline', () => {
    render(<AnalysisProgress status="queued" health={{ queue: 'unavailable', worker: 'unknown', paused: false }} retryError="Please wait before retrying." />)
    expect(screen.getByText(/Queue connection unavailable/)).toBeDefined()
    expect(screen.getByRole('alert').textContent).toBe('Please wait before retrying.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names a stalled processor without implying an automatic or quick retry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
    const view = render(
      <AnalysisProgress
        status="queued"
        createdAt="2026-10-08T09:10:19Z"
        health={{ queue: 'available', worker: 'unknown', paused: false, stalled: true }}
      />
    )
    expect(screen.getByText('Your scan is still waiting')).toBeDefined()
    expect(screen.getByText('Waiting for 48 days.')).toBeDefined()
    expect(screen.getByText(/No processor has started this scan/)).toBeDefined()
    expect(view.container.textContent).not.toContain('within a few minutes')
    expect(view.container.textContent).not.toContain('retried automatically')
  })

  it('disables delivery retries while a request is pending', () => {
    render(<AnalysisProgress status="queued" retrying onRetry={() => {}} />)
    expect((screen.getByRole('button', { name: 'Checking delivery…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not offer delivery retry for active analysis work', () => {
    render(<AnalysisProgress status="analyzing" onRetry={() => {}} />)
    expect(screen.getByText('Analysis in progress')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows historical failure details even before a report has completed', () => {
    render(<AnalysisHistory analyses={[{
      id: 'scan-1', status: 'failed', branch: 'main', createdAt: '2026-11-06T12:00:00Z',
      commitSha: null, durationMs: null, overallScore: null, errorMessage: 'Repository access denied.',
    }]} />)
    expect(screen.getByText('Repository access denied.')).toBeDefined()
    expect(screen.getByRole('table')).toBeDefined()
  })
})
