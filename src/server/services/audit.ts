import { prisma } from '@/lib/prisma'
import { requireWorkspaceMembership, WORKSPACE_AUDIT_ROLES } from './authorization'

export interface LogAuditOptions {
  userId: string
  workspaceId?: string | null
  projectId?: string | null
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown> | null
}

export async function logAuditEvent(options: LogAuditOptions) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: options.userId,
        workspaceId: options.workspaceId ?? undefined,
        projectId: options.projectId ?? undefined,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        metadata: (options.metadata as unknown as object) ?? undefined,
      },
    })
  } catch (error) {
    // Audit logging should never crash the primary user flow
    console.error('Failed to record audit log:', error)
    return null
  }
}

export async function listAuditLogs(
  userId: string,
  options: {
    workspaceId?: string
    projectId?: string
    limit?: number
  } = {}
) {
  const limit = Math.min(options.limit ?? 50, 100)

  // Workspace audit records can contain actor PII and sensitive metadata, so
  // workspace membership alone is not sufficient: only owners/admins may read.
  if (options.workspaceId) {
    await requireWorkspaceMembership(userId, options.workspaceId, WORKSPACE_AUDIT_ROLES)
  }

  if (options.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: options.projectId,
        OR: [
          { userId, workspaceId: null },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      select: { id: true, userId: true, workspaceId: true },
    })
    if (!project) {
      throw new Error('Unauthorized: User does not have access to this project')
    }
    if (project.workspaceId) {
      await requireWorkspaceMembership(userId, project.workspaceId, WORKSPACE_AUDIT_ROLES)
    }
  }

  return prisma.auditLog.findMany({
    where: {
      ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(!options.workspaceId && !options.projectId ? { userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })
}
