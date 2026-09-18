import { describe, expect, it } from 'vitest'
import {
  normalizeApiPath,
  matchApiContracts,
  checkEnvironmentParity,
  calculateSystemScore,
  buildFullstackGraph,
  type ApiEndpoint,
  type FrontendCallSite,
} from './system-analysis'

describe('System Analysis Engine', () => {
  describe('normalizeApiPath', () => {
    it('normalizes paths with leading/trailing slashes and queries', () => {
      expect(normalizeApiPath('api/v1/users/')).toBe('/api/v1/users')
      expect(normalizeApiPath('/api/v1/users?page=1&limit=10')).toBe('/api/v1/users')
      expect(normalizeApiPath('/api/v1/users#section')).toBe('/api/v1/users')
    })

    it('normalizes Express and Next.js path parameters', () => {
      expect(normalizeApiPath('/api/users/:id')).toBe('/api/users/{param}')
      expect(normalizeApiPath('/api/users/[userId]')).toBe('/api/users/{param}')
      expect(normalizeApiPath('/api/posts/{postId}/comments/:commentId')).toBe(
        '/api/posts/{param}/comments/{param}'
      )
    })
  })

  describe('matchApiContracts', () => {
    const backendEndpoints: ApiEndpoint[] = [
      { path: '/api/v1/auth/login', method: 'POST', source: 'controller', file: 'auth.controller.ts', line: 20 },
      { path: '/api/v1/users/:id', method: 'GET', source: 'controller', file: 'users.controller.ts', line: 45 },
      { path: '/api/v1/admin/purge', method: 'DELETE', source: 'controller', file: 'admin.controller.ts', line: 12 },
    ]

    it('identifies connected, broken, and orphaned routes correctly', () => {
      const frontendCallSites: FrontendCallSite[] = [
        // Connected
        { path: '/api/v1/auth/login', method: 'POST', source: 'fetch', file: 'login-form.tsx', line: 30 },
        // Connected (param matching)
        { path: '/api/v1/users/123', method: 'GET', source: 'axios', file: 'profile.tsx', line: 55 },
        // Broken (route does not exist in backend)
        { path: '/api/v1/legacy/export', method: 'POST', source: 'fetch', file: 'export.tsx', line: 12 },
      ]

      const result = matchApiContracts(backendEndpoints, frontendCallSites)

      expect(result.connected).toBe(2)
      expect(result.broken).toBe(1)
      expect(result.orphaned).toBe(1) // /api/v1/admin/purge was never called
      expect(result.methodMismatch).toBe(0)

      const brokenItem = result.items.find((i) => i.status === 'broken')
      expect(brokenItem?.path).toBe('/api/v1/legacy/export')

      const orphanedItem = result.items.find((i) => i.status === 'orphaned')
      expect(orphanedItem?.path).toBe('/api/v1/admin/purge')
    })

    it('identifies HTTP method mismatches', () => {
      const frontendCallSites: FrontendCallSite[] = [
        // Backend expects POST, frontend sends GET
        { path: '/api/v1/auth/login', method: 'GET', source: 'fetch', file: 'auth.ts', line: 15 },
      ]

      const result = matchApiContracts(backendEndpoints, frontendCallSites)

      expect(result.methodMismatch).toBe(1)
      expect(result.connected).toBe(0)
    })
  })

  describe('checkEnvironmentParity', () => {
    it('detects missing API URL in frontend and missing CORS in backend', () => {
      const result = checkEnvironmentParity(['DATABASE_URL'], ['PORT'])
      expect(result.issues.length).toBe(2)
      expect(result.score).toBeLessThan(100)
    })

    it('awards high score when environment variables are aligned', () => {
      const result = checkEnvironmentParity(
        ['NEXT_PUBLIC_API_URL', 'NODE_ENV'],
        ['PORT', 'CORS_ORIGIN', 'DATABASE_URL']
      )
      expect(result.issues.length).toBe(0)
      expect(result.score).toBe(100)
    })
  })

  describe('calculateSystemScore', () => {
    it('calculates weighted composite score cleanly', () => {
      const score = calculateSystemScore(
        80, // frontend
        90, // backend
        { total: 10, connected: 10, broken: 0, methodMismatch: 0 },
        100 // env
      )

      // 80*0.35 + 90*0.35 + 100*0.2 + 100*0.1 = 28 + 31.5 + 20 + 10 = 89.5 -> 90
      expect(score.overall).toBe(90)
      expect(score.contractScore).toBe(100)
    })

    it('penalizes broken endpoints heavily', () => {
      const score = calculateSystemScore(
        80,
        90,
        { total: 5, connected: 2, broken: 3, methodMismatch: 0 },
        100
      )

      expect(score.contractScore).toBeLessThan(50)
      expect(score.overall).toBeLessThan(80)
    })
  })

  describe('buildFullstackGraph', () => {
    it('bridges frontend and backend modules with cross-boundary edge', () => {
      const feModules = [
        { id: 'components', label: 'components', fileCount: 10 },
        { id: 'api-client', label: 'api', fileCount: 3 },
      ]
      const feEdges = [{ id: 'e1', source: 'components', target: 'api-client', count: 5 }]

      const beModules = [
        { id: 'controllers', label: 'controllers', fileCount: 6 },
        { id: 'services', label: 'services', fileCount: 8 },
      ]
      const beEdges = [{ id: 'e2', source: 'controllers', target: 'services', count: 12 }]

      const graph = buildFullstackGraph(feModules, feEdges, beModules, beEdges, 15)

      expect(graph.nodes.length).toBe(4)
      expect(graph.edges.length).toBe(3) // 1 fe + 1 be + 1 bridge

      const bridge = graph.edges.find((e) => e.isCrossBoundary)
      expect(bridge).toBeDefined()
      expect(bridge?.label).toContain('15 API Routes (HTTP)')
    })
  })
})
