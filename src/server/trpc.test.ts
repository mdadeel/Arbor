import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  cookies: vi.fn(),
  findUserUnique: vi.fn(),
  verifyImpersonationToken: vi.fn(),
  checkUserPermission: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUserUnique } } }))
vi.mock('@/lib/impersonation', () => ({
  IMPERSONATION_COOKIE_NAME: 'arbor_impersonation',
  verifyImpersonationToken: mocks.verifyImpersonationToken,
}))
vi.mock('@/server/services/admin', () => ({
  checkUserPermission: mocks.checkUserPermission,
  PLATFORM_PERMISSIONS: { USERS_IMPERSONATE: 'admin:users:impersonate' },
}))

import { createTRPCContext } from './trpc'

describe('createTRPCContext account and impersonation authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getServerSession.mockResolvedValue({ user: { id: 'operator-1', name: 'Operator' } })
    mocks.findUserUnique.mockResolvedValue({
      id: 'operator-1',
      status: 'active',
      role: 'admin',
      email: 'operator@example.com',
      githubUsername: 'operator',
      permissions: null,
    })
    mocks.cookies.mockReturnValue({ get: () => undefined })
    mocks.verifyImpersonationToken.mockReturnValue(null)
    mocks.checkUserPermission.mockReturnValue(true)
  })

  it('removes a suspended account from protected request context', async () => {
    mocks.findUserUnique.mockResolvedValueOnce({ id: 'operator-1', status: 'suspended' })

    const context = await createTRPCContext()

    expect(context.session).toBeNull()
  })

  it('does not impersonate when the operator no longer has the permission', async () => {
    mocks.cookies.mockReturnValue({ get: () => ({ value: 'signed-token' }) })
    mocks.verifyImpersonationToken.mockReturnValue({
      originalAdminId: 'operator-1',
      targetUserId: 'target-1',
      expiresAt: Date.now() + 60_000,
    })
    mocks.checkUserPermission.mockReturnValue(false)

    const context = await createTRPCContext()

    expect(context.session?.user.id).toBe('operator-1')
    expect(context.session?.isImpersonating).toBe(false)
    expect(mocks.findUserUnique).toHaveBeenCalledTimes(1)
  })

  it('only impersonates an active target after checking operator permission', async () => {
    mocks.cookies.mockReturnValue({ get: () => ({ value: 'signed-token' }) })
    mocks.verifyImpersonationToken.mockReturnValue({
      originalAdminId: 'operator-1',
      targetUserId: 'target-1',
      targetUserName: 'Target',
      targetUserEmail: 'target@example.com',
      expiresAt: Date.now() + 60_000,
    })
    mocks.findUserUnique
      .mockResolvedValueOnce({ id: 'operator-1', status: 'active', role: 'admin' })
      .mockResolvedValueOnce({ id: 'target-1', status: 'active', name: 'Target', email: 'target@example.com' })

    const context = await createTRPCContext()

    expect(mocks.checkUserPermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'operator-1' }),
      'admin:users:impersonate'
    )
    expect(context.session?.user.id).toBe('target-1')
    expect(context.session?.isImpersonating).toBe(true)
  })
})
