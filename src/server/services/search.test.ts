import { describe, it, expect, vi, beforeEach } from 'vitest'
import { globalSearch, STATIC_ACTIONS } from './search'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
    apiSpec: {
      findMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
  },
}))

describe('globalSearch service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns static actions when query is empty', async () => {
    const results = await globalSearch('user-1', '')
    expect(results.projects).toEqual([])
    expect(results.findings).toEqual([])
    expect(results.endpoints).toEqual([])
    expect(results.documents).toEqual([])
    expect(results.actions).toEqual(STATIC_ACTIONS)
    expect(results.totalMatches).toBe(STATIC_ACTIONS.length)
  })

  it('searches and maps projects matching query', async () => {
    const mockProjects = [
      {
        id: 'p1',
        name: 'eTuitionBD',
        slug: 'etuitionbd',
        repoFullName: 'org/etuitionbd',
        latestScores: { overall: 85 },
        healthData: { score: 88 },
      },
    ]

    ;(prisma.project.findMany as any).mockImplementation((args: any) => {
      // First call for matching projects
      if (args.where?.OR) return Promise.resolve(mockProjects)
      // Second call for active projects findings
      return Promise.resolve([])
    })
    ;(prisma.apiSpec.findMany as any).mockResolvedValue([])
    ;(prisma.document.findMany as any).mockResolvedValue([])

    const results = await globalSearch('user-1', 'etuition')
    expect(results.projects.length).toBe(1)
    expect(results.projects[0]).toEqual({
      id: 'project-p1',
      type: 'project',
      title: 'eTuitionBD',
      subtitle: 'org/etuitionbd',
      href: '/projects/etuitionbd',
      badge: '88/100',
      badgeColor: 'emerald',
    })
  })

  it('searches findings from recent analyses', async () => {
    const mockActiveProjects = [
      {
        id: 'p1',
        name: 'PaymentsAPI',
        slug: 'payments-api',
        analyses: [
          {
            findings: [
              {
                id: 'f-sec-1',
                category: 'security',
                severity: 'critical',
                title: 'Potential hardcoded secret Stripe key',
                detail: 'Detected secret pattern in payment.ts',
                file: 'src/payment.ts',
                line: 42,
              },
            ],
          },
        ],
      },
    ]

    ;(prisma.project.findMany as any).mockImplementation((args: any) => {
      if (args.where?.OR) return Promise.resolve([])
      return Promise.resolve(mockActiveProjects)
    })
    ;(prisma.apiSpec.findMany as any).mockResolvedValue([])
    ;(prisma.document.findMany as any).mockResolvedValue([])

    const results = await globalSearch('user-1', 'stripe')
    expect(results.findings.length).toBe(1)
    expect(results.findings[0]).toEqual({
      id: 'finding-f-sec-1',
      type: 'finding',
      title: 'Potential hardcoded secret Stripe key',
      subtitle: 'PaymentsAPI · src/payment.ts:42',
      href: '/projects/payments-api',
      badge: 'critical',
      badgeColor: 'red',
    })
  })

  it('searches OpenAPI endpoints and documents', async () => {
    ;(prisma.project.findMany as any).mockResolvedValue([])
    ;(prisma.apiSpec.findMany as any).mockResolvedValue([
      {
        id: 'spec-1',
        parsedEndpoints: [
          {
            method: 'POST',
            path: '/api/v1/checkout',
            summary: 'Process payment checkout',
            description: 'Stripe webhook payment',
          },
        ],
        project: { name: 'Storefront', slug: 'storefront' },
      },
    ])
    ;(prisma.document.findMany as any).mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Checkout Flow Guide',
        slug: 'checkout-flow',
        category: 'guide',
        project: { name: 'Storefront', slug: 'storefront' },
      },
    ])

    const results = await globalSearch('user-1', 'checkout')
    expect(results.endpoints.length).toBe(1)
    expect(results.endpoints[0].title).toBe('POST /api/v1/checkout')
    expect(results.endpoints[0].badgeColor).toBe('blue')

    expect(results.documents.length).toBe(1)
    expect(results.documents[0].title).toBe('Checkout Flow Guide')
    expect(results.documents[0].badge).toBe('guide')
  })
})
