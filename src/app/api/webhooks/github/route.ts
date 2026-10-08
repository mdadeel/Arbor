import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { getAnalysisQueue } from '@/server/queue'
import { closePullRequestCheck } from '@/server/services/pull-request-checks'
import { canReclaimWebhookDelivery, isValidGitHubDeliveryId, MAX_GITHUB_WEBHOOK_BYTES, verifyGitHubWebhookSignature } from '@/lib/github-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const hexSha = /^[a-f0-9]{40,64}$/i
const pullRequestEventSchema = z.object({
  action: z.string().min(1).max(50),
  number: z.number().int().positive().max(1_000_000),
  repository: z.object({ full_name: z.string().min(3).max(200) }),
  pull_request: z.object({
    title: z.string().max(1000),
    state: z.enum(['open', 'closed']).optional(),
    base: z.object({ ref: z.string().min(1).max(255), sha: z.string().regex(hexSha) }),
    head: z.object({ ref: z.string().min(1).max(255), sha: z.string().regex(hexSha) }),
  }),
})

async function readBodyLimited(request: Request): Promise<Uint8Array | null> {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GITHUB_WEBHOOK_BYTES) return null
  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > MAX_GITHUB_WEBHOOK_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function duplicateResponse() {
  return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 })
}

async function claimDelivery(deliveryId: string, event: string, action: string | null, repository: string | null) {
  const existing = await prisma.gitHubWebhookDelivery.findUnique({ where: { id: deliveryId } })
  if (!existing) {
    try {
      await prisma.gitHubWebhookDelivery.create({
        data: { id: deliveryId, event, action, repository, status: 'processing' },
      })
      return true
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error
    }
  }

  const current = existing ?? await prisma.gitHubWebhookDelivery.findUnique({ where: { id: deliveryId } })
  if (!current || !canReclaimWebhookDelivery(current.status, current.updatedAt)) return false

  const staleProcessing = current.status === 'processing'
  const claimed = await prisma.gitHubWebhookDelivery.updateMany({
    where: {
      id: deliveryId,
      status: staleProcessing ? 'processing' : 'failed',
      ...(staleProcessing ? { updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } } : {}),
    },
    data: { status: 'processing', errorMessage: null, event, action, repository },
  })
  return claimed.count === 1
}

