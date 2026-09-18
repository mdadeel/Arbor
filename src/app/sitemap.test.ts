import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'

describe('sitemap.ts', () => {
  it('generates indexable URLs with priority and changeFrequency', () => {
    const urls = sitemap()
    expect(urls.length).toBeGreaterThanOrEqual(2)

    const home = urls.find((u) => !u.url.endsWith('/login'))
    const login = urls.find((u) => u.url.endsWith('/login'))

    expect(home).toBeDefined()
    expect(home?.priority).toBe(1.0)
    expect(home?.changeFrequency).toBe('daily')

    expect(login).toBeDefined()
    expect(login?.priority).toBe(0.8)
    expect(login?.changeFrequency).toBe('monthly')
  })
})
