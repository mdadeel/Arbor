// In-memory micro-cache for high-latency database calls (Aiven Cloud over TLS)

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.store.size >= 1000) {
      const now = Date.now()
      for (const [k, v] of this.store.entries()) {
        if (now > v.expiresAt) this.store.delete(k)
      }
      if (this.store.size >= 1000) {
        const firstKey = this.store.keys().next().value
        if (firstKey) this.store.delete(firstKey)
      }
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clearPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
  }
}

export const adminCache = new MemoryCache()
export const appCache = new MemoryCache()

// Cache TTLs in milliseconds
export const TTL_ADMIN_USER_VERIFY = 60_000      // 60 seconds for admin session verification
export const TTL_NAVBAR_COUNTS = 30_000           // 30 seconds for layout counts
export const TTL_METRICS = 30_000                 // 30 seconds for dashboard KPIs
export const TTL_USER_LIST = 15_000               // 15 seconds for user directory
export const TTL_WAITLIST = 15_000                // 15 seconds for waitlist
export const TTL_PROJECTS_LIST = 20_000           // 20 seconds for project listing
export const TTL_PROJECT_DETAIL = 20_000          // 20 seconds for project detail
export const TTL_RECENT_ANALYSES = 15_000         // 15 seconds for recent analyses
export const TTL_WORKSPACE_HEALTH = 30_000        // 30 seconds for workspace health
