import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button, ButtonLabel } from './button'
import { Badge } from './badge'
import { Input } from './input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

describe('Create UI components', () => {
  it('renders a primary button with stable component metadata', () => {
    render(
      <Button variant="primary" appearance="solid">
        <ButtonLabel>Analyze repository</ButtonLabel>
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Analyze repository' })
    expect(button.getAttribute('data-slot')).toBe('button')
    expect(button.getAttribute('data-variant')).toBe('primary')
    expect(button.getAttribute('data-appearance')).toBe('solid')
  })

  it('announces and disables a loading button to prevent duplicate actions', () => {
    render(
      <Button loading>
        <ButtonLabel>Saving</ButtonLabel>
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Saving' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('keeps disabled slotted links inert', () => {
    const onClick = vi.fn()
    const childOnClick = vi.fn()
    render(
      <Button asChild disabled onClick={onClick}>
        <a href="/projects" onClick={childOnClick}>Open project</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Open project' })
    expect(link.getAttribute('aria-disabled')).toBe('true')
    expect(link.getAttribute('tabindex')).toBe('-1')
    fireEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
    expect(childOnClick).not.toHaveBeenCalled()
  })

  it('keeps a labelled input invalid state on the native field', () => {
    render(
      <>
        <label htmlFor="email">Email</label>
        <Input id="email" type="email" invalid aria-describedby="email-error" />
        <p id="email-error">Use a valid email address.</p>
      </>
    )

    const input = screen.getByLabelText('Email')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('email-error')
  })

  it('renders a passive status badge as a span', () => {
    render(<Badge variant="success" appearance="soft">Healthy</Badge>)

    const badge = screen.getByText('Healthy').closest('[data-slot="badge"]')
    expect(badge?.tagName).toBe('SPAN')
    expect(badge?.getAttribute('data-variant')).toBe('success')
  })

  it('exposes tab semantics and swaps the active content', () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Project sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="activity">Activity panel</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Overview panel')

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity' }), { button: 0 })
    expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Activity panel')
  })
})
