import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalysisFirstRun } from './analysis-first-run'

afterEach(() => {
  cleanup()
})

describe('AnalysisFirstRun', () => {
  it('renders repository metadata, inspection scope, and static analysis boundaries', () => {
    const start = vi.fn()
    render(
      <AnalysisFirstRun
        repoFullName="acme/web-app"
        defaultBranch="main"
        repoPrivate={true}
        onStartAnalysis={start}
        isStarting={false}
      />
    )

    expect(screen.getByText('Initial Codebase Audit')).toBeDefined()
    expect(screen.getByText('acme/web-app')).toBeDefined()
    expect(screen.getByText('main')).toBeDefined()
    expect(screen.getByText('Private')).toBeDefined()
    expect(screen.getByText('What Arbor Inspects')).toBeDefined()
    expect(screen.getByText('Static Analysis Boundaries')).toBeDefined()

    const button = screen.getByRole('button', { name: /start initial analysis/i })
    expect(button).toBeDefined()
    fireEvent.click(button)
    expect(start).toHaveBeenCalledOnce()
  })

  it('displays loading state and disables button while starting', () => {
    const start = vi.fn()
    render(
      <AnalysisFirstRun
        repoFullName="acme/open-lib"
        defaultBranch="develop"
        repoPrivate={false}
        onStartAnalysis={start}
        isStarting={true}
      />
    )

    expect(screen.getByText('Public')).toBeDefined()
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    expect(button.textContent).toContain('Starting initial scan')
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders inline startup error if present', () => {
    render(
      <AnalysisFirstRun
        repoFullName="acme/open-lib"
        defaultBranch="develop"
        repoPrivate={false}
        onStartAnalysis={vi.fn()}
        isStarting={false}
        startError="Daily analysis quota exhausted for this workspace"
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Daily analysis quota exhausted for this workspace')
  })
})
