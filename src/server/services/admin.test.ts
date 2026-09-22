import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkIsAdmin,
  checkUserPermission,
  createWaitlistLeadForAdmin,
  deleteUserForAdmin,
  deleteWaitlistLeadForAdmin,
  getAdminMetrics,
  getSystemHealthForAdmin,
  getUserDetailsForAdmin,
  listAdminEmailsForAdmin,
  listAuditLogsForAdmin,
  listUsersForAdmin,
  listWaitlistLeadsForAdmin,
  listWorkspacesForAdmin,
  PLATFORM_PERMISSIONS,
  purgeFailedAnalysesForAdmin,
  resetStuckAnalysesForAdmin,
  sendAdminEmail,
  updateUserAccessControlsForAdmin,
  updateUserBenefitsForAdmin,
} from './admin'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      count: vi.fn(),
    },
    analysis: {
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    workspace: {
      count: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    adminEmail: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    waitlistLead: {
      count: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/server/services/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
}))

vi.mock('@/lib/env', () => ({
  env: {
    ADMIN_EMAILS: 'admin@arbor.dev, founder@arbor.dev',
    ADMIN_GITHUB_USERNAMES: 'octocat, arbor-admin',
  },
}))

import { prisma } from '@/lib/prisma'

describe('Admin Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkIsAdmin', () => {
    it('returns true when user email matches ADMIN_EMAILS', () => {
      expect(checkIsAdmin({ email: 'admin@arbor.dev' })).toBe(true)
      expect(checkIsAdmin({ email: 'FOUNDER@ARBOR.DEV' })).toBe(true)
    })

    it('returns true when github username matches ADMIN_GITHUB_USERNAMES', () => {
      expect(checkIsAdmin({ githubUsername: 'octocat' })).toBe(true)
      expect(checkIsAdmin({ githubUsername: 'Arbor-Admin' })).toBe(true)
    })

    it('returns true for configured primary admin credentials adeel and mdadeel', () => {
      expect(checkIsAdmin({ githubUsername: 'adeel' })).toBe(true)
      expect(checkIsAdmin({ githubUsername: 'mdadeel' })).toBe(true)
      expect(checkIsAdmin({ email: 'adeel@admin.local' })).toBe(true)
      expect(checkIsAdmin({ email: 'mdadeel125@gmail.com' })).toBe(true)
    })

    it('returns true for users with database role admin or moderator', () => {
      expect(checkIsAdmin({ role: 'admin' })).toBe(true)
      expect(checkIsAdmin({ role: 'moderator' })).toBe(true)
      expect(checkIsAdmin({ role: 'user' })).toBe(false)
    })

    it('strictly returns false for unauthorized users', () => {
      expect(checkIsAdmin({ email: 'regular@user.com', githubUsername: 'randomuser' })).toBe(false)
      expect(checkIsAdmin({ email: 'intruder@evil.corp', githubUsername: 'hacker' })).toBe(false)
      expect(checkIsAdmin({ email: 'unknown@test.com' })).toBe(false)
      expect(checkIsAdmin({ githubUsername: 'otherperson' })).toBe(false)
      expect(checkIsAdmin()).toBe(false)
    })
  })

  describe('checkUserPermission', () => {
    it('grants all permissions to superadmins and admin role', () => {
      expect(checkUserPermission({ githubUsername: 'adeel' }, PLATFORM_PERMISSIONS.USERS_MANAGE)).toBe(true)
      expect(checkUserPermission({ role: 'admin' }, PLATFORM_PERMISSIONS.SYSTEM_MANAGE)).toBe(true)
    })

    it('grants read permissions to moderator but denies destructive permissions', () => {
      expect(checkUserPermission({ role: 'moderator' }, PLATFORM_PERMISSIONS.USERS_READ)).toBe(true)
      expect(checkUserPermission({ role: 'moderator' }, PLATFORM_PERMISSIONS.AUDIT_READ)).toBe(true)
      expect(checkUserPermission({ role: 'moderator' }, PLATFORM_PERMISSIONS.WORKSPACES_READ)).toBe(true)
      expect(checkUserPermission({ role: 'moderator' }, PLATFORM_PERMISSIONS.USERS_MANAGE)).toBe(false)
      expect(checkUserPermission({ role: 'moderator' }, PLATFORM_PERMISSIONS.SYSTEM_MANAGE)).toBe(false)
    })

    it('evaluates custom user permission overrides', () => {
      expect(
        checkUserPermission(
          { role: 'user', permissions: { [PLATFORM_PERMISSIONS.AUDIT_READ]: true } },
          PLATFORM_PERMISSIONS.AUDIT_READ
        )
      ).toBe(true)
      expect(
        checkUserPermission(
          { role: 'user', permissions: { [PLATFORM_PERMISSIONS.AUDIT_READ]: false } },
          PLATFORM_PERMISSIONS.AUDIT_READ
        )
      ).toBe(false)
    })
  })

  describe('getAdminMetrics', () => {
    it('aggregates platform metrics and computes pro candidates', async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(10) // total
      vi.mocked(prisma.user.count).mockResolvedValueOnce(3)  // last 7d
      vi.mocked(prisma.user.count).mockResolvedValueOnce(7)  // last 30d
      vi.mocked(prisma.project.count).mockResolvedValueOnce(15) // total
      vi.mocked(prisma.project.count).mockResolvedValueOnce(12) // active
      vi.mocked(prisma.analysis.count).mockResolvedValueOnce(30) // total
      vi.mocked(prisma.analysis.count).mockResolvedValueOnce(25) // completed
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(2) // workspaces
      vi.mocked(prisma.waitlistLead.count).mockResolvedValueOnce(5) // waitlist

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        {
          id: 'u1',
          projects: [
            { id: 'p1', _count: { analyses: 2 } },
            { id: 'p2', _count: { analyses: 2 } },
            { id: 'p3', _count: { analyses: 1 } },
          ],
        },
        {
          id: 'u2',
          projects: [
            { id: 'p4', _count: { analyses: 1 } },
          ],
        },
      ] as any)

      const metrics = await getAdminMetrics()

      expect(metrics.totalUsers).toBe(10)
      expect(metrics.usersLast7Days).toBe(3)
      expect(metrics.totalProjects).toBe(15)
      expect(metrics.totalWaitlistLeads).toBe(5)
      expect(metrics.proCandidatesCount).toBe(1) // u1 has 3 projects and 5 analyses
      expect(metrics.estimatedPotentialMrr).toBe(15) // 1 * $15
    })
  })

  describe('listUsersForAdmin', () => {
    it('formats user list with calculated projects and readiness tags', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        {
          id: 'u1',
          name: 'Power Dev',
          email: 'power@dev.com',
          avatarUrl: 'https://avatar.com/1',
          githubUsername: 'powerdev',
          createdAt: new Date('2026-09-01'),
          projects: [
            { id: 'p1', _count: { analyses: 3 } },
            { id: 'p2', _count: { analyses: 3 } },
          ],
          githubAccounts: [{ id: 'ga1' }, { id: 'ga2' }],
        },
        {
          id: 'u2',
          name: 'Solo Dev',
          email: 'solo@dev.com',
          avatarUrl: null,
          githubUsername: 'solodev',
          createdAt: new Date('2026-09-15'),
          projects: [
            { id: 'p3', _count: { analyses: 1 } },
          ],
          githubAccounts: [{ id: 'ga3' }],
        },
      ] as any)

      const users = await listUsersForAdmin()

      expect(users.length).toBe(2)
      expect(users[0].name).toBe('Power Dev')
      expect(users[0].projectsCount).toBe(2)
      expect(users[0].analysesCount).toBe(6) // 3 + 3 >= 5 -> pro_candidate
      expect(users[0].subscriptionReadiness).toBe('pro_candidate')
      expect(users[0].connectedAccountsCount).toBe(2)

      expect(users[1].subscriptionReadiness).toBe('free_tier')
      expect(users[1].connectedAccountsCount).toBe(1)
    })
  })

  describe('listWaitlistLeadsForAdmin', () => {
    it('returns waitlist leads ordered by createdAt desc', async () => {
      const mockLeads = [
        { id: 'l1', email: 'lead1@example.com', source: 'pricing_pro', createdAt: new Date('2026-09-18') },
        { id: 'l2', email: 'lead2@example.com', source: 'pricing_pro', createdAt: new Date('2026-09-17') },
      ]
      vi.mocked(prisma.waitlistLead.findMany).mockResolvedValueOnce(mockLeads as any)

      const leads = await listWaitlistLeadsForAdmin()
      expect(leads.length).toBe(2)
      expect(leads[0].email).toBe('lead1@example.com')
      expect(leads[1].email).toBe('lead2@example.com')
    })
  })

  describe('deleteUserForAdmin', () => {
    it('throws error when admin tries to delete their own account', async () => {
      await expect(deleteUserForAdmin('admin-1', 'admin-1')).rejects.toThrow(
        'Self-deletion is forbidden. You cannot delete your own active administrator account.'
      )
      expect(prisma.user.delete).not.toHaveBeenCalled()
    })

    it('blocks deleting the last remaining platform administrator', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as any)
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1)

      await expect(deleteUserForAdmin('target-admin', 'admin-1')).rejects.toThrow(
        "Safety Violation: Cannot delete the platform's last administrator account."
      )
      expect(prisma.user.delete).not.toHaveBeenCalled()
    })

    it('successfully deletes a user when target is different from requesting user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'user' } as any)
      vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: 'user-2' } as any)

      const result = await deleteUserForAdmin('user-2', 'admin-1')
      expect(result.success).toBe(true)
      expect(result.deletedUserId).toBe('user-2')
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } })
    })
  })

  describe('deleteWaitlistLeadForAdmin', () => {
    it('deletes waitlist lead by id', async () => {
      vi.mocked(prisma.waitlistLead.delete).mockResolvedValueOnce({ id: 'lead-1' } as any)

      const result = await deleteWaitlistLeadForAdmin('lead-1')
      expect(result.success).toBe(true)
      expect(result.id).toBe('lead-1')
      expect(prisma.waitlistLead.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } })
    })
  })

  describe('createWaitlistLeadForAdmin', () => {
    it('upserts a waitlist lead with normalized lowercase email', async () => {
      vi.mocked(prisma.waitlistLead.upsert).mockResolvedValueOnce({
        id: 'new-lead',
        email: 'test@example.com',
        source: 'admin_manual',
        createdAt: new Date(),
      } as any)

      const result = await createWaitlistLeadForAdmin('  TEST@Example.com ')
      expect(result.success).toBe(true)
      expect(result.lead.email).toBe('test@example.com')
      expect(prisma.waitlistLead.upsert).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        update: { source: 'admin_manual' },
        create: { email: 'test@example.com', source: 'admin_manual' },
        select: {
          id: true,
          email: true,
          source: true,
          createdAt: true,
        },
      })
    })
  })

  describe('purgeFailedAnalysesForAdmin', () => {
    it('deletes failed analyses and returns count', async () => {
      vi.mocked(prisma.analysis.deleteMany).mockResolvedValueOnce({ count: 4 } as any)

      const result = await purgeFailedAnalysesForAdmin()
      expect(result.success).toBe(true)
      expect(result.purgedCount).toBe(4)
      expect(prisma.analysis.deleteMany).toHaveBeenCalledWith({
        where: { status: 'failed' },
      })
    })
  })

  describe('resetStuckAnalysesForAdmin', () => {
    it('updates timed-out analysis tasks to failed', async () => {
      vi.mocked(prisma.analysis.updateMany).mockResolvedValueOnce({ count: 2 } as any)

      const result = await resetStuckAnalysesForAdmin()
      expect(result.success).toBe(true)
      expect(result.resetCount).toBe(2)
      expect(prisma.analysis.updateMany).toHaveBeenCalled()
    })
  })

  describe('getSystemHealthForAdmin', () => {
    it('inspects database latency and returns system health metrics', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }] as any)
      vi.mocked(prisma.analysis.count).mockResolvedValueOnce(3) // failed
      vi.mocked(prisma.analysis.count).mockResolvedValueOnce(1) // active
      vi.mocked(prisma.analysis.count).mockResolvedValueOnce(0) // queued

      const health = await getSystemHealthForAdmin()
      expect(health.status).toBe('healthy')
      expect(typeof health.dbLatencyMs).toBe('number')
      expect(health.failedAnalysesCount).toBe(3)
      expect(health.activeAnalysesCount).toBe(1)
      expect(health.queuedAnalysesCount).toBe(0)
      expect(health.memoryUsage).toBeDefined()
    })
  })

  describe('getUserDetailsForAdmin', () => {
    it('returns full 360-degree developer profile and metrics', async () => {
      const mockUser = {
        id: 'u-123',
        name: 'Dev Star',
        email: 'star@example.com',
        avatarUrl: null,
        githubId: 9999,
        githubUsername: 'devstar',
        createdAt: new Date('2026-09-01'),
        updatedAt: new Date('2026-09-18'),
        aiModel: 'gpt-4o',
        openaiApiKey: 'encrypted-key',
        anthropicApiKey: null,
        role: 'user',
        status: 'active',
        plan: 'pro',
        benefits: { perks: ['unlimited_analyses'], grantedBy: 'admin-1' },
        permissions: { bypassRateLimit: true },
        projects: [
          {
            id: 'p-1',
            name: 'frontend',
            slug: 'frontend',
            repoFullName: 'devstar/frontend',
            repoUrl: 'https://github.com/devstar/frontend',
            repoPrivate: false,
            defaultBranch: 'main',
            status: 'active',
            latestScores: { overall: 85 },
            lastAnalyzedAt: new Date('2026-09-18'),
            createdAt: new Date('2026-09-02'),
            _count: { analyses: 4 },
          },
        ],
        githubAccounts: [
          {
            id: 'ga-1',
            username: 'devstar',
            accountName: 'Personal',
            tokenType: 'oauth',
            isDefault: true,
            createdAt: new Date('2026-09-01'),
          },
        ],
        memberships: [
          {
            id: 'wm-1',
            workspaceId: 'ws-1',
            role: 'owner',
            createdAt: new Date('2026-09-01'),
            workspace: {
              id: 'ws-1',
              name: 'Acme Team',
              slug: 'acme-team',
            },
          },
        ],
      }

      const mockAnalyses = [
        {
          id: 'a-1',
          projectId: 'p-1',
          status: 'completed',
          overallScore: 85,
          commitSha: 'abcdef123456',
          branch: 'main',
          createdAt: new Date('2026-09-18'),
          completedAt: new Date('2026-09-18'),
          project: { name: 'frontend', slug: 'frontend' },
        },
      ]

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any)
      vi.mocked(prisma.analysis.findMany).mockResolvedValueOnce(mockAnalyses as any)

      const details = await getUserDetailsForAdmin('u-123')

      expect(details.id).toBe('u-123')
      expect(details.name).toBe('Dev Star')
      expect(details.plan).toBe('pro')
      expect(details.hasCustomAiKeys).toBe(true)
      expect(details.projectsCount).toBe(1)
      expect(details.analysesCount).toBe(4)
      expect(details.stats.successfulAnalyses).toBe(1)
      expect(details.stats.averageOverallScore).toBe(85)
      expect(details.projects[0].name).toBe('frontend')
      expect(details.githubAccounts[0].username).toBe('devstar')
      expect(details.memberships[0].workspaceName).toBe('Acme Team')
    })

    it('throws error when user is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(getUserDetailsForAdmin('non-existent')).rejects.toThrow('User with ID non-existent not found')
    })
  })

  describe('updateUserAccessControlsForAdmin', () => {
    it('blocks self-demotion from admin role', async () => {
      await expect(
        updateUserAccessControlsForAdmin('admin-1', 'admin-1', { role: 'user' })
      ).rejects.toThrow('Self-demotion is forbidden. You cannot revoke administrative privileges from your active account.')
    })

    it('blocks self-suspension of active admin', async () => {
      await expect(
        updateUserAccessControlsForAdmin('admin-1', 'admin-1', { status: 'suspended' })
      ).rejects.toThrow('Self-suspension is forbidden. You cannot suspend your own active administrator account.')
    })

    it('blocks demoting the last remaining platform administrator', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        permissions: {},
        role: 'admin',
      } as any)
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1)

      await expect(
        updateUserAccessControlsForAdmin('target-admin', 'admin-1', { role: 'user' })
      ).rejects.toThrow("Safety Violation: Cannot demote the platform's last administrator account.")
    })

    it('updates role and status for a target user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        permissions: { bypassRateLimit: false },
      } as any)

      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: 'target-user',
        name: 'Target User',
        email: 'target@example.com',
        avatarUrl: null,
        githubUsername: 'targetuser',
        createdAt: new Date('2026-09-01'),
        role: 'moderator',
        status: 'active',
        plan: 'free',
        benefits: null,
        permissions: { bypassRateLimit: true, canAnalyzePrivate: true },
        projects: [],
        githubAccounts: [],
      } as any)

      const result = await updateUserAccessControlsForAdmin('target-user', 'admin-1', {
        role: 'moderator',
        status: 'active',
        permissions: { bypassRateLimit: true, canAnalyzePrivate: true },
      })

      expect(result.success).toBe(true)
      expect(result.user.role).toBe('moderator')
      expect(result.user.status).toBe('active')
      expect(result.user.permissions?.bypassRateLimit).toBe(true)
    })
  })

  describe('updateUserBenefitsForAdmin', () => {
    it('grants pro plan and perks payload', async () => {
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        id: 'u-1',
        name: 'Lucky Dev',
        email: 'lucky@dev.com',
        avatarUrl: null,
        githubUsername: 'luckydev',
        createdAt: new Date('2026-09-01'),
        role: 'user',
        status: 'active',
        plan: 'pro',
        benefits: {
          perks: ['unlimited_analyses', 'priority_worker'],
          customNotes: 'Hackathon VIP',
          grantedAt: new Date().toISOString(),
          grantedBy: 'admin-1',
        },
        permissions: null,
        projects: [{ id: 'p1', _count: { analyses: 2 } }],
        githubAccounts: [{ id: 'ga1' }],
      } as any)

      const result = await updateUserBenefitsForAdmin('u-1', 'admin-1', {
        plan: 'pro',
        perks: ['unlimited_analyses', 'priority_worker'],
        customNotes: 'Hackathon VIP',
      })

      expect(result.success).toBe(true)
      expect(result.user.plan).toBe('pro')
      expect(result.user.benefits?.perks).toContain('unlimited_analyses')
      expect(result.user.benefits?.customNotes).toBe('Hackathon VIP')
    })
  })

  describe('sendAdminEmail', () => {
    it('validates non-empty subject and body', async () => {
      await expect(
        sendAdminEmail(
          { targetType: 'all', subject: '', body: 'Hello' },
          'admin-1'
        )
      ).rejects.toThrow('Email subject cannot be empty.')

      await expect(
        sendAdminEmail(
          { targetType: 'all', subject: 'Subject', body: '' },
          'admin-1'
        )
      ).rejects.toThrow('Email message body cannot be empty.')
    })

    it('sends broadcast email to all active users', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 'u-1', email: 'user1@example.com', name: 'User 1' },
        { id: 'u-2', email: 'user2@example.com', name: 'User 2' },
      ] as any)

      vi.mocked(prisma.adminEmail.create).mockResolvedValueOnce({
        id: 'email-record-1',
        senderId: 'admin-1',
        subject: 'Platform Update',
        body: 'Welcome to Arbor updates',
        template: 'announcement',
        targetType: 'all',
        recipientCount: 2,
        recipientEmails: ['user1@example.com', 'user2@example.com'],
        status: 'simulated',
        createdAt: new Date(),
      } as any)

      const result = await sendAdminEmail(
        {
          targetType: 'all',
          subject: 'Platform Update',
          body: 'Welcome to Arbor updates',
          template: 'announcement',
        },
        'admin-1'
      )

      expect(result.success).toBe(true)
      expect(result.deliveredCount).toBe(2)
      expect(result.email.targetType).toBe('all')
      expect(result.email.subject).toBe('Platform Update')
      expect(prisma.adminEmail.create).toHaveBeenCalled()
    })

    it('sends email to selected users only', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 'u-1', email: 'user1@example.com', name: 'User 1' },
      ] as any)

      vi.mocked(prisma.adminEmail.create).mockResolvedValueOnce({
        id: 'email-record-2',
        senderId: 'admin-1',
        subject: 'Special Offer',
        body: 'Here is your Pro perk',
        template: 'perks_granted',
        targetType: 'selected',
        recipientCount: 1,
        recipientEmails: ['user1@example.com'],
        status: 'simulated',
        createdAt: new Date(),
      } as any)

      const result = await sendAdminEmail(
        {
          targetType: 'selected',
          userIds: ['u-1'],
          subject: 'Special Offer',
          body: 'Here is your Pro perk',
          template: 'perks_granted',
        },
        'admin-1'
      )

      expect(result.success).toBe(true)
      expect(result.deliveredCount).toBe(1)
      expect(result.email.targetType).toBe('selected')
    })
  })

  describe('listAdminEmailsForAdmin', () => {
    it('returns dispatched email logs', async () => {
      vi.mocked(prisma.adminEmail.findMany).mockResolvedValueOnce([
        {
          id: 'email-1',
          senderId: 'admin-1',
          subject: 'Welcome',
          body: 'Hi developers',
          template: 'announcement',
          targetType: 'all',
          recipientCount: 10,
          recipientEmails: ['test@example.com'],
          status: 'simulated',
          createdAt: new Date('2026-09-19'),
        },
      ] as any)

      const emails = await listAdminEmailsForAdmin()
      expect(emails.length).toBe(1)
      expect(emails[0].subject).toBe('Welcome')
      expect(emails[0].recipientCount).toBe(10)
    })
  })
})

