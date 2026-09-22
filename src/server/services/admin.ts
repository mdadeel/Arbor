import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { logAuditEvent } from '@/server/services/audit'
import {
  adminCache,
  TTL_ADMIN_USER_VERIFY,
  TTL_NAVBAR_COUNTS,
  TTL_METRICS,
  TTL_USER_LIST,
  TTL_WAITLIST,
} from '@/server/services/admin-cache'

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
  role: string
  status: string
  plan: string
  benefits?: {
    perks?: string[]
    customNotes?: string
    grantedAt?: string
    grantedBy?: string
  } | null
  permissions?: {
    bypassRateLimit?: boolean
    canAnalyzePrivate?: boolean
    unlimitedProjects?: boolean
  } | null
}

export interface AdminUserDetail extends AdminUserItem {
  githubId: number
  updatedAt: Date
  aiModel?: string | null
  hasCustomAiKeys: boolean
  projects: Array<{
    id: string
    name: string
    slug: string
    repoFullName: string
    repoUrl: string
    repoPrivate: boolean
    defaultBranch: string
    status: string
    latestScores: any
    lastAnalyzedAt: Date | null
    createdAt: Date
    analysesCount: number
  }>
  analyses: Array<{
    id: string
    projectId: string
    projectName: string
    projectSlug: string
    status: string
    overallScore: number | null
    commitSha: string | null
    branch: string
    createdAt: Date
    completedAt: Date | null
  }>
  githubAccounts: Array<{
    id: string
    username: string
    accountName: string | null
    tokenType: string
    isDefault: boolean
    createdAt: Date
  }>
  memberships: Array<{
    id: string
    workspaceId: string
    workspaceName: string
    workspaceSlug: string
    role: string
    createdAt: Date
  }>
  stats: {
    totalProjects: number
    totalAnalyses: number
    successfulAnalyses: number
    failedAnalyses: number
    averageOverallScore: number | null
  }
  auditLogs?: Array<{
    id: string
    action: string
    entityType: string
    entityId: string
    metadata: any
    createdAt: Date
  }>
}

export interface AdminEmailItem {
  id: string
  senderId: string
  subject: string
  body: string
  template: string | null
  targetType: string
  recipientCount: number
  recipientEmails: string[]
  status: string
  createdAt: Date
}

export interface SendAdminEmailInput {
  targetType: 'all' | 'selected' | 'individual'
  userIds?: string[]
  subject: string
  body: string
  template?: string
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

export const PLATFORM_PERMISSIONS = {
  USERS_READ: 'admin:users:read',
  USERS_MANAGE: 'admin:users:manage',
  BENEFITS_MANAGE: 'admin:benefits:manage',
  EMAILS_BROADCAST: 'admin:emails:broadcast',
  AUDIT_READ: 'admin:audit:read',
  SYSTEM_MANAGE: 'admin:system:manage',
  WORKSPACES_READ: 'admin:workspaces:read',
} as const

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS]

export const ROLE_PERMISSIONS: Record<string, PlatformPermission[]> = {
  admin: Object.values(PLATFORM_PERMISSIONS),
  moderator: [
    PLATFORM_PERMISSIONS.USERS_READ,
    PLATFORM_PERMISSIONS.AUDIT_READ,
    PLATFORM_PERMISSIONS.WORKSPACES_READ,
  ],
  user: [],
}

/**
 * Checks if user is a system superadmin via environment variables or hardcoded owner handles.
 */
export function isSuperAdmin(user?: {
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

  return false
}

/**
 * Validates if the user has administrative privileges.
 * Checks DB roles ('admin', 'moderator'), ADMIN_EMAILS, or ADMIN_GITHUB_USERNAMES.
 * In development, if no admin list is configured, defaults to true for local DX.
 */
export function checkIsAdmin(user?: {
  email?: string | null
  githubUsername?: string | null
  role?: string | null
}): boolean {
  if (!user) return false

  if (isSuperAdmin(user)) return true

  // Database role authorization
  if (user.role === 'admin' || user.role === 'moderator') {
    return true
  }

  const adminEmails = env.ADMIN_EMAILS.split(/[,;\s]+/).filter(Boolean)
  const adminUsernames = env.ADMIN_GITHUB_USERNAMES.split(/[,;\s]+/).filter(Boolean)

  // If in development mode and no admin list was explicitly set, permit access for testing
  if (
    process.env.NODE_ENV === 'development' &&
    !user.role &&
    adminEmails.length === 0 &&
    adminUsernames.length === 0
  ) {
    return true
  }

  return false
}

/**
 * Verifies if an authenticated user possesses a specific platform permission.
 */
export function checkUserPermission(
  user: {
    email?: string | null
    githubUsername?: string | null
    role?: string | null
    permissions?: any
  } | null | undefined,
  requiredPermission: PlatformPermission
): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true

  const userRole = user.role || 'user'
  if (userRole === 'admin') return true

  const rolePerms = ROLE_PERMISSIONS[userRole] || []
  if (rolePerms.includes(requiredPermission)) return true

  if (user.permissions && typeof user.permissions === 'object') {
    if ((user.permissions as any)[requiredPermission] === true) return true
  }

  return false
}

