import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canManageMembers,
  canEditProjects,
  canViewAuditLog,
  slugifyWorkspace,
  createWorkspace,
  inviteMember,
  removeMember,
} from './workspace'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    workspaceInvitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}))

describe('workspace service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('correctly calculates RBAC permissions', () => {
    expect(canManageMembers('owner')).toBe(true)
    expect(canManageMembers('admin')).toBe(true)
    expect(canManageMembers('member')).toBe(false)
    expect(canManageMembers('viewer')).toBe(false)

    expect(canEditProjects('owner')).toBe(true)
    expect(canEditProjects('admin')).toBe(true)
    expect(canEditProjects('member')).toBe(true)
    expect(canEditProjects('viewer')).toBe(false)

    expect(canViewAuditLog('owner')).toBe(true)
    expect(canViewAuditLog('admin')).toBe(true)
    expect(canViewAuditLog('member')).toBe(false)
    expect(canViewAuditLog('viewer')).toBe(false)
  })

  it('slugifies workspace names safely', () => {
    expect(slugifyWorkspace('Acme Corp Engineering')).toBe('acme-corp-engineering')
    expect(slugifyWorkspace('   Test & Dev 100!   ')).toBe('test-dev-100')
    expect(slugifyWorkspace('')).toBe('workspace')
  })

  it('creates workspace and assigns creator as owner', async () => {
    ;(prisma.workspace.findUnique as any).mockResolvedValue(null)
    ;(prisma.workspace.create as any).mockResolvedValue({
      id: 'ws-123',
      name: 'Stark Industries',
      slug: 'stark-industries',
      ownerId: 'user-tony',
    })
    ;(prisma.workspaceMember.create as any).mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-123',
      userId: 'user-tony',
      role: 'owner',
    })

    const ws = await createWorkspace('user-tony', { name: 'Stark Industries' })
    expect(ws.id).toBe('ws-123')
    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Stark Industries',
        ownerId: 'user-tony',
      }),
    })
    expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws-123',
        userId: 'user-tony',
        role: 'owner',
      },
    })
  })

  it('allows owner or admin to invite members with expiration token', async () => {
    ;(prisma.workspaceMember.findUnique as any).mockResolvedValue({
      id: 'mem-caller',
      workspaceId: 'ws-1',
      userId: 'user-admin',
      role: 'admin',
    })
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    ;(prisma.workspaceInvitation.create as any).mockResolvedValue({
      id: 'inv-1',
      workspaceId: 'ws-1',
      email: 'newdev@example.com',
      role: 'member',
      token: 'secure-token-123',
      status: 'pending',
    })

    const invitation = await inviteMember('user-admin', {
      workspaceId: 'ws-1',
      email: 'newdev@example.com',
      role: 'member',
    })

    expect(invitation.email).toBe('newdev@example.com')
    expect(prisma.workspaceInvitation.create).toHaveBeenCalled()
  })

  it('prevents viewer or regular member from inviting others', async () => {
    ;(prisma.workspaceMember.findUnique as any).mockResolvedValue({
      id: 'mem-viewer',
      workspaceId: 'ws-1',
      userId: 'user-viewer',
      role: 'viewer',
    })

    await expect(
      inviteMember('user-viewer', {
        workspaceId: 'ws-1',
        email: 'other@example.com',
        role: 'member',
      })
    ).rejects.toThrow('Only workspace owners and admins can invite members')
  })

  it('prevents removing the workspace owner', async () => {
    ;(prisma.workspaceMember.findUnique as any)
      .mockResolvedValueOnce({
        id: 'mem-admin',
        workspaceId: 'ws-1',
        userId: 'user-admin',
        role: 'admin',
      })
      .mockResolvedValueOnce({
        id: 'mem-owner',
        workspaceId: 'ws-1',
        userId: 'user-owner',
        role: 'owner',
      })

    await expect(
      removeMember('user-admin', {
        workspaceId: 'ws-1',
        targetUserId: 'user-owner',
      })
    ).rejects.toThrow('Cannot remove the owner of the workspace')
  })
})
