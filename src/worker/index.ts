// Standalone analysis worker — separate process from the Next.js app.
// Start with: npm run worker
import './bootstrap'
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'bullmq'
import { Prisma } from '@prisma/client'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { runAnalysis } from '@/server/analysis'
import { cloneRepo, repoDirFor } from '@/server/services/clone'

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

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'cloning', startedAt: new Date() },
    })

    let token: string | undefined
    if (project.user.githubAccessToken) {
      token = decrypt(project.user.githubAccessToken)
    }

    const { sha } = await cloneRepo({
      repoUrl: project.repoUrl,
      branch: analysis.branch,
      destination: repoDir,
      token,
    })

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'analyzing', commitSha: sha },
    })

    const report = runAnalysis(repoDir)
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
          techStack: json(report.techStack),
          structure: json(report.structure),
          findings: json(report.findings),
          dependencyGraph: json(report.importGraph),
          metrics: json(report.metrics),
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

    fs.rmSync(repoDir, { recursive: true, force: true })
    console.log(`[worker] analysis ${analysisId} completed in ${durationMs}ms`)
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 1,
  }
)

worker.on('failed', async (job, err) => {
  const analysisId = job?.data.analysisId
  if (!analysisId) return
  console.error(`[worker] analysis ${analysisId} failed: ${err.message}`)
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

console.log(`[worker] DevHub analysis worker running on ${env.REDIS_URL}`)