/**
 * Fast cached navbar data and counts to ensure instant page navigation.
 */
export async function getAdminNavbarData(userId: string) {
  const userKey = `admin:user-nav:${userId}`
  let user = adminCache.get<{ email: string | null; githubUsername: string | null; role: string }>(userKey)
  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, githubUsername: true, role: true },
    })
    if (user) {
      adminCache.set(userKey, user, TTL_ADMIN_USER_VERIFY)
    }
  }

  let counts = adminCache.get<{ users: number; waitlist: number; emails: number; workspaces: number }>('admin:navbar-counts')
  if (!counts) {
    const [usersCount, waitlistCount, emailsCount, workspacesCount] = await Promise.all([
      prisma.user.count(),
      prisma.waitlistLead.count(),
      prisma.adminEmail.count().catch(() => 0),
      prisma.workspace.count().catch(() => 0),
    ])
    counts = {
      users: usersCount,
      waitlist: waitlistCount,
      emails: emailsCount,
      workspaces: workspacesCount,
    }
    adminCache.set('admin:navbar-counts', counts, TTL_NAVBAR_COUNTS)
  }

  return { user, counts }
}

/**
 * Aggregates high-level KPIs and user growth metrics for subscription readiness.
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const cached = adminCache.get<AdminMetrics>('admin:metrics')
  if (cached) return cached

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

  const result: AdminMetrics = {
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

  adminCache.set('admin:metrics', result, TTL_METRICS)
  return result
}

/**
 * Fetches user directory with usage metrics for the admin scoreboard.
 */
export async function listUsersForAdmin(): Promise<AdminUserItem[]> {
  const cached = adminCache.get<AdminUserItem[]>('admin:user-list')
  if (cached) return cached
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      githubUsername: true,
      createdAt: true,
      role: true,
      status: true,
      plan: true,
      benefits: true,
      permissions: true,
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

  const mapped = users.map((u) => {
    const projectsCount = u.projects.length
    const analysesCount = u.projects.reduce((acc, p) => acc + p._count.analyses, 0)
    const connectedAccountsCount = u.githubAccounts?.length ?? 0
    const subscriptionReadiness: 'free_tier' | 'pro_candidate' =
      u.plan === 'pro' || u.plan === 'enterprise' || u.plan === 'lifetime' || projectsCount >= 3 || analysesCount >= 5
        ? 'pro_candidate'
        : 'free_tier'

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
      role: u.role || 'user',
      status: u.status || 'active',
      plan: u.plan || 'free',
      benefits: (u.benefits as any) || null,
      permissions: (u.permissions as any) || null,
    }
  })

  adminCache.set('admin:user-list', mapped, TTL_USER_LIST)
  return mapped
}

/**
 * Fetches all marketing and pricing early-access waitlist leads.
 */
export async function listWaitlistLeadsForAdmin(): Promise<AdminWaitlistLead[]> {
  const cached = adminCache.get<AdminWaitlistLead[]>('admin:waitlist')
  if (cached) return cached

  const leads = await prisma.waitlistLead.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      source: true,
      createdAt: true,
    },
  })

  adminCache.set('admin:waitlist', leads, TTL_WAITLIST)
  return leads
}

/**
 * Deletes a user and their associated data. Protects against self-deletion.
 */
