import { TRPCError } from '@trpc/server'
import { checkRateLimit } from '@/lib/redis'
import { PLAN_LIMITS, getPlanLimits, resolveEffectiveAnalysisPlan } from './plan-limits'

export const HOURLY_ANALYSIS_LIMIT = PLAN_LIMITS.free.hourlyAnalyses
export const TEAMS_HOURLY_ANALYSIS_LIMIT = PLAN_LIMITS.teams.hourlyAnalyses

/**
 * Shared hourly analysis budget enforced across manual scans, project-creation
 * auto-scans, system scans, and scheduled scans. Free workspaces and personal
 * accounts receive 10 analyses/hour; active Teams workspaces receive 60/hour.
 */
export async function consumeAnalysisQuota(
  userId: string,
  options?: { workspaceId?: string | null }
) {
  const effectivePlan = await resolveEffectiveAnalysisPlan(userId, options?.workspaceId)
  const { hourlyAnalyses } = getPlanLimits(effectivePlan)
  const scopeKey =
    effectivePlan === 'teams' && options?.workspaceId
      ? `rate:analyze:ws:${options.workspaceId}`
      : `rate:analyze:${userId}`

  const { allowed } = await checkRateLimit(scopeKey, hourlyAnalyses, 3600)
  if (!allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message:
        effectivePlan === 'teams'
          ? `Workspace analysis limit reached (${hourlyAnalyses} per hour on Teams). Please wait before triggering another scan.`
          : `Analysis limit reached (${hourlyAnalyses} per hour on Free). Upgrade a workspace to Teams for ${TEAMS_HOURLY_ANALYSIS_LIMIT} analyses per hour.`,
    })
  }
}
