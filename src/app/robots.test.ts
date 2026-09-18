import { describe, it, expect } from 'vitest'
import robots from './robots'

describe('robots.ts', () => {
  it('generates compliant robots rules', () => {
    const config = robots()
    expect(config.sitemap).toContain('/sitemap.xml')
    expect(Array.isArray(config.rules)).toBe(true)

    const rules = Array.isArray(config.rules) ? config.rules : [config.rules]
    const defaultRule = rules.find((r) => r.userAgent === '*')
    expect(defaultRule).toBeDefined()
    expect(defaultRule?.allow).toContain('/')
    expect(defaultRule?.allow).toContain('/login')
    expect(defaultRule?.allow).toContain('/api/badge/')
    expect(defaultRule?.allow).toContain('/google7ecf99f475b9e5b2.html')
    expect(defaultRule?.allow).toContain('/llms.txt')
    expect(defaultRule?.disallow).toContain('/dashboard/')
    expect(defaultRule?.disallow).toContain('/admin/')
    expect(defaultRule?.disallow).toContain('/projects/')
  })
})
