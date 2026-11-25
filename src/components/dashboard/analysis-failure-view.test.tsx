import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalysisFailureView } from './analysis-failure-view'

afterEach(() => {
  cleanup()
})

describe('AnalysisFailureView', () => {
  it('renders timeout failure explanation, new analysis action, and previous report button', () => {
    const retry = vi.fn()
    const viewPrevious = vi.fn()

    render(
      <AnalysisFailureView
        errorMessage="Scan execution timed out after 900000ms."
        analysisId="scan-err-1"
        branch="main"
        hasPreviousReport={true}
        onRetryNewAnalysis={retry}
        onViewPreviousReport={viewPrevious}
        isRetrying={false}
      />
    )

    expect(screen.getByText('Analysis could not complete')).toBeDefined()
    expect(screen.getByText(/Analysis timed out before completing inspection/i)).toBeDefined()

    const retryBtn = screen.getByRole('button', { name: /start a new analysis/i })
    fireEvent.click(retryBtn)
    expect(retry).toHaveBeenCalledOnce()

    const prevBtn = screen.getByRole('button', { name: /view last completed report/i })
    fireEvent.click(prevBtn)
    expect(viewPrevious).toHaveBeenCalledOnce()

    expect(screen.getByText(/scan-err-1/)).toBeDefined()
  })

  it('renders GitHub integrations link for authentication or permission failures', () => {
    render(
      <AnalysisFailureView
        errorMessage="Bad credentials (401) encountered while accessing repository."
        analysisId="scan-auth-1"
        branch="main"
        hasPreviousReport={false}
        onRetryNewAnalysis={vi.fn()}
        isRetrying={false}
      />
    )

    expect(screen.getByText(/GitHub authentication was rejected/i)).toBeDefined()
    const link = screen.getByRole('link', { name: /manage github integrations/i })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/settings')
  })
})
