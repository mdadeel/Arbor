import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { router, protectedProcedure } from '@/server/trpc'
import { prisma } from '@/lib/prisma'
import { getAnalysisQueue } from '@/server/queue'
import { normalizeGitHubRepoUrl } from '@/lib/github-repo'
import { checkRateLimit } from '@/lib/redis'
import { consumeAnalysisQuota } from '@/server/services/quotas'
import { logAuditEvent } from '@/server/services/audit'
import { getProjectCommits } from '@/server/services/commits'
import {
  createProject,
  getProjectBySlug,
  listProjects,
  slugify,
} from '@/server/services/project'
import { appCache, TTL_RECENT_ANALYSES } from '@/server/services/admin-cache'
import { requireAccessibleProject, requireProjectEditor } from '@/server/services/project-access'

const repoInput = {
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  repoFullName: z.string().min(3).max(200),
  repoUrl: z.string().url(),
  defaultBranch: z.string().min(1).max(100),
  repoPrivate: z.boolean(),
  workspaceId: z.string().optional(),
}

export const projectRouter = router({
  create: protectedProcedure.input(z.object(repoInput)).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const existing = await prisma.project.findUnique({
      where: { userId_repoFullName: { userId, repoFullName: input.repoFullName } },
    })
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This repository has already been added.',
      })
    }
    let repoUrl: string
    try {
      repoUrl = normalizeGitHubRepoUrl(input.repoUrl, input.repoFullName)
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid GitHub repository URL.',
      })
    }

    const { allowed: canCreateProject } = await checkRateLimit(`rate:project-create:${userId}`, 5, 3600)
    if (!canCreateProject) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Project creation limit reached for this hour.' })
    }

    // The automatic first analysis consumes the same hourly budget as a manual scan,
    // so creating projects cannot bypass the analysis rate limit. It is consumed
    // up-front so a refused request never leaves a half-initialized project.
    await consumeAnalysisQuota(userId)

    const project = await createProject(userId, {
      ...input,
      repoFullName: input.repoFullName.trim(),
      repoUrl,
    })

    // Auto-trigger first analysis so the project doesn't sit idle
    const analysis = await prisma.analysis.create({
      data: { projectId: project.id, branch: input.defaultBranch, status: 'queued' },
    })
    await getAnalysisQueue().add('analyze', { analysisId: analysis.id }, { jobId: analysis.id })

    logAuditEvent({
      userId,
      projectId: project.id,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name, repoFullName: project.repoFullName },
    }).catch(() => {})
    appCache.clearPrefix('analyses:')
    return project
  }),
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().optional() }).optional())
    .query(({ ctx, input }) => listProjects(ctx.session.user.id, input?.workspaceId)),

  recentAnalyses: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const cacheKey = `analyses:recent:${userId}`
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    })
    const workspaceIds = new Set(memberships.map((membership) => membership.workspaceId))
    const sanitizeAccessible = (rows: any[]) => rows
      .filter((row) => row.project.workspaceId
        ? workspaceIds.has(row.project.workspaceId)
        : row.project.userId === userId)
      .map(({ project, ...row }) => ({
        ...row,
        project: { name: project.name, slug: project.slug, repoFullName: project.repoFullName },
      }))

    const cached = appCache.get<any[]>(cacheKey)
    if (cached) return sanitizeAccessible(cached)

    const result = await prisma.analysis.findMany({
      where: {
        project: {
          OR: [
            { userId, workspaceId: null },
            ...(workspaceIds.size > 0 ? [{ workspaceId: { in: [...workspaceIds] } }] : []),
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        status: true,
        createdAt: true,
        durationMs: true,
        commitSha: true,
        overallScore: true,
        project: { select: { name: true, slug: true, repoFullName: true, userId: true, workspaceId: true } },
      },
    })

    appCache.set(cacheKey, result, TTL_RECENT_ANALYSES)
    return sanitizeAccessible(result)
  }),

  bySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectBySlug(ctx.session.user.id, slugify(input.slug))
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      return project
    }),

  pullRequests: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const project = await requireAccessibleProject(ctx.session.user.id, input.slug)
      const rows = await prisma.pullRequestAnalysis.findMany({
        where: { projectId: project.id },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          number: true,
          title: true,
          baseBranch: true,
          headBranch: true,
          baseSha: true,
          headSha: true,
          status: true,
          analysisId: true,
          checkUrl: true,
          checkError: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
          analysis: { select: { overallScore: true, findings: true } },
        },
      })
      return rows.map((row) => {
        const findings = Array.isArray(row.analysis?.findings) ? row.analysis.findings : []
        const visible = findings.filter((value) => value && typeof value === 'object' && !Array.isArray(value) && !(value as { policySuppressed?: unknown }).policySuppressed)
        return {
          id: row.id,
          number: row.number,
          title: row.title,
          baseBranch: row.baseBranch,
          headBranch: row.headBranch,
          baseSha: row.baseSha,
          headSha: row.headSha,
          status: row.status,
          analysisId: row.analysisId,
          checkUrl: row.checkUrl,
          checkError: row.checkError,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          overallScore: row.analysis?.overallScore ?? null,
          findingsCount: visible.length,
          criticalCount: visible.filter((value) => (value as { severity?: unknown }).severity === 'critical').length,
          warningCount: visible.filter((value) => (value as { severity?: unknown }).severity === 'warning').length,
        }
      })
    }),

  supplyChain: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const project = await requireAccessibleProject(ctx.session.user.id, input.slug)
      const analysis = await prisma.analysis.findFirst({
        where: { projectId: project.id, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, dependencyInventory: true, dependencyAdvisories: true, sbom: true },
      })
      if (!analysis) return { analysisId: null, inventory: null, advisories: null, sbomAvailable: false }
      const inventory = analysis.dependencyInventory && typeof analysis.dependencyInventory === 'object'
        ? analysis.dependencyInventory as Record<string, unknown>
        : null
      const advisoryReport = analysis.dependencyAdvisories && typeof analysis.dependencyAdvisories === 'object'
        ? analysis.dependencyAdvisories as Record<string, unknown>
        : null
      return {
        analysisId: analysis.id,
        inventory: inventory ? {
          version: inventory.version,
          ecosystems: inventory.ecosystems,
          lockfiles: inventory.lockfiles,
          directCount: inventory.directCount,
          transitiveCount: inventory.transitiveCount,
          complete: inventory.complete,
          truncated: inventory.truncated,
          packages: Array.isArray(inventory.packages) ? inventory.packages.slice(0, 250) : [],
          packagesTruncated: Array.isArray(inventory.packages) && inventory.packages.length > 250,
        } : null,
        advisories: advisoryReport ? {
          status: advisoryReport.status,
          source: advisoryReport.source,
          checkedAt: advisoryReport.checkedAt,
          queriedCount: advisoryReport.queriedCount,
          advisoryCount: advisoryReport.advisoryCount,
          error: advisoryReport.error,
          advisories: Array.isArray(advisoryReport.advisories) ? advisoryReport.advisories.slice(0, 100) : [],
          advisoriesTruncated: Array.isArray(advisoryReport.advisories) && advisoryReport.advisories.length > 100,
        } : null,
        sbomAvailable: Boolean(analysis.sbom),
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(500).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, ...data } = input
      const project = await requireAccessibleProject(ctx.session.user.id, slug)
      await requireProjectEditor(ctx.session.user.id, project)
      const updated = await prisma.project.update({ where: { id: project.id }, data })
      appCache.clearPrefix('projects:')
      appCache.clearPrefix('project:')
      return updated
    }),

  archive: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireAccessibleProject(ctx.session.user.id, input.slug)
      await requireProjectEditor(ctx.session.user.id, project)
      const updated = await prisma.project.update({
        where: { id: project.id },
        data: { status: 'archived' },
      })
      appCache.clearPrefix('projects:')
      appCache.clearPrefix('project:')
      appCache.clearPrefix('analyses:')
      logAuditEvent({
        userId: ctx.session.user.id,
        projectId: project.id,
        workspaceId: project.workspaceId,
        action: 'project.archived',
        entityType: 'project',
        entityId: project.id,
      }).catch(() => {})
      return updated
    }),

  analyze: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireAccessibleProject(ctx.session.user.id, input.slug)
      await requireProjectEditor(ctx.session.user.id, project)

      // Shared hourly analysis budget (also consumed by project-create auto-analysis).
      await consumeAnalysisQuota(ctx.session.user.id)

      const analysis = await (async () => {
        try {
          return await prisma.$transaction(async (tx) => {
            const existingRunning = await tx.analysis.findFirst({
              where: { projectId: project.id, status: { in: ['queued', 'cloning', 'analyzing'] } },
              select: { id: true, createdAt: true },
            })
            if (existingRunning) {
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
              if (existingRunning.createdAt < tenMinutesAgo) {
                await tx.analysis.update({
                  where: { id: existingRunning.id },
                  data: {
                    status: 'failed',
                    errorMessage: 'Analysis timed out in queue. No worker was active to process the job.',
                    completedAt: new Date(),
                  },
                })
              } else {
                throw new TRPCError({ code: 'CONFLICT', message: 'An analysis is already running.' })
              }
            }
            return tx.analysis.create({
              data: { projectId: project.id, branch: project.defaultBranch, status: 'queued' },
            })
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        } catch (error) {
          if (error instanceof TRPCError) throw error
          if ((error as { code?: string })?.code === 'P2034') {
            throw new TRPCError({ code: 'CONFLICT', message: 'Another analysis was queued at the same time.' })
          }
          throw error
        }
      })()
      await getAnalysisQueue().add('analyze', { analysisId: analysis.id }, { jobId: analysis.id })

      logAuditEvent({
        userId: ctx.session.user.id,
        projectId: project.id,
        action: 'analysis.triggered',
        entityType: 'analysis',
        entityId: analysis.id,
        metadata: { branch: project.defaultBranch },
      }).catch(() => {})

      appCache.clearPrefix('projects:')
      appCache.clearPrefix('analyses:')
      return analysis
    }),

  commits: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
        branch: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getProjectCommits(ctx.session.user.id, slugify(input.slug), input.branch)
    }),
})

