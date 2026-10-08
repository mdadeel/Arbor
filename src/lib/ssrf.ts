import dns from 'node:dns/promises'
import net from 'node:net'

export interface SafeAddress {
  address: string
  family: 4 | 6
}

export interface ResolvedSafeUrl {
  url: URL
  hostname: string
  addresses: SafeAddress[]
}

function isPrivateIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return true
  const [b0, b1, b2] = ip.split('.').map(Number)

  // Non-routable, private, loopback, link-local, documentation, benchmark,
  // multicast, and reserved blocks.
  if (b0 === 0 || b0 === 10 || b0 === 127 || b0 >= 224) return true
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true // CGNAT 100.64/10
  if (b0 === 169 && b1 === 254) return true
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true
  if (b0 === 192 && b1 === 168) return true
  if (b0 === 192 && b1 === 0 && (b2 === 0 || b2 === 2)) return true
  if (b0 === 192 && b1 === 88 && b2 === 99) return true
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true
  if (b0 === 198 && b1 === 51 && b2 === 100) return true
  if (b0 === 203 && b1 === 0 && b2 === 113) return true
  return false
}

function ipv6Words(address: string): number[] | null {
  let value = address.toLowerCase().split('%')[0]
  const embeddedIpv4 = value.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (embeddedIpv4) {
    if (!net.isIPv4(embeddedIpv4[1])) return null
    const octets = embeddedIpv4[1].split('.').map(Number)
    const wordA = ((octets[0] << 8) | octets[1]).toString(16)
    const wordB = ((octets[2] << 8) | octets[3]).toString(16)
    value = value.slice(0, value.length - embeddedIpv4[1].length) + `${wordA}:${wordB}`
  }

  const halves = value.split('::')
  if (halves.length > 2) return null
  const parseHalf = (half: string) => half ? half.split(':').map((word) => {
    if (!/^[\da-f]{1,4}$/i.test(word)) return Number.NaN
    return parseInt(word, 16)
  }) : []
  const left = parseHalf(halves[0])
  const right = parseHalf(halves[1] ?? '')
  if ([...left, ...right].some((word) => !Number.isInteger(word))) return null

  const missing = 8 - left.length - right.length
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null
  return [...left, ...Array(missing).fill(0), ...right]
}

function isPrivateIPv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return true
  const words = ipv6Words(ip)
  if (!words || words.length !== 8) return true

  if (words.every((word) => word === 0)) return true // unspecified
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return true // loopback

  const isIpv4Mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff
  if (isIpv4Mapped) {
    const mapped = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`
    return isPrivateIPv4(mapped)
  }

  // Block deprecated IPv4-compatible IPv6 forms rather than treating an
  // embedded private IPv4 address as globally routable.
  if (words.slice(0, 6).every((word) => word === 0)) return true

  const first = words[0]
  const second = words[1]
  if ((first & 0xfe00) === 0xfc00) return true // unique-local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10
  if ((first & 0xff00) === 0xff00) return true // multicast

  // Only global-unicast 2000::/3 is accepted. Known special-use ranges inside
  // it are rejected as well (documentation, benchmarking, 6to4, and IETF).
  if (first < 0x2000 || first > 0x3fff) return true
  if (first === 0x2001 && second <= 0x01ff) return true // IETF assignments / Teredo
  if (first === 0x2001 && second === 0x0db8) return true // documentation
  if (first === 0x2002) return true // 6to4 embeds IPv4
  if (first === 0x3fff && second < 0x1000) return true // documentation 3fff::/20
  return false
}

/** Returns true for malformed, private, loopback, link-local, or reserved IPs. */
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
  'metadata.azure.internal',
  '169.254.169.254',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
])

/** Resolve and validate every address before a caller opens a socket. */
export async function resolveSafeUrl(rawUrl: string): Promise<ResolvedSafeUrl> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL format.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Forbidden protocol '${url.protocol}'. Only HTTP and HTTPS are permitted.`)
  }
  if (url.username || url.password) {
    throw new Error('Credentials in proxy URLs are not permitted; send authorization as a request header instead.')
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Access to host '${hostname}' is barred by SSRF protection.`)
  }
  if (hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Access to local and internal hostnames is barred by SSRF protection.')
  }

  let addresses: SafeAddress[]
  const literalFamily = net.isIP(hostname)
  if (literalFamily) {
    if (isPrivateOrRestrictedIp(hostname)) {
      throw new Error(`Target IP '${hostname}' is private or restricted.`)
    }
    addresses = [{ address: hostname, family: literalFamily as 4 | 6 }]
  } else {
    let resolved: Array<{ address: string; family: number }>
    try {
      resolved = await dns.lookup(hostname, { all: true, verbatim: true })
    } catch (error) {
      throw new Error(`Could not safely resolve '${hostname}': ${error instanceof Error ? error.message : 'DNS lookup failed'}`)
    }
    if (!resolved.length || resolved.length > 32) {
      throw new Error(`Host '${hostname}' returned an invalid number of DNS addresses.`)
    }
    for (const record of resolved) {
      if (isPrivateOrRestrictedIp(record.address)) {
        throw new Error(`Host '${hostname}' resolves to a private or restricted address.`)
      }
    }
    addresses = resolved.map((record) => ({ address: record.address, family: record.family as 4 | 6 }))
  }

  return { url, hostname, addresses }
}

/** Compatibility helper for callers that only need validation, not pinned addresses. */
export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  const resolved = await resolveSafeUrl(rawUrl)
  return resolved.url
}
