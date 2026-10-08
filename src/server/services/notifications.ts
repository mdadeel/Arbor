import { prisma } from '@/lib/prisma'
import type { Finding } from '@/server/analysis/types'
import { selectComparableRuns } from '@/lib/trend-utils'

const severityRank = { info: 1, warning: 2, critical: 3 } as const
export type MinimumNotificationSeverity = keyof typeof severityRank

export function shouldNotifyFindings(findings: Finding[], minimumSeverity: MinimumNotificationSeverity) {
  const threshold = severityRank[minimumSeverity]
  return findings.filter((finding) =>
    !finding.policySuppressed && severityRank[finding.severity] >= threshold
  )
}

export function scoreRegressed(previous: number | null, current: number | null, threshold: number) {
  return previous != null && current != null && previous - current >= threshold
}

export async function notifyAnalysisCompleted(
  projectId: string,
  analysisId: string,
  overallScore: number | null,
  findings: Finding[]
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      userId: true,
      workspaceId: true,
      workspace: { select: { members: { select: { userId: true } } } },
    },
  })
  if (!project) return 0

  const currentAnalysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { branch: true, analysisVersion: true, policySnapshot: true },
  })
  const previousRuns = currentAnalysis ? await prisma.analysis.findMany({
    where: {
      projectId,
      id: { not: analysisId },
      status: 'completed',
      overallScore: { not: null },
      branch: currentAnalysis.branch,
      analysisVersion: currentAnalysis.analysisVersion,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, branch: true, analysisVersion: true, policySnapshot: true, overallScore: true },
  }) : []
  const comparableRuns = currentAnalysis
    ? selectComparableRuns([
        { id: analysisId, ...currentAnalysis, overallScore },
        ...previousRuns,
      ]).rows
    : []
  const previousScore = comparableRuns.find((run) => run.id !== analysisId)?.overallScore ?? null
  const recipientIds = [...new Set(project.workspaceId
    ? project.workspace?.members.map((member) => member.userId) ?? []
    : [project.userId])].slice(0, 500)
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: recipientIds } },
  })
  const preferencesByUser = new Map(preferences.map((pref) => [pref.userId, pref]))
  let created = 0

  for (const userId of recipientIds) {
    const preference = preferencesByUser.get(userId)
    if (preference?.enabled === false) continue
    const minimumSeverity = (preference?.minimumSeverity ?? 'critical') as MinimumNotificationSeverity
    const threshold = preference?.scoreRegressionThreshold ?? 10
    const matchingFindings = shouldNotifyFindings(findings, minimumSeverity)
    const shouldAlert = matchingFindings.length > 0
    const regressed = scoreRegressed(previousScore, overallScore, threshold)
    if (!shouldAlert && !regressed) continue

    const data = []
    if (shouldAlert) {
      const criticalCount = matchingFindings.filter((finding) => finding.severity === 'critical').length
      data.push({
        userId,
        projectId,
        analysisId,
        kind: criticalCount ? 'critical_finding' as const : 'finding_alert' as const,
        dedupeKey: `analysis:${analysisId}:finding:${userId}`,
        title: criticalCount ? `${criticalCount} critical finding(s) in ${project.name}` : `Findings need review in ${project.name}`,
        body: `${matchingFindings.length} finding(s) meet your ${minimumSeverity}-or-higher notification threshold.`,
        data: { slug: project.slug, findingCount: matchingFindings.length, criticalCount },
      })
    }
    if (regressed) {
      data.push({
        userId,
        projectId,
        analysisId,
        kind: 'score_regression' as const,
        dedupeKey: `analysis:${analysisId}:regression:${userId}`,
        title: `Code health score dropped for ${project.name}`,
        body: `Overall score fell from ${previousScore} to ${overallScore} (threshold: ${threshold}).`,
        data: { slug: project.slug, previousScore, overallScore, threshold },
      })
    }

    if (data.length) {
      const result = await prisma.notification.createMany({ data, skipDuplicates: true })
      created += result.count
    }
  }
  return created
}

export async function listNotifications(userId: string, limit = 30) {
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)))
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: boundedLimit,
      include: { project: { select: { slug: true, name: true } } },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])
  return { items, unreadCount }
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count === 1 }
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count }
}

export async function getNotificationPreferences(userId: string) {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId } })
  return preference ?? {
    userId,
    enabled: true,
    minimumSeverity: 'critical',
    scoreRegressionThreshold: 10,
  }
}

export async function updateNotificationPreferences(input: {
  userId: string
  enabled: boolean
  minimumSeverity: MinimumNotificationSeverity
  scoreRegressionThreshold: number
}) {
  return prisma.notificationPreference.upsert({
    where: { userId: input.userId },
    create: input,
    update: {
      enabled: input.enabled,
      minimumSeverity: input.minimumSeverity,
      scoreRegressionThreshold: input.scoreRegressionThreshold,
    },
  })
}
