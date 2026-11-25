import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { AnalysisReportNavigation } from './analysis-report-navigation'

afterEach(cleanup)

describe('analysis report navigation', () => {
  it('prioritizes four core views and keeps additional views discoverable', () => {
    const onValueChange = vi.fn()
    render(<Tabs value="overview"><AnalysisReportNavigation tab="overview" onValueChange={onValueChange} findingsCount={4} historyCount={2} /></Tabs>)
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('tab', { name: 'Findings (4)' })).toBeDefined()
    fireEvent.change(screen.getByRole('combobox', { name: 'More report views' }), { target: { value: 'dependencies' } })
    expect(onValueChange).toHaveBeenCalledWith('dependencies')
  })

  it('provides the selected additional panel with an accessible tab label', () => {
    render(<Tabs value="dependencies"><AnalysisReportNavigation tab="dependencies" onValueChange={() => {}} findingsCount={4} historyCount={2} /><TabsContent value="dependencies">Packages</TabsContent></Tabs>)
    expect(screen.getByRole('tab', { name: 'Dependencies' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel', { name: 'Dependencies' }).textContent).toBe('Packages')
  })
})
