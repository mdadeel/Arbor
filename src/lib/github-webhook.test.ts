import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canReclaimWebhookDelivery, isValidGitHubDeliveryId, verifyGitHubWebhookSignature } from './github-webhook'

describe('GitHub webhook verification', () => {
  const secret = 'local-test-secret'
  const body = Buffer.from('{"action":"opened"}')
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

  it('accepts a matching SHA-256 HMAC over the exact raw body', () => {
    expect(verifyGitHubWebhookSignature(body, signature, secret)).toBe(true)
  })

  it('rejects missing, malformed, wrong-secret, and altered-body signatures', () => {
    expect(verifyGitHubWebhookSignature(body, null, secret)).toBe(false)
    expect(verifyGitHubWebhookSignature(body, 'sha1=abcd', secret)).toBe(false)
    expect(verifyGitHubWebhookSignature(body, signature, 'wrong-secret')).toBe(false)
    expect(verifyGitHubWebhookSignature(Buffer.from('{"action":"closed"}'), signature, secret)).toBe(false)
    expect(verifyGitHubWebhookSignature(body, signature, '')).toBe(false)
  })

  it('makes webhook delivery retries idempotent and reclaims only stale in-flight work', () => {
    const now = new Date('2026-10-08T00:10:00Z')
    expect(canReclaimWebhookDelivery('queued', new Date('2026-10-08T00:00:00Z'), now)).toBe(false)
    expect(canReclaimWebhookDelivery('ignored', new Date('2026-10-08T00:00:00Z'), now)).toBe(false)
    expect(canReclaimWebhookDelivery('processing', new Date('2026-10-08T00:06:00Z'), now)).toBe(false)
    expect(canReclaimWebhookDelivery('processing', new Date('2026-10-08T00:04:59Z'), now)).toBe(true)
    expect(canReclaimWebhookDelivery('failed', new Date('2026-10-08T00:09:59Z'), now)).toBe(true)
    expect(canReclaimWebhookDelivery('received', new Date('2026-10-08T00:00:00Z'), now)).toBe(false)
  })

  it('validates a bounded delivery identifier', () => {
    expect(isValidGitHubDeliveryId('a17f9182-4e4d-4bf2-8ae7-0de6')).toBe(true)
    expect(isValidGitHubDeliveryId('bad value')).toBe(false)
    expect(isValidGitHubDeliveryId('a'.repeat(101))).toBe(false)
  })
})
