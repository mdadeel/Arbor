import { createHmac, timingSafeEqual } from 'node:crypto'

export const MAX_GITHUB_WEBHOOK_BYTES = 1_000_000

export function verifyGitHubWebhookSignature(
  body: Uint8Array,
  signature: string | null,
  secret: string
): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false

  const supplied = Buffer.from(signature.slice('sha256='.length), 'hex')
  const expected = createHmac('sha256', secret).update(body).digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function isValidGitHubDeliveryId(value: string | null): value is string {
  return Boolean(value && value.length <= 100 && /^[a-zA-Z0-9-]+$/.test(value))
}

export function canReclaimWebhookDelivery(
  status: string,
  updatedAt: Date,
  now = new Date(),
  processingLeaseMs = 5 * 60_000
) {
  if (status === 'queued' || status === 'ignored') return false
  if (status === 'processing') return updatedAt.getTime() <= now.getTime() - processingLeaseMs
  return status === 'failed'
}