export async function POST(request: Request) {
  if (!env.GITHUB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'GitHub webhook is not configured.' }, { status: 503 })
  }

  const deliveryId = request.headers.get('x-github-delivery')
  if (!isValidGitHubDeliveryId(deliveryId)) {
    return NextResponse.json({ error: 'Invalid GitHub delivery id.' }, { status: 400 })
  }

  const body = await readBodyLimited(request)
  if (!body) return NextResponse.json({ error: 'Webhook payload exceeds 1 MB.' }, { status: 413 })
  if (!verifyGitHubWebhookSignature(body, request.headers.get('x-hub-signature-256'), env.GITHUB_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  const event = request.headers.get('x-github-event') ?? 'unknown'
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body).toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 })
  }

  const parsed = pullRequestEventSchema.safeParse(payload)
  const action = parsed.success ? parsed.data.action : null
  const repository = parsed.success ? parsed.data.repository.full_name : null
  const claimed = await claimDelivery(deliveryId, event, action, repository)
  if (!claimed) return duplicateResponse()

  if (event !== 'pull_request' || !parsed.success) {
    await prisma.gitHubWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'ignored',
        errorMessage: event === 'pull_request' ? 'Unsupported or malformed pull_request payload.' : null,
      },
    })
    return NextResponse.json({ accepted: true, ignored: true }, { status: 202 })
  }

  const { data } = parsed
  const supportedActions = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review'])
  if (data.action === 'closed') {
    const projects = await prisma.project.findMany({
      where: { repoFullName: { equals: data.repository.full_name, mode: 'insensitive' } },
      select: { id: true },
    })
    if (projects.length) {
      const projectIds = projects.map((project) => project.id)
      const pendingRuns = await prisma.pullRequestAnalysis.findMany({
        where: { projectId: { in: projectIds }, number: data.number, status: { in: ['queued', 'analyzing'] } },
        select: { analysisId: true },
        take: 100,
      })
      await prisma.pullRequestAnalysis.updateMany({
        where: { projectId: { in: projectIds }, number: data.number, status: { in: ['queued', 'analyzing'] } },
        data: { status: 'closed', completedAt: new Date() },
      })
      const queuedAnalysisIds = pendingRuns.map((run) => run.analysisId).filter((id): id is string => Boolean(id))
      if (queuedAnalysisIds.length) {
        await prisma.analysis.updateMany({
          where: { id: { in: queuedAnalysisIds }, status: 'queued' },
          data: { status: 'failed', errorMessage: 'Pull request was closed before analysis started.', completedAt: new Date() },
        })
      }
      for (const run of pendingRuns) {
        if (run.analysisId) await closePullRequestCheck(run.analysisId)
      }
    }
    await prisma.gitHubWebhookDelivery.update({ where: { id: deliveryId }, data: { status: 'ignored' } })
    return NextResponse.json({ accepted: true, closed: true }, { status: 202 })
  }

  if (!supportedActions.has(data.action)) {
    await prisma.gitHubWebhookDelivery.update({ where: { id: deliveryId }, data: { status: 'ignored' } })
    return NextResponse.json({ accepted: true, ignored: true }, { status: 202 })
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        repoFullName: { equals: data.repository.full_name, mode: 'insensitive' },
        status: 'active',
      },
      select: { id: true, repoFullName: true },
      take: 100,
    })

    if (projects.length === 0) {
      await prisma.gitHubWebhookDelivery.update({ where: { id: deliveryId }, data: { status: 'ignored' } })
      return NextResponse.json({ accepted: true, tracked: false }, { status: 202 })
    }

    const jobs = await prisma.$transaction(async (tx) => {
      const createdJobs: { analysisId: string }[] = []
      for (const project of projects) {
        let prAnalysis = await tx.pullRequestAnalysis.upsert({
          where: {
            projectId_number_headSha: {
              projectId: project.id,
              number: data.number,
              headSha: data.pull_request.head.sha,
            },
          },
          create: {
            projectId: project.id,
            number: data.number,
            title: data.pull_request.title.slice(0, 1000) || `Pull request #${data.number}`,
            baseBranch: data.pull_request.base.ref,
            headBranch: data.pull_request.head.ref,
            baseSha: data.pull_request.base.sha,
            headSha: data.pull_request.head.sha,
            status: 'queued',
          },
          update: {},
        })

        if (prAnalysis.status === 'failed' || prAnalysis.status === 'closed') {
          prAnalysis = await tx.pullRequestAnalysis.update({
            where: { id: prAnalysis.id },
            data: { status: 'queued', errorMessage: null, checkError: null, checkRunId: null, checkUrl: null, completedAt: null, analysisId: null },
          })
        }
        if (prAnalysis.status !== 'queued') continue

        let analysisId = prAnalysis.analysisId
        if (!analysisId) {
          const analysis = await tx.analysis.create({
            data: {
              projectId: project.id,
              branch: data.pull_request.head.ref,
              requestedCommitSha: data.pull_request.head.sha,
              status: 'queued',
            },
            select: { id: true },
          })
          analysisId = analysis.id
          await tx.pullRequestAnalysis.update({ where: { id: prAnalysis.id }, data: { analysisId } })
        }
        createdJobs.push({ analysisId })
      }
      return createdJobs
    })

    for (const job of jobs) {
      await getAnalysisQueue().add('analyze', job, { jobId: job.analysisId })
    }

    await prisma.gitHubWebhookDelivery.update({ where: { id: deliveryId }, data: { status: jobs.length ? 'queued' : 'ignored' } })
    return NextResponse.json({ accepted: true, queued: jobs.length }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unexpected webhook processing error.'
    await prisma.gitHubWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'failed', errorMessage: message },
    }).catch(() => {})
    return NextResponse.json({ error: 'Webhook processing failed; GitHub may safely retry this delivery.' }, { status: 500 })
  }
}
