import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'

describe('sitemap.ts', () => {
  it('lists the homepage and legal pages, and excludes the sign-in page', () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls.some((url) => url.endsWith('/login'))).toBe(false)
    expect(urls.some((url) => url.endsWith('/privacy'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/terms'))).toBe(true)
  })

  it('gives the homepage the highest priority', () => {
    const entries = sitemap()
    const home = entries.find((entry) => !entry.url.endsWith('/privacy') && !entry.url.endsWith('/terms'))

    expect(home).toBeDefined()
    expect(home?.priority).toBe(1.0)
  })

  it('uses a fixed lastModified for legal pages instead of the request time', () => {
    const legal = sitemap().filter((entry) => /\/(privacy|terms)$/.test(entry.url))

    expect(legal).toHaveLength(2)
    for (const entry of legal) {
      expect(entry.lastModified).toEqual(new Date('2026-10-26T00:00:00Z'))
    }
  })
})
