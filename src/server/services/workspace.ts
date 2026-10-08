import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import type { WorkspaceRole } from '@prisma/client'
import { logAuditEvent } from '@/server/services/audit'

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canEditProjects(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member'
}

export function canViewAuditLog(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function slugifyWorkspace(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'workspace'
  )
}

export async function createWorkspace(
  userId: string,
  input: {
    name: string
    slug?: string
    avatarUrl?: string
  }
) {
  const baseSlug = input.slug ? slugifyWorkspace(input.slug) : slugifyWorkspace(input.name)
  let slug = baseSlug
  let counter = 2

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: input.name,
        slug,
        avatarUrl: input.avatarUrl,
        ownerId: userId,
      },
    })

    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: 'owner',
      },
    })

    return ws
  })

  await logAuditEvent({
    userId,
    workspaceId: workspace.id,
    action: 'workspace.created',
    entityType: 'workspace',
    entityId: workspace.id,
    metadata: { name: workspace.name, slug: workspace.slug },
  })

  return workspace
}

export async function listUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return memberships.map((m: any) => ({
    ...m.workspace,
    role: m.role,
    memberCount: m.workspace._count.members,
    projectCount: m.workspace._count.projects,
  }))
}

export async function getWorkspace(userId: string, workspaceIdOrSlug: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
      members: { some: { userId } },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      projects: {
        select: {
          id: true,
          name: true,
          slug: true,
          repoFullName: true,
          latestScores: true,
          healthData: true,
          status: true,
        },
      },
    },
  })

  if (!workspace) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Workspace not found or you do not have permission to view it',
    })
  }

  const currentMember = workspace.members.find((m: any) => m.userId === userId)

  return {
    ...workspace,
    currentUserRole: currentMember?.role ?? 'viewer',
  }
}

export async function inviteMember(
  userId: string,
  input: {
    workspaceId: string
    email: string
    role: WorkspaceRole
  }
) {
  const callerMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId,
      },
    },
  })

  if (!callerMember || !canManageMembers(callerMember.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only workspace owners and admins can invite members',
    })
  }

  // Prevent inviting someone with owner role
  if (input.role === 'owner') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot invite a member with the owner role',
    })
  }

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  })

  if (existingUser) {
    const isMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: existingUser.id,
        },
      },
    })
    if (isMember) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This user is already a member of the workspace',
      })
    }
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: input.workspaceId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      tokenHash,
      expiresAt,
    },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await logAuditEvent({
    userId,
    workspaceId: input.workspaceId,
    action: 'member.invited',
    entityType: 'workspace_invitation',
    entityId: invitation.id,
    metadata: { email: input.email, role: input.role },
  })

  // The raw token is returned exactly once so the inviter can share it; only its hash is persisted.
  return { ...invitation, token }
}

export async function acceptInvitation(userId: string, token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const [invitation, user] = await Promise.all([
    prisma.workspaceInvitation.findUnique({ where: { tokenHash } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ])

  if (!invitation || invitation.status !== 'pending') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Invalid or already accepted invitation',
    })
  }

  if (!user?.email || user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This invitation belongs to a different email address.' })
  }

  if (new Date() > invitation.expiresAt) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invitation has expired',
    })
  }

  const member = await prisma.$transaction(async (tx) => {
    // The conditional write makes acceptance single-use even if requests race.
    const consumed = await tx.workspaceInvitation.updateMany({
      where: { id: invitation.id, status: 'pending', expiresAt: { gt: new Date() } },
      data: { status: 'accepted' },
    })
    if (consumed.count !== 1) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation is invalid, expired, or already accepted.' })
    }

    return tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId,
        },
      },
      // An invitation cannot escalate or overwrite a role if membership was
      // created after the invitation was issued.
      update: {},
      create: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
      },
    })
  })

  await logAuditEvent({
    userId,
    workspaceId: invitation.workspaceId,
    action: 'member.joined',
    entityType: 'workspace_member',
    entityId: member.id,
    metadata: { role: invitation.role },
  })

  return member
}

export async function removeMember(
  userId: string,
  input: {
    workspaceId: string
    targetUserId: string
  }
) {
  const callerMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId,
      },
    },
  })

  if (!callerMember || !canManageMembers(callerMember.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only workspace owners and admins can remove members',
    })
  }

  const targetMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.targetUserId,
      },
    },
  })

  if (!targetMember) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
  }

  // Prevent removing workspace owner
  if (targetMember.role === 'owner') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Cannot remove the owner of the workspace',
    })
  }

  // Admins cannot remove other admins or the owner
  if (callerMember.role === 'admin' && targetMember.role === 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admins cannot remove other admins. Only owners can do this.',
    })
  }

  await prisma.workspaceMember.delete({
    where: { id: targetMember.id },
  })

  await logAuditEvent({
    userId,
    workspaceId: input.workspaceId,
    action: 'member.removed',
    entityType: 'workspace_member',
    entityId: targetMember.id,
    metadata: { removedUserId: input.targetUserId, role: targetMember.role },
  })

  return { success: true }
}
