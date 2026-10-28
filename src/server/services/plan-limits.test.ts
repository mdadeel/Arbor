import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { checkRateLimitMock, prismaMock } = vi.hoisted(() => {
  const rateLimit = vi.fn()
  const baseDb = {
    workspace: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    workspaceInvitation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    scanSchedule: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  }
  const db = {
    ...baseDb,
    $transaction: vi.fn(async <T>(cb: (tx: typeof baseDb) => Promise<T>): Promise<T> => cb(baseDb)),
  }
  return { checkRateLimitMock: rateLimit, prismaMock: db }
})

vi.mock('@/lib/redis', () => ({ checkRateLimit: checkRateLimitMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/server/queue', () => ({ getAnalysisQueue: vi.fn() }))
vi.mock('./project-access', () => ({
  requireAccessibleProject: vi.fn(async (_userId: string, slug: string) => ({
    id: `proj-${slug}`,
    slug,
    userId: 'user-1',
    workspaceId: slug.startsWith('ws-') ? 'ws-1' : null,
    defaultBranch: 'main',
    status: 'active',
  })),
  requireProjectEditor: vi.fn().mockResolvedValue(undefined),
}))

import { consumeAnalysisQuota } from './quotas'
import { acceptInvitation, inviteMember } from './workspace'
import { updateProjectScanSchedule } from './insights'

describe('server-side workspace plan limits (Free vs Teams)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enforces 10/hr analysis quota on Free and raises quota to 60/hr on active Teams workspaces', async () => {
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'free',
      subscription: null,
    })
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false })

    await expect(
      consumeAnalysisQuota('user-free', { workspaceId: 'ws-free' })
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    })
    expect(checkRateLimitMock).toHaveBeenCalledWith('rate:analyze:user-free', 10, 3600)

    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'teams',
      subscription: { status: 'active', endsAt: null },
    })
    checkRateLimitMock.mockResolvedValueOnce({ allowed: true })

    await expect(
      consumeAnalysisQuota('user-pro', { workspaceId: 'ws-teams' })
    ).resolves.toBeUndefined()
    expect(checkRateLimitMock).toHaveBeenCalledWith('rate:analyze:ws:ws-teams', 60, 3600)
  })

  it('enforces workspace member caps in both inviteMember (5 on Free, 50 on Teams) and acceptInvitation', async () => {
    prismaMock.workspaceMember.findUnique
      .mockResolvedValueOnce({ role: 'owner' })
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'free',
      subscription: null,
    })
    prismaMock.workspaceMember.count.mockResolvedValueOnce(4)
    prismaMock.workspaceInvitation.findMany.mockResolvedValueOnce([
      { email: 'pending@acme.dev' },
    ])

    // 4 existing members + 1 pending invite = 5 (Free cap reached)
    await expect(
      inviteMember('user-owner', {
        workspaceId: 'ws-free',
        email: 'sixth@acme.dev',
        role: 'member',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    // Upgrading workspace to Teams allows inviting up to 50 members
    prismaMock.workspaceMember.findUnique.mockResolvedValueOnce({ role: 'owner' })
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'teams',
      subscription: { status: 'active', endsAt: null },
    })
    prismaMock.workspaceMember.count.mockResolvedValueOnce(4)
    prismaMock.workspaceInvitation.findMany.mockResolvedValueOnce([
      { email: 'pending@acme.dev' },
    ])
    prismaMock.workspaceInvitation.create.mockResolvedValueOnce({
      id: 'inv-6',
      workspaceId: 'ws-teams',
      email: 'sixth@acme.dev',
      role: 'member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const invite = await inviteMember('user-owner', {
      workspaceId: 'ws-teams',
      email: 'sixth@acme.dev',
      role: 'member',
    })
    expect(invite.email).toBe('sixth@acme.dev')

    // acceptInvitation also enforces cap inside transaction before consuming invitation
    const inviteSecret = 'a'.repeat(43)
    const inviteHash = createHash('sha256').update(inviteSecret).digest('hex')
    prismaMock.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: 'inv-cap',
      workspaceId: 'ws-free',
      email: 'joiner@acme.dev',
      role: 'member',
      tokenHash: inviteHash,
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    prismaMock.user.findUnique.mockResolvedValueOnce({ email: 'joiner@acme.dev' })
    prismaMock.workspaceMember.findUnique.mockResolvedValueOnce(null)
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'free',
      subscription: null,
    })
    prismaMock.workspaceMember.count.mockResolvedValueOnce(5)

    await expect(acceptInvitation('user-joiner', inviteSecret)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(prismaMock.workspaceInvitation.updateMany).not.toHaveBeenCalled()
  })

  it('enforces scheduled scan caps in updateProjectScanSchedule (3 on Free, 50 on Teams) without blocking edits or disables', async () => {
    // Enabling a 4th schedule on a Free workspace is rejected
    prismaMock.scanSchedule.findUnique.mockResolvedValueOnce(null)
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'free',
      subscription: null,
    })
    prismaMock.scanSchedule.count.mockResolvedValueOnce(3)

    await expect(
      updateProjectScanSchedule({
        userId: 'user-1',
        slug: 'ws-repo-4',
        enabled: true,
        cadence: 'daily',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    // Updating cadence on an already-enabled schedule at 3/3 still succeeds
    prismaMock.scanSchedule.findUnique.mockResolvedValueOnce({
      id: 'sched-1',
      projectId: 'proj-ws-repo-1',
      enabled: true,
      cadence: 'daily',
      branch: 'main',
      nextRunAt: new Date(),
    })
    prismaMock.scanSchedule.upsert.mockResolvedValueOnce({
      id: 'sched-1',
      enabled: true,
      cadence: 'weekly',
    })

    const updated = await updateProjectScanSchedule({
      userId: 'user-1',
      slug: 'ws-repo-1',
      enabled: true,
      cadence: 'weekly',
    })
    expect(updated.cadence).toBe('weekly')

    // Teams workspace allows enabling beyond 3 schedules (up to 50)
    prismaMock.scanSchedule.findUnique.mockResolvedValueOnce(null)
    prismaMock.workspace.findUnique.mockResolvedValueOnce({
      plan: 'teams',
      subscription: { status: 'active', endsAt: null },
    })
    prismaMock.scanSchedule.count.mockResolvedValueOnce(3)
    prismaMock.scanSchedule.upsert.mockResolvedValueOnce({
      id: 'sched-4',
      enabled: true,
      cadence: 'daily',
    })

    const createdTeamsSchedule = await updateProjectScanSchedule({
      userId: 'user-1',
      slug: 'ws-repo-4',
      enabled: true,
      cadence: 'daily',
    })
    expect(createdTeamsSchedule.enabled).toBe(true)
  })
})
