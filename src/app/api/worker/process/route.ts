import { NextResponse } from 'next/server'
import fs from 'node:fs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { runAnalysis } from '@/server/analysis'
import { cloneRepo, repoDirFor } from '@/server/services/clone'
import { resolveGitHubToken } from '@/server/services/github'

export const maxDuration = 300 // Vercel Pro max: 5 minutes
export const dynamic = 'force-dynamic'

/**
 * Serverless analysis processor — picks up queued analyses and runs them inline.
 * Intended to be called by Vercel Cron (every minute) or the worker recovery path.
 * Protected by CRON_SECRET header validation.
 */
export async function GET(request: Request) {
  // Validate cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pick the oldest queued analysis
  const analysis = await prisma.analysis.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    include: { project: { include: { user: true } } },
  })

  if (!analysis) {
    return NextResponse.json({ status: 'idle', message: 'No queued analyses' })
  }

  const project = analysis.project
  const repoDir = repoDirFor(project.id)
  const started = Date.now()

  try {
    // Mark as cloning
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: 'cloning', startedAt: new Date() },
    })

    const { token: resolvedToken } = await resolveGitHubToken(
      project.userId,
      project.githubAccountId
    )

    const { sha } = await cloneRepo({
      repoUrl: project.repoUrl,
      branch: analysis.branch,
      destination: repoDir,
      token: resolvedToken ?? undefined,
    })

    // Mark as analyzing
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: 'analyzing', commitSha: sha },
    })

    const report = runAnalysis(repoDir)
    const durationMs = Date.now() - started
    const json = <T,>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue

    await prisma.$transaction([
      prisma.analysis.update({
        where: { id: analysis.id },
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

    return NextResponse.json({
      status: 'completed',
      analysisId: analysis.id,
      durationMs,
    })
  } catch (err: any) {
    await prisma.analysis
      .update({
        where: { id: analysis.id },
        data: {
          status: 'failed',
          errorMessage: err.message?.slice(0, 1000),
          completedAt: new Date(),
        },
      })
      .catch(() => {})

    return NextResponse.json(
      { status: 'failed', analysisId: analysis.id, error: err.message },
      { status: 500 }
    )
  } finally {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true })
    } catch {}
  }
}
