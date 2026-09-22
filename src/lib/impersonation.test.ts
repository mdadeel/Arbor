import { describe, it, expect } from 'vitest'
import {
  createImpersonationToken,
  verifyImpersonationToken,
  ImpersonationPayload,
} from './impersonation'

describe('impersonation utilities', () => {
  const mockPayload: ImpersonationPayload = {
    originalAdminId: 'admin_123',
    originalAdminEmail: 'adeel@arbor.dev',
    targetUserId: 'user_456',
    targetUserName: 'Alice Developer',
    targetUserEmail: 'alice@example.com',
    expiresAt: Date.now() + 3600 * 1000,
  }

  it('creates and verifies a valid token successfully', () => {
    const token = createImpersonationToken(mockPayload)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)

    const verified = verifyImpersonationToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.originalAdminId).toBe('admin_123')
    expect(verified?.targetUserId).toBe('user_456')
    expect(verified?.targetUserEmail).toBe('alice@example.com')
  })

  it('rejects a tampered token signature', () => {
    const token = createImpersonationToken(mockPayload)
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    parsed.sig = 'tampered_signature_hex_code_123456789'
    const tamperedToken = Buffer.from(JSON.stringify(parsed)).toString('base64url')

    const verified = verifyImpersonationToken(tamperedToken)
    expect(verified).toBeNull()
  })

  it('rejects an expired token', () => {
    const expiredPayload: ImpersonationPayload = {
      ...mockPayload,
      expiresAt: Date.now() - 1000, // Expired in the past
    }
    const token = createImpersonationToken(expiredPayload)
    const verified = verifyImpersonationToken(token)
    expect(verified).toBeNull()
  })

  it('gracefully handles malformed token strings', () => {
    expect(verifyImpersonationToken('not-a-token')).toBeNull()
    expect(verifyImpersonationToken('')).toBeNull()
    expect(verifyImpersonationToken('{}')).toBeNull()
  })
})
