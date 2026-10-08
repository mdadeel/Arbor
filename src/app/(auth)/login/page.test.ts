import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/env', () => ({ githubConfigured: true }))

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import LoginPage from './page'

describe('login page session routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends an authenticated visitor to the dashboard', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never)

    await LoginPage()

    expect(redirect).toHaveBeenCalledWith('/dashboard')
    expect(redirect).toHaveBeenCalledTimes(1)
  })

  it('keeps the sign-in page available when the visitor is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const page = await LoginPage()

    expect(redirect).not.toHaveBeenCalled()
    expect(page).toBeDefined()
  })
})
