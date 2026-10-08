import { TRPCError } from '@trpc/server'
import { checkRateLimit } from '@/lib/redis'

export const HOURLY_ANALYSIS_LIMIT = 10
export const HOURLY_ANALYSIS_WINDOW_SECONDS = 60 * 60

/**
 * One shared analysis budget for all user-triggered scans, including the
 * automatic first scan when a project is created.
 */
export async function consumeAnalysisQuota(userId: string) {
  const { allowed, remaining } = await checkRateLimit(
    `rate:analyze:${userId}`,
    HOURLY_ANALYSIS_LIMIT,
    HOURLY_ANALYSIS_WINDOW_SECONDS
  )
  if (!allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Analysis limit reached (${HOURLY_ANALYSIS_LIMIT} per hour). Please wait before triggering another scan.`,
    })
  }
  return { remaining }
}