export async function deleteUserForAdmin(userId: string, requestingUserId: string): Promise<{ success: boolean; deletedUserId: string }> {
  if (userId === requestingUserId) {
    throw new Error('Self-deletion is forbidden. You cannot delete your own active administrator account.')
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (target?.role === 'admin') {
    const adminCount = await prisma.user.count({
      where: { role: 'admin' },
    })
    if (adminCount <= 1) {
      throw new Error('Safety Violation: Cannot delete the platform\'s last administrator account.')
    }
  }

  await prisma.user.delete({
    where: { id: userId },
  })

  adminCache.clearPrefix('admin:')
  return { success: true, deletedUserId: userId }
}

/**
 * Deletes an early-access waitlist lead by ID.
 */
export async function deleteWaitlistLeadForAdmin(id: string): Promise<{ success: boolean; id: string }> {
  await prisma.waitlistLead.delete({
    where: { id },
  })

  adminCache.clearPrefix('admin:')
  return { success: true, id }
}

/**
 * Manually adds or updates an early access waitlist lead.
 */
export async function createWaitlistLeadForAdmin(email: string, source: string = 'admin_manual'): Promise<{ success: boolean; lead: AdminWaitlistLead }> {
  const cleanEmail = email.toLowerCase().trim()
  const lead = await prisma.waitlistLead.upsert({
    where: { email: cleanEmail },
    update: { source },
    create: { email: cleanEmail, source },
    select: {
      id: true,
      email: true,
      source: true,
      createdAt: true,
    },
  })

  adminCache.clearPrefix('admin:')
  return { success: true, lead }
}

/**
 * Purges all failed analyses from the database.
 */
export async function purgeFailedAnalysesForAdmin(): Promise<{ success: boolean; purgedCount: number }> {
  const result = await prisma.analysis.deleteMany({
    where: { status: 'failed' },
  })

  return { success: true, purgedCount: result.count }
}

/**
 * Clears or fails analyses that have been stuck in queued/analyzing state for more than 15 minutes.
 */
export async function resetStuckAnalysesForAdmin(): Promise<{ success: boolean; resetCount: number }> {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000)
  const result = await prisma.analysis.updateMany({
    where: {
      status: { in: ['queued', 'cloning', 'analyzing'] },
      createdAt: { lte: fifteenMinsAgo },
    },
    data: {
      status: 'failed',
      errorMessage: 'Analysis terminated: processing timeout (exceeded 15 minutes)',
    },
  })

  return { success: true, resetCount: result.count }
}

export interface SystemHealthMetrics {
  status: 'healthy' | 'degraded'
  dbLatencyMs: number
  memoryUsage: {
    heapUsedMb: number
    rssMb: number
  }
  nodeVersion: string
  uptimeSeconds: number
  failedAnalysesCount: number
  activeAnalysesCount: number
  queuedAnalysesCount: number
  redisStatus?: 'healthy' | 'degraded' | 'offline'
  queueBreakdown?: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    paused: number
  }
}

/**
 * Diagnostics and live system health inspection for the admin console.
 */
export async function getSystemHealthForAdmin(): Promise<SystemHealthMetrics> {
  const start = Date.now()
  await prisma.$queryRaw`SELECT 1`
  const dbLatencyMs = Date.now() - start

  const mem = process.memoryUsage()
  const memoryUsage = {
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    rssMb: Math.round(mem.rss / 1024 / 1024),
  }

  const [failedAnalysesCount, activeAnalysesCount, queuedAnalysesCount] = await Promise.all([
    prisma.analysis.count({ where: { status: 'failed' } }),
    prisma.analysis.count({ where: { status: { in: ['cloning', 'analyzing'] } } }),
    prisma.analysis.count({ where: { status: 'queued' } }),
  ])

  let redisStatus: 'healthy' | 'degraded' | 'offline' = 'healthy'
  let queueBreakdown = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  }

  try {
    const { getAnalysisQueue } = await import('@/server/queue')
    const queue = getAnalysisQueue()
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
    queueBreakdown = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    }
  } catch {
    redisStatus = 'offline'
  }

  return {
    status: dbLatencyMs < 200 ? 'healthy' : 'degraded',
    dbLatencyMs,
    memoryUsage,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    failedAnalysesCount,
    activeAnalysesCount,
    queuedAnalysesCount,
    redisStatus,
    queueBreakdown,
  }
}

/**
 * Fetches complete 360-degree developer profile, permissions, connected repos, and analyses.
 */
