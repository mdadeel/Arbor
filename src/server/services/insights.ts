import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { getAnalysisQueue } from '@/server/queue'
import { consumeAnalysisQuota } from './quotas'
import type { Finding } from '@/server/analysis/types'
import { isSafeGitRef, nextScheduleTime, type ScanCadenceName } from '@/lib/schedule-utils'
import { selectComparableRuns } from '@/lib/trend-utils'
import { requireAccessibleProject, requireProjectEditor } from './project-access'

export async function getProjectTrend(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  const rows = await prisma.analysis.findMany({
    where: { projectId: project.id, status: 'completed', overallScore: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      branch: true,
      commitSha: true,
      analysisVersion: true,
      policySnapshot: true,
      overallScore: true,
      architectureScore: true,
      techDebtScore: true,
      performanceScore: true,
      documentationScore: true,
      securityScore: true,
      designSystemScore: true,
      findings: true,
    },
  })

  // Cross-branch comparisons and changes in analyzer/policy semantics can be misleading.
  const trendSelection = selectComparableRuns(rows)
  const series = [...trendSelection.rows].reverse().map((row) => {
    const findings = Array.isArray(row.findings) ? row.findings as unknown as Finding[] : []
    const visible = findings.filter((finding) => !finding.policySuppressed)
    return {
      id: row.id,
      createdAt: row.createdAt,
      branch: row.branch,
      commitSha: row.commitSha,
      overallScore: row.overallScore,
      architectureScore: row.architectureScore,
      techDebtScore: row.techDebtScore,
      performanceScore: row.performanceScore,
      documentationScore: row.documentationScore,
      securityScore: row.securityScore,
      designSystemScore: row.designSystemScore,
      findingsCount: visible.length,
      criticalCount: visible.filter((finding) => finding.severity === 'critical').length,
      warningCount: visible.filter((finding) => finding.severity === 'warning').length,
    }
  })
  const latest = series.at(-1) ?? null
  const previous = series.at(-2) ?? null
  return {
    series,
    latest,
    previous,
    branch: trendSelection.branch,
    analysisVersion: trendSelection.analysisVersion,
    excludedRuns: trendSelection.excludedRuns,
    delta: latest && previous ? {
      overallScore: (latest.overallScore ?? 0) - (previous.overallScore ?? 0),
      findingsCount: latest.findingsCount - previous.findingsCount,
      criticalCount: latest.criticalCount - previous.criticalCount,
    } : null,
  }
}

export async function getProjectScanSchedule(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  return prisma.scanSchedule.findUnique({ where: { projectId: project.id } })
}

export async function updateProjectScanSchedule(input: {
  userId: string
  slug: string
  enabled: boolean
  cadence: ScanCadenceName
  branch?: string
}) {
  const project = await requireAccessibleProject(input.userId, input.slug)
  await requireProjectEditor(input.userId, project)
  const branch = (input.branch || project.defaultBranch).trim()
  if (!isSafeGitRef(branch)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'The branch name is not a valid Git ref.' })

  const existing = await prisma.scanSchedule.findUnique({ where: { projectId: project.id } })
  const shouldReschedule = !existing || existing.enabled !== input.enabled || existing.cadence !== input.cadence || existing.branch !== branch
  const nextRunAt = input.enabled
    ? shouldReschedule ? new Date(Date.now() + 60_000) : existing.nextRunAt
    : existing?.nextRunAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)
  return prisma.scanSchedule.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      cadence: input.cadence,
      enabled: input.enabled,
      branch,
      nextRunAt,
      createdById: input.userId,
    },
    update: {
      cadence: input.cadence,
      enabled: input.enabled,
      branch,
      nextRunAt,
      lastError: null,
    },
  })
}

/**
 * Dispatch due schedules from the durable database. The compare-and-swap on
 * nextRunAt makes multiple workers safe; queued analysis recovery handles a
 * crash between the SQL transaction and BullMQ add.
 */
export async function enqueueDueScheduledScans(now = new Date()) {
  const schedules = await prisma.scanSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: 'asc' },
    take: 100,
    select: { id: true, projectId: true, cadence: true, branch: true, nextRunAt: true },
  })
  let enqueued = 0
  const queue = getAnalysisQueue()

  for (const schedule of schedules) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.scanSchedule.updateMany({
          where: { id: schedule.id, enabled: true, nextRunAt: { lte: now } },
          data: {
            lastRunAt: now,
            nextRunAt: nextScheduleTime(schedule.cadence, schedule.nextRunAt, now),
            lastError: null,
          },
        })
        if (claimed.count === 0) return null

        const project = await tx.project.findUnique({
          where: { id: schedule.projectId },
          select: { id: true, status: true, userId: true },
        })
        if (!project || project.status !== 'active') {
          await tx.scanSchedule.update({ where: { id: schedule.id }, data: { enabled: false, lastError: 'Project is archived or unavailable.' } })
          return null
        }
        const activeAnalysis = await tx.analysis.findFirst({
          where: { projectId: schedule.projectId, status: { in: ['queued', 'cloning', 'analyzing'] } },
          select: { id: true },
        })
        if (activeAnalysis) {
          await tx.scanSchedule.update({ where: { id: schedule.id }, data: { lastError: 'Skipped because another analysis was already active.' } })
          return null
        }
        try {
          await consumeAnalysisQuota(project.userId)
        } catch (error) {
          if (error instanceof TRPCError && error.code === 'TOO_MANY_REQUESTS') {
            await tx.scanSchedule.update({
              where: { id: schedule.id },
              data: { nextRunAt: new Date(now.getTime() + 60 * 60_000), lastError: 'Analysis quota reached; this scan will retry after the hourly window.' },
            })
            return null
          }
          throw error
        }
        return tx.analysis.create({
          data: { projectId: schedule.projectId, branch: schedule.branch, status: 'queued' },
          select: { id: true },
        })
      })
      if (!result) continue
      await queue.add('analyze', { analysisId: result.id }, { jobId: result.id })
      enqueued++
    } catch (error) {
      await prisma.scanSchedule.update({
        where: { id: schedule.id },
        data: { lastError: (error instanceof Error ? error.message : 'Scheduled scan failed.').slice(0, 500) },
      }).catch(() => {})
    }
  }
  return enqueued
}
