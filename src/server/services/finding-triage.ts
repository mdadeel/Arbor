import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { fingerprintFinding } from '@/server/analysis/finding-fingerprint'
import type { Finding } from '@/server/analysis/types'
import { logAuditEvent } from './audit'
import { requireAccessibleProject, requireProjectEditor } from './project-access'

export const FINDING_TRIAGE_STATUSES = ['open', 'accepted_risk', 'false_positive', 'resolved'] as const
type FindingTriageStatusName = (typeof FINDING_TRIAGE_STATUSES)[number]

export async function listFindingTriage(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  const triages = await prisma.findingTriage.findMany({
    where: { projectId: project.id },
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  })
  return triages
}

export async function updateFindingTriage(input: {
  userId: string
  slug: string
  finding: Pick<Finding, 'id' | 'ruleId' | 'file' | 'title'>
  status: FindingTriageStatusName
  assigneeId?: string | null
  note?: string | null
}) {
  const project = await requireAccessibleProject(input.userId, input.slug)
  await requireProjectEditor(input.userId, project)
  const fingerprint = fingerprintFinding(input.finding)

  if (input.assigneeId) {
    if (project.workspaceId) {
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: input.assigneeId } },
        select: { id: true },
      })
      if (!member) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Assignee must be a member of the project workspace.' })
    } else if (input.assigneeId !== input.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Personal projects can only be assigned to their owner.' })
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.findingTriage.findUnique({
      where: { projectId_fingerprint: { projectId: project.id, fingerprint } },
    })
    const triage = await tx.findingTriage.upsert({
      where: { projectId_fingerprint: { projectId: project.id, fingerprint } },
      create: {
        projectId: project.id,
        fingerprint,
        ruleId: input.finding.ruleId ?? input.finding.id,
        title: input.finding.title.slice(0, 240),
        status: input.status,
        assigneeId: input.assigneeId ?? null,
        note: input.note?.slice(0, 4000) ?? null,
        updatedById: input.userId,
      },
      update: {
        ruleId: input.finding.ruleId ?? input.finding.id,
        title: input.finding.title.slice(0, 240),
        status: input.status,
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.note !== undefined ? { note: input.note?.slice(0, 4000) ?? null } : {}),
        updatedById: input.userId,
      },
    })
    await tx.findingTriageEvent.create({
      data: {
        triageId: triage.id,
        actorId: input.userId,
        fromStatus: existing?.status ?? null,
        toStatus: input.status,
        note: input.note?.slice(0, 4000) ?? null,
      },
    })
    return triage
  })

  await logAuditEvent({
    userId: input.userId,
    projectId: project.id,
    workspaceId: project.workspaceId,
    action: 'finding.triaged',
    entityType: 'finding_triage',
    entityId: result.id,
    metadata: { fingerprint, status: input.status, ruleId: input.finding.ruleId ?? input.finding.id },
  })
  return result
}

export async function getFindingTriageHistory(userId: string, slug: string, fingerprint: string) {
  const project = await requireAccessibleProject(userId, slug)
  const triage = await prisma.findingTriage.findFirst({
    where: { projectId: project.id, fingerprint },
    select: { id: true },
  })
  if (!triage) return []
  return prisma.findingTriageEvent.findMany({
    where: { triageId: triage.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}
