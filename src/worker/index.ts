// Standalone analysis worker — separate process from the Next.js app.
// Start with: npm run worker
import './bootstrap'
import fs from 'node:fs'
import { Worker } from 'bullmq'
import { Prisma } from '@prisma/client'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { runAnalysis } from '@/server/analysis'
import { cloneRepo, repoDirFor } from '@/server/services/clone'
import { resolveGitHubToken } from '@/server/services/github'
import { recoverStaleAnalyses } from './recovery'

// Recover any analyses stuck from previous crashes and sweep stale clone folders on startup
recoverStaleAnalyses().catch((err) => {
  console.error('[worker] startup recovery error:', err.message)
})

const worker = new Worker<{ analysisId: string }>(
  'analysis',
  async (job) => {
    const { analysisId } = job.data
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: { project: { include: { user: true } } },
    })
    if (!analysis) throw new Error(`analysis ${analysisId} not found`)
    const project = analysis.project

    const started = Date.now()
    const repoDir = repoDirFor(project.id)

    const executeAnalysis = async () => {
      await job.updateProgress(10)

      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: 'cloning', startedAt: new Date() },
      })

      const { token: resolvedToken } = await resolveGitHubToken(
        project.userId,
        project.githubAccountId
      )
      const token = resolvedToken ?? undefined

      await job.updateProgress(25)

      const { sha } = await cloneRepo({
        repoUrl: project.repoUrl,
        branch: analysis.branch,
        destination: repoDir,
        token,
      })

      await job.updateProgress(50)

      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: 'analyzing', commitSha: sha },
      })

      await job.updateProgress(65)
      const report = runAnalysis(repoDir)

      await job.updateProgress(85)
      const durationMs = Date.now() - started

      const json = <T,>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue

      await prisma.$transaction([
        prisma.analysis.update({
          where: { id: analysisId },
          data: {
            status: 'completed',
            durationMs,
            completedAt: new Date(),
            overallScore: report.scores.overall,
            architectureScore: report.scores.architecture,
            techDebtScore: report.scores.techDebt,
            performanceScore: report.scores.performance,
            documentationScore: report.scores.documentation,
            securityScore: report.scores.security,
            designSystemScore: report.scores.designSystem,
            techStack: json(report.techStack),
            structure: json(report.structure),
            findings: json(report.findings),
            dependencyGraph: json(report.importGraph),
            metrics: json(report.metrics),
            designSystem: json(report.designSystem),
          },
        }),
        prisma.project.update({
          where: { id: project.id },
          data: {
            detectedStack: json(report.techStack),
            latestScores: json(report.scores),
            lastAnalyzedAt: new Date(),
          },
        }),
      ])

      await job.updateProgress(100)
      console.log(`[worker] analysis ${analysisId} completed in ${durationMs}ms`)
    }

    try {
      let timeoutId: NodeJS.Timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Analysis timed out after ${env.ANALYSIS_TIMEOUT_MS}ms`))
        }, env.ANALYSIS_TIMEOUT_MS)
      })

      await Promise.race([executeAnalysis(), timeoutPromise]).finally(() => {
        clearTimeout(timeoutId)
      })
    } finally {
      // Guaranteed cleanup: remove cloned directory on success, error, or timeout
      try {
        fs.rmSync(repoDir, { recursive: true, force: true })
      } catch (err: any) {
        console.warn(`[worker] warning during directory cleanup: ${err.message}`)
      }
    }
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 1,
    lockDuration: Math.max(30000, env.ANALYSIS_TIMEOUT_MS + 30000),
  }
)

worker.on('failed', async (job, err) => {
  const analysisId = job?.data.analysisId
  if (!analysisId) return
  console.error(`[worker] analysis ${analysisId} failed: ${err.message}`)

  // Safety net cleanup on failure
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { projectId: true },
    })
    if (analysis?.projectId) {
      fs.rmSync(repoDirFor(analysis.projectId), { recursive: true, force: true })
    }
  } catch {}

  await prisma.analysis
    .update({
      where: { id: analysisId },
      data: { status: 'failed', errorMessage: err.message?.slice(0, 1000) },
    })
    .catch(() => {})
})

worker.on('error', (err) => {
  console.error('[worker] error:', err.message)
})

console.log(`[worker] Arbor analysis worker running on ${env.REDIS_URL} (timeout: ${env.ANALYSIS_TIMEOUT_MS}ms)`)