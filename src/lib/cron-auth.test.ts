import { describe, expect, it } from 'vitest'
import { isAuthorizedCronRequest } from './cron-auth'

describe('isAuthorizedCronRequest', () => {
  it('accepts an exact configured bearer token', () => {
    expect(isAuthorizedCronRequest('Bearer a-long-secret-token', 'a-long-secret-token')).toBe(true)
  })

  it('rejects missing or unset secrets, including the known undefined header', () => {
    expect(isAuthorizedCronRequest('Bearer undefined', '')).toBe(false)
    expect(isAuthorizedCronRequest('Bearer undefined', undefined as unknown as string)).toBe(false)
    expect(isAuthorizedCronRequest(null, 'a-long-secret-token')).toBe(false)
  })

  it('rejects incorrect and non-bearer values', () => {
    expect(isAuthorizedCronRequest('Basic a-long-secret-token', 'a-long-secret-token')).toBe(false)
    expect(isAuthorizedCronRequest('Bearer wrong', 'a-long-secret-token')).toBe(false)
  })
})
