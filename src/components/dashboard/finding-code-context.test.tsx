import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/trpc', () => ({
  trpc: {
    project: {
      findingContext: {
        useQuery: vi.fn(),
      },
    },
  },
}))

import { trpc } from '@/lib/trpc'
import { FindingCodeContext } from './finding-code-context'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const props = {
  slug: 'demo',
  analysisId: 'analysis-1',
  fingerprint: 'a'.repeat(64),
  file: 'src/app.ts',
  line: 2,
}

describe('FindingCodeContext', () => {
  it('only requests source after the user opens the excerpt', () => {
    vi.mocked(trpc.project.findingContext.useQuery).mockReturnValue({
      isLoading: false,
      error: null,
      data: undefined,
    } as never)

    render(<FindingCodeContext {...props} />)

    expect(vi.mocked(trpc.project.findingContext.useQuery).mock.calls[0][1]).toMatchObject({ enabled: false })

    fireEvent.click(screen.getByRole('button', { name: /view code context/i }))

    expect(vi.mocked(trpc.project.findingContext.useQuery).mock.calls.at(-1)?.[1]).toMatchObject({ enabled: true })
  })

  it('shows the excerpt with the target line and range', () => {
    vi.mocked(trpc.project.findingContext.useQuery).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        file: 'src/app.ts',
        startLine: 1,
        endLine: 3,
        focusLine: 2,
        totalLines: 3,
        truncated: true,
        lines: [
          { number: 1, text: 'const a = 1', focus: false },
          { number: 2, text: 'const b = 2', focus: true },
          { number: 3, text: 'const c = 3', focus: false },
        ],
      },
    } as never)

    render(<FindingCodeContext {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /view code context/i }))

    expect(screen.getByText(/Lines 1–3 of 3/)).toBeDefined()
    expect(screen.getByText('const b = 2')).toBeDefined()
    expect(screen.getByText('src/app.ts:2')).toBeDefined()
  })
})
