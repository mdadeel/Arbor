import { createHash, randomBytes } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import { logAuditEvent } from './audit'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createReportShareLink(input: {
  userId: string
  slug: string
  analysisId: string
  expiresInDays: number
}) {
  const project = await requireAccessibleProject(input.userId, input.slug)
  await requireProjectEditor(input.userId, project)
  const analysis = await prisma.analysis.findFirst({
    where: { id: input.analysisId, projectId: project.id, status: 'completed' },
    select: { id: true },
  })
  if (!analysis) throw new TRPCError({ code: 'NOT_FOUND', message: 'Completed analysis not found.' })

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
  const link = await prisma.reportShareLink.create({
    data: {
      tokenHash: hashToken(token),
      analysisId: analysis.id,
      projectId: project.id,
      createdById: input.userId,
      expiresAt,
    },
    select: { id: true, createdAt: true, expiresAt: true },
  })
  await logAuditEvent({
    userId: input.userId,
    projectId: project.id,
    workspaceId: project.workspaceId,
    action: 'report_share.created',
    entityType: 'report_share_link',
    entityId: link.id,
    metadata: { analysisId: analysis.id, expiresAt: expiresAt.toISOString() },
  })
  return { ...link, token }
}

export async function listReportShareLinks(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  await requireProjectEditor(userId, project)
  return prisma.reportShareLink.findMany({
    where: { projectId: project.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, analysisId: true, expiresAt: true, revokedAt: true, createdAt: true },
  })
}

export async function revokeReportShareLink(userId: string, slug: string, id: string) {
  const project = await requireAccessibleProject(userId, slug)
  await requireProjectEditor(userId, project)
  const result = await prisma.reportShareLink.updateMany({
    where: { id, projectId: project.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count === 1) {
    await logAuditEvent({
      userId,
      projectId: project.id,
      workspaceId: project.workspaceId,
      action: 'report_share.revoked',
      entityType: 'report_share_link',
      entityId: id,
    })
  }
  return { revoked: result.count === 1 }
}

export async function getSharedReport(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const link = await prisma.reportShareLink.findFirst({
    where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      expiresAt: true,
      analysis: {
        select: {
          id: true,
          status: true,
          branch: true,
          commitSha: true,
          overallScore: true,
          architectureScore: true,
          techDebtScore: true,
          performanceScore: true,
          documentationScore: true,
          securityScore: true,
          designSystemScore: true,
          findings: true,
          createdAt: true,
          project: { select: { name: true } },
        },
      },
    },
  })
  if (!link || link.analysis.status !== 'completed') return null

  const rawFindings = Array.isArray(link.analysis.findings) ? link.analysis.findings : []
  const findings = rawFindings.slice(0, 200).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const finding = raw as Record<string, unknown>
    const safeFields = [
      'id', 'ruleId', 'title', 'category', 'severity', 'detail', 'explanation', 'impact',
      'recommendation', 'confidence', 'evidence', 'file', 'line', 'policyPack', 'policyVersion', 'policySuppressed',
    ]
    return Object.fromEntries(safeFields
      .filter((key) => key in finding)
      .map((key) => [key, finding[key]]))
  }).filter(Boolean)

  return {
    sharedUntil: link.expiresAt,
    analysis: {
      id: link.analysis.id,
      projectName: link.analysis.project.name,
      branch: link.analysis.branch,
      commitSha: link.analysis.commitSha,
      scores: {
        overall: link.analysis.overallScore,
        architecture: link.analysis.architectureScore,
        techDebt: link.analysis.techDebtScore,
        performance: link.analysis.performanceScore,
        documentation: link.analysis.documentationScore,
        security: link.analysis.securityScore,
        designSystem: link.analysis.designSystemScore,
      },
      findings,
      createdAt: link.analysis.createdAt,
    },
  }
}
