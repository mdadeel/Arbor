import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'

export type WorkspaceRoleName = 'owner' | 'admin' | 'member' | 'viewer'

const EDIT_PROJECT_ROLES: readonly WorkspaceRoleName[] = ['owner', 'admin', 'member']
const ADMIN_ROLES: readonly WorkspaceRoleName[] = ['owner', 'admin']

export async function requireWorkspaceMembership(
  userId: string,
  workspaceId: string,
  allowedRoles?: readonly WorkspaceRoleName[]
): Promise<{ id: string; role: WorkspaceRoleName }> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true, role: true },
  })

  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Workspace access is required.' })
  }
  if (allowedRoles && !allowedRoles.includes(membership.role as WorkspaceRoleName)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Your workspace role cannot perform this action.' })
  }

  return membership as { id: string; role: WorkspaceRoleName }
}

export function canEditWorkspaceProjects(role: WorkspaceRoleName): boolean {
  return EDIT_PROJECT_ROLES.includes(role)
}

export async function requireProjectIdsAccessible(
  userId: string,
  projectIds: string[],
  workspaceId?: string
): Promise<void> {
  const uniqueIds = [...new Set(projectIds)]
  if (uniqueIds.length !== projectIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A project can only be added to a group once.' })
  }
  if (uniqueIds.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one project is required.' })
  }

  if (workspaceId) {
    await requireWorkspaceMembership(userId, workspaceId, EDIT_PROJECT_ROLES)
  }

  const where = workspaceId
    ? { id: { in: uniqueIds }, workspaceId }
    : {
        id: { in: uniqueIds },
        OR: [
          { userId, workspaceId: null },
          { workspace: { members: { some: { userId } } } },
        ],
      }
  const projects = await prisma.project.findMany({ where, select: { id: true } })

  if (projects.length !== uniqueIds.length) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Every project must be owned by you or accessible within the selected workspace.',
    })
  }
}

export const WORKSPACE_AUDIT_ROLES = ADMIN_ROLES
export const WORKSPACE_PROJECT_ROLES = EDIT_PROJECT_ROLES
