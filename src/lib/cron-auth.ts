import { timingSafeEqual } from 'node:crypto'

/**
 * Validates an exact bearer token without accepting an unset secret or leaking
 * token-comparison timing. Empty CRON_SECRET intentionally disables the route.
 */
export function isAuthorizedCronRequest(authorization: string | null, secret: string): boolean {
  if (!authorization || !secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authorization)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