export async function getUserDetailsForAdmin(userId: string): Promise<AdminUserDetail> {
  const [user, recentAnalyses, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { analyses: true },
            },
            analyses: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                overallScore: true,
                commitSha: true,
                branch: true,
                createdAt: true,
                completedAt: true,
              },
            },
          },
        },
        githubAccounts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            username: true,
            accountName: true,
            tokenType: true,
            isDefault: true,
            createdAt: true,
          },
        },
        memberships: {
          orderBy: { createdAt: 'desc' },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
    prisma.analysis.findMany({
      where: {
        project: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        project: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { userId },
          { entityType: 'user', entityId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ])

  if (!user) {
    throw new Error(`User with ID ${userId} not found`)
  }

  const projectsCount = user.projects.length
  const totalAnalyses = user.projects.reduce((acc, p) => acc + p._count.analyses, 0)
  const connectedAccountsCount = user.githubAccounts.length
  const successfulAnalyses = recentAnalyses.filter((a) => a.status === 'completed').length
  const failedAnalyses = recentAnalyses.filter((a) => a.status === 'failed').length

  const scores = recentAnalyses
    .map((a) => a.overallScore)
    .filter((s): s is number => typeof s === 'number' && s > 0)
  const averageOverallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const subscriptionReadiness: 'free_tier' | 'pro_candidate' =
    user.plan === 'pro' || user.plan === 'enterprise' || user.plan === 'lifetime' || projectsCount >= 3 || totalAnalyses >= 5
      ? 'pro_candidate'
      : 'free_tier'

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    aiModel: user.aiModel,
    hasCustomAiKeys: Boolean(user.openaiApiKey || user.anthropicApiKey),
    role: user.role || 'user',
    status: user.status || 'active',
    plan: user.plan || 'free',
    benefits: (user.benefits as any) || null,
    permissions: (user.permissions as any) || null,
    projectsCount,
    analysesCount: totalAnalyses,
    connectedAccountsCount,
    subscriptionReadiness,
    projects: user.projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      repoFullName: p.repoFullName,
      repoUrl: p.repoUrl,
      repoPrivate: p.repoPrivate,
      defaultBranch: p.defaultBranch,
      status: p.status,
      latestScores: p.latestScores,
      lastAnalyzedAt: p.lastAnalyzedAt,
      createdAt: p.createdAt,
      analysesCount: p._count.analyses,
    })),
    analyses: recentAnalyses.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      projectName: a.project.name,
      projectSlug: a.project.slug,
      status: a.status,
      overallScore: a.overallScore,
      commitSha: a.commitSha,
      branch: a.branch,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    })),
    githubAccounts: user.githubAccounts,
    memberships: user.memberships.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
      workspaceSlug: m.workspace.slug,
      role: m.role,
      createdAt: m.createdAt,
    })),
    stats: {
      totalProjects: projectsCount,
      totalAnalyses,
      successfulAnalyses,
      failedAnalyses,
      averageOverallScore,
    },
    auditLogs,
  }
}

/**
 * Updates a user's role, account status, and custom permissions.
 * Protects the requesting admin against self-demotion and self-suspension.
 */
export async function updateUserAccessControlsForAdmin(
  userId: string,
  requestingUserId: string,
  data: {
    role?: string
    status?: string
    permissions?: {
      bypassRateLimit?: boolean
      canAnalyzePrivate?: boolean
      unlimitedProjects?: boolean
    }
  }
): Promise<{ success: boolean; user: AdminUserItem }> {
  if (userId === requestingUserId) {
    if (data.role && data.role !== 'admin') {
      throw new Error('Self-demotion is forbidden. You cannot revoke administrative privileges from your active account.')
    }
    if (data.status && data.status !== 'active') {
      throw new Error('Self-suspension is forbidden. You cannot suspend your own active administrator account.')
    }
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true, role: true },
  })

  if (!existing) {
    throw new Error(`User with ID ${userId} not found`)
  }

  if (data.role && data.role !== 'admin' && existing.role === 'admin') {
    const adminCount = await prisma.user.count({
      where: { role: 'admin' },
    })
    if (adminCount <= 1) {
      throw new Error('Safety Violation: Cannot demote the platform\'s last administrator account.')
    }
  }

  const mergedPermissions = data.permissions !== undefined
    ? { ...((existing.permissions as any) || {}), ...data.permissions }
    : undefined

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(mergedPermissions !== undefined ? { permissions: mergedPermissions } : {}),
    },
    include: {
      projects: { select: { id: true, _count: { select: { analyses: true } } } },
      githubAccounts: { select: { id: true } },
    },
  })

  await logAuditEvent({
    userId: requestingUserId,
    action: 'admin.user_access_updated',
    entityType: 'user',
    entityId: userId,
    metadata: { role: data.role, status: data.status, permissions: mergedPermissions },
  })

  const projectsCount = updated.projects.length
  const analysesCount = updated.projects.reduce((acc, p) => acc + p._count.analyses, 0)

  adminCache.clearPrefix('admin:')
  return {
    success: true,
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      githubUsername: updated.githubUsername,
      createdAt: updated.createdAt,
      projectsCount,
      analysesCount,
      connectedAccountsCount: updated.githubAccounts.length,
      subscriptionReadiness:
        updated.plan === 'pro' || updated.plan === 'enterprise' || updated.plan === 'lifetime' || projectsCount >= 3 || analysesCount >= 5
          ? 'pro_candidate'
          : 'free_tier',
      role: updated.role,
      status: updated.status,
      plan: updated.plan,
      benefits: (updated.benefits as any) || null,
      permissions: (updated.permissions as any) || null,
    },
  }
}

