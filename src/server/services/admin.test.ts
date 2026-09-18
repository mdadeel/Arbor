import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkIsAdmin, getAdminMetrics, listUsersForAdmin, listWaitlistLeadsForAdmin } from './admin'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    project: {
      count: vi.fn(),
    },
    analysis: {
      count: vi.fn(),
    },
    workspace: {
      count: vi.fn(),
    },
    waitlistLead: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
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

    it('strictly returns false for unauthorized users', () => {
      expect(checkIsAdmin({ email: 'regular@user.com', githubUsername: 'randomuser' })).toBe(false)
      expect(checkIsAdmin({ email: 'intruder@evil.corp', githubUsername: 'hacker' })).toBe(false)
      expect(checkIsAdmin({ email: 'unknown@test.com' })).toBe(false)
      expect(checkIsAdmin({ githubUsername: 'otherperson' })).toBe(false)
      expect(checkIsAdmin()).toBe(false)
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
})
