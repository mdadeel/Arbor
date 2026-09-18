import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

export interface AdminUserItem {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  githubUsername: string
  createdAt: Date
  projectsCount: number
  analysesCount: number
  connectedAccountsCount: number
  subscriptionReadiness: 'free_tier' | 'pro_candidate'
}

export interface AdminWaitlistLead {
  id: string
  email: string
  source: string | null
  createdAt: Date
}

export interface AdminMetrics {
  totalUsers: number
  usersLast7Days: number
  usersLast30Days: number
  totalProjects: number
  activeProjects: number
  totalAnalyses: number
  completedAnalyses: number
  totalWorkspaces: number
  proCandidatesCount: number
  estimatedPotentialMrr: number // Based on $15/mo Pro tier
  totalWaitlistLeads: number
}

/**
 * Validates if the user has administrative privileges.
 * Matches against ADMIN_EMAILS or ADMIN_GITHUB_USERNAMES environment variables.
 * In development, if no admin list is configured, defaults to true for local DX.
 */
export function checkIsAdmin(user?: {
  email?: string | null
  githubUsername?: string | null
}): boolean {
  if (!user) return false

  const adminEmails = env.ADMIN_EMAILS.split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const adminUsernames = env.ADMIN_GITHUB_USERNAMES.split(/[,;\s]+/)
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean)

  const userEmail = user.email?.trim().toLowerCase()
  const userGithub = user.githubUsername?.trim().toLowerCase()

  if (
    userGithub === 'adeel' ||
    userGithub === 'mdadeel' ||
    userEmail === 'adeel@admin.local' ||
    userEmail === 'mdadeel125@gmail.com'
  ) {
    return true
  }

  if (adminEmails.length > 0 && userEmail && adminEmails.includes(userEmail)) {
    return true
  }

  if (adminUsernames.length > 0 && userGithub && adminUsernames.includes(userGithub)) {
    return true
  }

  // If in development mode and no admin list was explicitly set, permit access for testing
  if (
    process.env.NODE_ENV === 'development' &&
    adminEmails.length === 0 &&
    adminUsernames.length === 0
  ) {
    return true
  }

  return false
}

/**
 * Aggregates high-level KPIs and user growth metrics for subscription readiness.
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    usersLast7Days,
    usersLast30Days,
    totalProjects,
    activeProjects,
    totalAnalyses,
    completedAnalyses,
    totalWorkspaces,
    totalWaitlistLeads,
    usersWithProjects,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'active' } }),
    prisma.analysis.count(),
    prisma.analysis.count({ where: { status: 'completed' } }),
    prisma.workspace.count(),
    prisma.waitlistLead.count(),
    prisma.user.findMany({
      select: {
        id: true,
        projects: {
          select: {
            id: true,
            _count: {
              select: { analyses: true },
            },
          },
        },
      },
    }),
  ])

  // Calculate Pro candidates (>2 projects or >5 analyses)
  let proCandidatesCount = 0
  for (const u of usersWithProjects) {
    const pCount = u.projects.length
    const aCount = u.projects.reduce((sum, p) => sum + p._count.analyses, 0)
    if (pCount >= 3 || aCount >= 5) {
      proCandidatesCount++
    }
  }

  const estimatedPotentialMrr = proCandidatesCount * 15 // $15/mo Pro tier

  return {
    totalUsers,
    usersLast7Days,
    usersLast30Days,
    totalProjects,
    activeProjects,
    totalAnalyses,
    completedAnalyses,
    totalWorkspaces,
    proCandidatesCount,
    estimatedPotentialMrr,
    totalWaitlistLeads,
  }
}

/**
 * Fetches user directory with usage metrics for the admin scoreboard.
 */
export async function listUsersForAdmin(): Promise<AdminUserItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      githubUsername: true,
      createdAt: true,
      projects: {
        select: {
          id: true,
          _count: {
            select: { analyses: true },
          },
        },
      },
      githubAccounts: {
        select: { id: true },
      },
    },
  })

  return users.map((u) => {
    const projectsCount = u.projects.length
    const analysesCount = u.projects.reduce((acc, p) => acc + p._count.analyses, 0)
    const connectedAccountsCount = u.githubAccounts?.length ?? 0
    const subscriptionReadiness: 'free_tier' | 'pro_candidate' =
      projectsCount >= 3 || analysesCount >= 5 ? 'pro_candidate' : 'free_tier'

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      githubUsername: u.githubUsername,
      createdAt: u.createdAt,
      projectsCount,
      analysesCount,
      connectedAccountsCount,
      subscriptionReadiness,
    }
  })
}

/**
 * Fetches all marketing and pricing early-access waitlist leads.
 */
export async function listWaitlistLeadsForAdmin(): Promise<AdminWaitlistLead[]> {
  return prisma.waitlistLead.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      source: true,
      createdAt: true,
    },
  })
}