/**
 * Grants or modifies subscription plan and custom perks for a user.
 */
export async function updateUserBenefitsForAdmin(
  userId: string,
  requestingUserId: string,
  data: {
    plan: string
    perks: string[]
    customNotes?: string
  }
): Promise<{ success: boolean; user: AdminUserItem }> {
  const benefitsPayload = {
    perks: data.perks,
    customNotes: data.customNotes || '',
    grantedAt: new Date().toISOString(),
    grantedBy: requestingUserId,
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      plan: data.plan,
      benefits: benefitsPayload,
    },
    include: {
      projects: { select: { id: true, _count: { select: { analyses: true } } } },
      githubAccounts: { select: { id: true } },
    },
  })

  await logAuditEvent({
    userId: requestingUserId,
    action: 'admin.user_benefits_updated',
    entityType: 'user',
    entityId: userId,
    metadata: { plan: data.plan, perks: data.perks, customNotes: data.customNotes },
  })

  const projectsCount = updated.projects.length
  const analysesCount = updated.projects.reduce((acc, p) => acc + p._count.analyses, 0)

  adminCache.clearPrefix('admin:')
  return {
    success: true,
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      githubUsername: updated.githubUsername,
      createdAt: updated.createdAt,
      projectsCount,
      analysesCount,
      connectedAccountsCount: updated.githubAccounts.length,
      subscriptionReadiness:
        updated.plan === 'pro' || updated.plan === 'enterprise' || updated.plan === 'lifetime' || projectsCount >= 3 || analysesCount >= 5
          ? 'pro_candidate'
          : 'free_tier',
      role: updated.role,
      status: updated.status,
      plan: updated.plan,
      benefits: (updated.benefits as any) || null,
      permissions: (updated.permissions as any) || null,
    },
  }
}

/**
 * Dispatches emails directly from the admin panel to all, selected, or individual users.
 * Uses Resend API via native fetch if RESEND_API_KEY is configured; otherwise safely logs and simulates dispatch.
 */
export async function sendAdminEmail(
  input: SendAdminEmailInput,
  requestingUserId: string
): Promise<{ success: boolean; email: AdminEmailItem; deliveredCount: number }> {
  if (!input.subject.trim()) {
    throw new Error('Email subject cannot be empty.')
  }
  if (!input.body.trim()) {
    throw new Error('Email message body cannot be empty.')
  }

  // Resolve recipients
  let users: Array<{ id: string; email: string; name: string }> = []

  if (input.targetType === 'all') {
    users = await prisma.user.findMany({
      select: { id: true, email: true, name: true },
      where: { status: 'active' },
    })
  } else {
    if (!input.userIds || input.userIds.length === 0) {
      throw new Error('Please select at least one recipient.')
    }
    users = await prisma.user.findMany({
      where: { id: { in: input.userIds } },
      select: { id: true, email: true, name: true },
    })
  }

  const recipientEmails = users.map((u) => u.email).filter(Boolean)
  if (recipientEmails.length === 0) {
    throw new Error('No valid recipient email addresses found for the chosen audience.')
  }

  let status = 'simulated'

  // If RESEND_API_KEY is set in environment, attempt real dispatch via native fetch
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Arbor Platform <support@arborgit.com>',
          to: recipientEmails.length === 1 ? recipientEmails[0] : recipientEmails,
          subject: input.subject,
          text: input.body,
        }),
      })

      if (response.ok) {
        status = 'delivered'
      } else {
        const errText = await response.text()
        console.warn('Resend API response error:', errText)
        status = 'failed'
      }
    } catch (err) {
      console.error('Failed sending email via Resend API:', err)
      status = 'failed'
    }
  }

  const record = await prisma.adminEmail.create({
    data: {
      senderId: requestingUserId,
      subject: input.subject,
      body: input.body,
      template: input.template || 'custom',
      targetType: input.targetType,
      recipientCount: recipientEmails.length,
      recipientEmails: recipientEmails,
      status,
    },
  })

  await logAuditEvent({
    userId: requestingUserId,
    action: 'admin.email_sent',
    entityType: 'broadcast_email',
    entityId: record.id,
    metadata: {
      targetType: input.targetType,
      recipientCount: recipientEmails.length,
      subject: input.subject,
      status,
    },
  })

  return {
    success: true,
    email: {
      id: record.id,
      senderId: record.senderId,
      subject: record.subject,
      body: record.body,
      template: record.template,
      targetType: record.targetType,
      recipientCount: record.recipientCount,
      recipientEmails: record.recipientEmails as string[],
      status: record.status,
      createdAt: record.createdAt,
    },
    deliveredCount: recipientEmails.length,
  }
}

