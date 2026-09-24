import dns from 'node:dns/promises'
import net from 'node:net'

/**
 * Checks whether an IPv4 address falls into a private, loopback, link-local, or reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10))
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true // Invalid IPv4 treated as restricted
  }

  const [b0, b1, b2, b3] = parts

  // 0.0.0.0/8 (Broadcast/Current network)
  if (b0 === 0) return true
  // 10.0.0.0/8 (Private network)
  if (b0 === 10) return true
  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true
  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (b0 === 169 && b1 === 254) return true
  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true
  // 192.168.0.0/16 (Private network)
  if (b0 === 192 && b1 === 168) return true
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true
  // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && (b2 === 0 || b2 === 2)) return true
  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && b2 === 100) return true
  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (b0 >= 224) return true

  return false
}

/**
 * Checks whether an IPv6 address falls into a loopback, unique local, link-local, or IPv4-mapped private range.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim()

  // Loopback / Unspecified
  if (normalized === '::1' || normalized === '::') return true

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7)
    if (net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part)
    }
  }

  // Unique local addresses (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

  // Link-local addresses (fe80::/10)
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true

  return false
}

/**
 * Evaluates whether an IP address is private, loopback, or cloud metadata.
 */
export function isPrivateOrRestrictedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip)
  if (net.isIPv6(ip)) return isPrivateIPv6(ip)
  return true
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  '169.254.169.254',
  '0.0.0.0',
  '127.0.0.1',
  '[::1]',
])

/**
 * Validates a target URL against SSRF vectors.
 * Ensures http/https protocol, non-internal hostname, and verifies resolved DNS addresses.
 */
export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL format')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol '${parsed.protocol}'. Only http and https are permitted.`)
  }

  const hostname = parsed.hostname.toLowerCase().trim()

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Access to host '${hostname}' is barred for security reasons (SSRF protection).`)
  }

  if (hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Access to local/internal domains is barred (SSRF protection).`)
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isPrivateOrRestrictedIp(hostname)) {
      throw new Error(`Target IP '${hostname}' is a private or restricted network address (SSRF protection).`)
    }
    return parsed
  }

  // Resolve hostname through DNS to verify destination IP addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    if (!addresses || addresses.length === 0) {
      throw new Error(`Could not resolve hostname '${hostname}'.`)
    }

    for (const record of addresses) {
      if (isPrivateOrRestrictedIp(record.address)) {
        throw new Error(
          `Target host '${hostname}' resolved to private or restricted IP '${record.address}' (SSRF protection).`
        )
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('SSRF protection')) {
      throw err
    }
    throw new Error(`Failed to verify host safety: ${err.message || 'DNS resolution failed'}`)
  }

  return parsed
}
