import { describe, it, expect } from 'vitest'
import { isPrivateOrRestrictedIp, validateSafeUrl } from './ssrf'

describe('SSRF Protection Utility', () => {
  describe('isPrivateOrRestrictedIp', () => {
    it('blocks IPv4 loopback and local addresses', () => {
      expect(isPrivateOrRestrictedIp('127.0.0.1')).toBe(true)
      expect(isPrivateOrRestrictedIp('127.0.0.5')).toBe(true)
      expect(isPrivateOrRestrictedIp('0.0.0.0')).toBe(true)
    })

    it('blocks IPv4 private RFC 1918 addresses', () => {
      expect(isPrivateOrRestrictedIp('10.0.0.1')).toBe(true)
      expect(isPrivateOrRestrictedIp('10.255.255.255')).toBe(true)
      expect(isPrivateOrRestrictedIp('172.16.0.1')).toBe(true)
      expect(isPrivateOrRestrictedIp('172.31.255.255')).toBe(true)
      expect(isPrivateOrRestrictedIp('192.168.1.1')).toBe(true)
      expect(isPrivateOrRestrictedIp('192.168.0.254')).toBe(true)
    })

    it('blocks cloud metadata IP 169.254.169.254 and link-local', () => {
      expect(isPrivateOrRestrictedIp('169.254.169.254')).toBe(true)
      expect(isPrivateOrRestrictedIp('169.254.1.1')).toBe(true)
    })

    it('allows public IPv4 addresses', () => {
      expect(isPrivateOrRestrictedIp('8.8.8.8')).toBe(false)
      expect(isPrivateOrRestrictedIp('1.1.1.1')).toBe(false)
      expect(isPrivateOrRestrictedIp('93.184.216.34')).toBe(false)
    })

    it('blocks IPv6 loopback and private ranges', () => {
      expect(isPrivateOrRestrictedIp('::1')).toBe(true)
      expect(isPrivateOrRestrictedIp('::')).toBe(true)
      expect(isPrivateOrRestrictedIp('fc00::1')).toBe(true)
      expect(isPrivateOrRestrictedIp('fe80::1')).toBe(true)
      expect(isPrivateOrRestrictedIp('::ffff:127.0.0.1')).toBe(true)
      expect(isPrivateOrRestrictedIp('::ffff:169.254.169.254')).toBe(true)
    })
  })

  describe('validateSafeUrl', () => {
    it('rejects dangerous protocols', async () => {
      await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow('Forbidden protocol')
      await expect(validateSafeUrl('gopher://127.0.0.1')).rejects.toThrow('Forbidden protocol')
      await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow('Forbidden protocol')
    })

    it('rejects localhost and cloud metadata domains', async () => {
      await expect(validateSafeUrl('http://localhost:3000/api')).rejects.toThrow('SSRF protection')
      await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow('SSRF protection')
      await expect(validateSafeUrl('http://metadata.google.internal')).rejects.toThrow('SSRF protection')
      await expect(validateSafeUrl('http://127.0.0.1:6379')).rejects.toThrow('SSRF protection')
      await expect(validateSafeUrl('http://sub.localhost')).rejects.toThrow('SSRF protection')
      await expect(validateSafeUrl('http://service.internal')).rejects.toThrow('SSRF protection')
    })

    it('permits valid public URLs', async () => {
      const parsed = await validateSafeUrl('https://api.github.com/users')
      expect(parsed.hostname).toBe('api.github.com')
      expect(parsed.protocol).toBe('https:')
    })
  })
})