/**
 * Lists past admin email dispatches and broadcast history.
 */
export async function listAdminEmailsForAdmin(): Promise<AdminEmailItem[]> {
  const records = await prisma.adminEmail.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return records.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    subject: r.subject,
    body: r.body,
    template: r.template,
    targetType: r.targetType,
    recipientCount: r.recipientCount,
    recipientEmails: (r.recipientEmails as string[]) || [],
    status: r.status,
    createdAt: r.createdAt,
  }))
}

export interface AdminAuditLogItem {
  id: string
  action: string
  entityType: string
  entityId: string
  metadata: any
  createdAt: Date
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    githubUsername: string
  }
  workspace?: {
    id: string
    name: string
    slug: string
  } | null
  project?: {
    id: string
    name: string
    slug: string
  } | null
}

/**
 * Lists audit logs for the admin platform audit trail console.
 */
export async function listAuditLogsForAdmin(filter?: {
  action?: string
  entityType?: string
  search?: string
  limit?: number
}): Promise<AdminAuditLogItem[]> {
  const limit = Math.min(filter?.limit || 50, 100)
  const where: any = {}

  if (filter?.action && filter.action !== 'all') {
    where.action = { startsWith: filter.action }
  }
  if (filter?.entityType && filter.entityType !== 'all') {
    where.entityType = filter.entityType
  }
  if (filter?.search && filter.search.trim()) {
    const term = filter.search.trim()
    where.OR = [
      { user: { email: { contains: term, mode: 'insensitive' } } },
      { user: { name: { contains: term, mode: 'insensitive' } } },
      { user: { githubUsername: { contains: term, mode: 'insensitive' } } },
      { action: { contains: term, mode: 'insensitive' } },
      { entityId: { contains: term, mode: 'insensitive' } },
    ]
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          githubUsername: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    metadata: l.metadata,
    createdAt: l.createdAt,
    user: l.user,
    workspace: l.workspace,
    project: l.project,
  }))
}

export interface AdminWorkspaceItem {
  id: string
  name: string
  slug: string
  avatarUrl: string | null
  createdAt: Date
  owner: {
    id: string
    name: string
    email: string
    githubUsername: string
    avatarUrl: string | null
  }
  membersCount: number
  projectsCount: number
  members: Array<{
    id: string
    userId: string
    role: string
    createdAt: Date
    user: {
      name: string
      email: string
      githubUsername: string
      avatarUrl: string | null
    }
  }>
}

/**
 * Lists all collaborative workspaces for the admin console.
 */
export async function listWorkspacesForAdmin(): Promise<AdminWorkspaceItem[]> {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      members: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              githubUsername: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  })

  const ownerIds = Array.from(new Set(workspaces.map((w) => w.ownerId)))
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: {
      id: true,
      name: true,
      email: true,
      githubUsername: true,
      avatarUrl: true,
    },
  })
  const ownerMap = new Map(owners.map((o) => [o.id, o]))

  return workspaces.map((w) => {
    const owner = ownerMap.get(w.ownerId) || {
      id: w.ownerId,
      name: 'Unknown Owner',
      email: 'unknown@user.local',
      githubUsername: 'unknown',
      avatarUrl: null,
    }

    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      avatarUrl: w.avatarUrl,
      createdAt: w.createdAt,
      owner,
      membersCount: w._count.members,
      projectsCount: w._count.projects,
      members: w.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
      })),
    }
  })
}
