import crypto from 'crypto'

export interface ImpersonationPayload {
  originalAdminId: string
  originalAdminEmail?: string
  targetUserId: string
  targetUserName?: string
  targetUserEmail?: string
  expiresAt: number
}

export const IMPERSONATION_COOKIE_NAME = 'arbor_impersonation'
export const IMPERSONATION_MAX_AGE_SECONDS = 3600 // 1 hour

function getSecretKey(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXTAUTH_SECRET or ENCRYPTION_SECRET must be configured for impersonation tokens in production.')
    }
    return 'arbor_default_impersonation_key_sec'
  }
  return secret
}

export function createImpersonationToken(payload: ImpersonationPayload): string {
  const data = JSON.stringify(payload)
  const sig = crypto.createHmac('sha256', getSecretKey()).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

export function verifyImpersonationToken(token: string): ImpersonationPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.data || !parsed.sig) {
      return null
    }

    const expectedSig = crypto.createHmac('sha256', getSecretKey()).update(parsed.data).digest('hex')
    const sigBuf = Buffer.from(parsed.sig, 'utf8')
    const expectedBuf = Buffer.from(expectedSig, 'utf8')
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null
    }

    const payload: ImpersonationPayload = JSON.parse(parsed.data)
    if (Date.now() > payload.expiresAt) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
