import type { SubscriptionStatus, WorkspacePlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const TEAMS_MONTHLY_PRICE_USD = 15

export interface WorkspacePlanLimits {
  plan: WorkspacePlan
  label: string
  monthlyPriceUsd: number
  hourlyAnalyses: number
  maxWorkspaceMembers: number
  maxScheduledScans: number
}

export const PLAN_LIMITS: Record<WorkspacePlan, WorkspacePlanLimits> = {
  free: {
    plan: 'free',
    label: 'Free',
    monthlyPriceUsd: 0,
    hourlyAnalyses: 10,
    maxWorkspaceMembers: 5,
    maxScheduledScans: 3,
  },
  teams: {
    plan: 'teams',
    label: 'Teams',
    monthlyPriceUsd: TEAMS_MONTHLY_PRICE_USD,
    hourlyAnalyses: 60,
    maxWorkspaceMembers: 50,
    maxScheduledScans: 50,
  },
}

export function getPlanLimits(plan: WorkspacePlan): WorkspacePlanLimits {
  return PLAN_LIMITS[plan]
}

export function isSubscriptionEntitled(
  status: SubscriptionStatus,
  endsAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (status === 'active' || status === 'on_trial' || status === 'past_due') {
    return true
  }
  if (status === 'cancelled') {
    return Boolean(endsAt && endsAt.getTime() > now.getTime())
  }
  return false
}

export function resolveEffectiveWorkspacePlanFromRecord(
  workspace:
    | {
        plan?: WorkspacePlan
        subscription?: {
          status: SubscriptionStatus
          endsAt?: Date | null
        } | null
      }
    | null
    | undefined,
  now: Date = new Date()
): WorkspacePlan {
  if (!workspace) return 'free'
  if (workspace.subscription) {
    return isSubscriptionEntitled(workspace.subscription.status, workspace.subscription.endsAt, now)
      ? 'teams'
      : 'free'
  }
  return workspace.plan === 'teams' ? 'teams' : 'free'
}

export async function getEffectiveWorkspacePlan(
  workspaceId: string | null | undefined
): Promise<WorkspacePlan> {
  if (!workspaceId || typeof prisma.workspace?.findUnique !== 'function') {
    return 'free'
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
      subscription: {
        select: {
          status: true,
          endsAt: true,
        },
      },
    },
  })

  return resolveEffectiveWorkspacePlanFromRecord(workspace)
}

export async function resolveEffectiveAnalysisPlan(
  userId: string,
  workspaceId?: string | null
): Promise<WorkspacePlan> {
  if (workspaceId) {
    return getEffectiveWorkspacePlan(workspaceId)
  }

  if (typeof prisma.workspace?.findMany !== 'function') {
    return 'free'
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: {
      plan: true,
      subscription: {
        select: {
          status: true,
          endsAt: true,
        },
      },
    },
  })

  const now = new Date()
  return workspaces.some((ws) => resolveEffectiveWorkspacePlanFromRecord(ws, now) === 'teams')
    ? 'teams'
    : 'free'
}
