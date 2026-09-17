import { prisma } from '@/lib/prisma'

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

  // Verify access
  if (options.workspaceId) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: options.workspaceId,
          userId,
        },
      },
    })
    if (!isMember) {
      throw new Error('Unauthorized: User is not a member of this workspace')
    }
  }

  if (options.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: options.projectId,
        OR: [
          { userId },
          { workspace: { members: { some: { userId } } } },
        ],
      },
    })
    if (!project) {
      throw new Error('Unauthorized: User does not have access to this project')
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
