import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAuditEvent, listAuditLogs } from './audit'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
  },
}))

describe('audit service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records an audit event cleanly without throwing', async () => {
    ;(prisma.auditLog.create as any).mockResolvedValue({
      id: 'audit-1',
      userId: 'user-1',
      action: 'project.create',
      entityType: 'project',
      entityId: 'proj-1',
      createdAt: new Date(),
    })

    const result = await logAuditEvent({
      userId: 'user-1',
      action: 'project.create',
      entityType: 'project',
      entityId: 'proj-1',
      metadata: { slug: 'new-repo' },
    })

    expect(result).not.toBeNull()
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        action: 'project.create',
        entityId: 'proj-1',
      }),
    })
  })

  it('lists audit logs when user is authorized', async () => {
    ;(prisma.workspaceMember.findUnique as any).mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'owner',
    })
    ;(prisma.auditLog.findMany as any).mockResolvedValue([
      {
        id: 'log-1',
        action: 'member.invited',
        createdAt: new Date(),
      },
    ])

    const logs = await listAuditLogs('user-1', { workspaceId: 'ws-1' })
    expect(logs.length).toBe(1)
    expect(logs[0].action).toBe('member.invited')
  })

  it('rejects audit log list if user is not in workspace', async () => {
    ;(prisma.workspaceMember.findUnique as any).mockResolvedValue(null)

    await expect(
      listAuditLogs('user-stranger', { workspaceId: 'ws-secret' })
    ).rejects.toThrow('Unauthorized')
  })
})
