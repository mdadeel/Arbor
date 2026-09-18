import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import {
  validateGitHubToken,
  listUserAccounts,
  addGitHubAccount,
  removeGitHubAccount,
  setDefaultGitHubAccount,
  listUserRepos,
  resolveGitHubToken,
} from './github'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    gitHubAccount: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callbacks) => Promise.all(callbacks)),
  },
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((val: string) => `enc_${val}`),
  decrypt: vi.fn((val: string) => val.replace(/^enc_/, '')),
}))

const globalFetch = global.fetch

describe('github service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterAll(() => {
    global.fetch = globalFetch
  })

  describe('validateGitHubToken', () => {
    it('validates a token and extracts username and scopes', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://avatar.url' }),
        headers: {
          get: (header: string) => (header === 'x-oauth-scopes' ? 'repo, read:user' : null),
        },
      })

      const result = await validateGitHubToken('ghp_valid_token')
      expect(result.valid).toBe(true)
      expect(result.username).toBe('octocat')
      expect(result.scopes).toEqual(['repo', 'read:user'])
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Arbor-App',
            Authorization: 'Bearer ghp_valid_token',
          }),
        })
      )
    })

    it('returns error when token is 401 Bad credentials', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: { get: () => null },
      })

      const result = await validateGitHubToken('ghp_expired_token')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('401 Bad credentials')
    })
  })

  describe('listUserAccounts', () => {
    it('returns existing github accounts', async () => {
      ;(prisma.gitHubAccount.findMany as any).mockResolvedValueOnce([
        {
          id: 'acc-1',
          username: 'octocat',
          accountName: 'Personal',
          tokenType: 'pat',
          avatarUrl: null,
          scope: 'repo',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const accounts = await listUserAccounts('user-1')
      expect(accounts).toHaveLength(1)
      expect(accounts[0].username).toBe('octocat')
    })

    it('auto-seeds from legacy user.githubAccessToken when accounts table is empty', async () => {
      ;(prisma.gitHubAccount.findMany as any).mockResolvedValueOnce([])
      ;(prisma.user.findUnique as any).mockResolvedValueOnce({
        githubAccessToken: 'enc_token_123',
        githubUsername: 'legacy-dev',
        avatarUrl: 'https://avatar.url',
        tokenScope: 'repo',
      })
      ;(prisma.gitHubAccount.create as any).mockResolvedValueOnce({
        id: 'acc-seeded',
        username: 'legacy-dev',
        accountName: 'Primary (OAuth)',
        tokenType: 'oauth',
        avatarUrl: 'https://avatar.url',
        scope: 'repo',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const accounts = await listUserAccounts('user-1')
      expect(accounts).toHaveLength(1)
      expect(accounts[0].accountName).toBe('Primary (OAuth)')
      expect(prisma.gitHubAccount.create).toHaveBeenCalled()
    })
  })

  describe('addGitHubAccount', () => {
    it('validates token and saves account', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ login: 'new-dev', avatar_url: 'https://avatar.com/new-dev' }),
        headers: {
          get: (h: string) => (h === 'x-oauth-scopes' ? 'repo' : null),
        },
      })
      ;(prisma.gitHubAccount.findMany as any).mockResolvedValueOnce([])
      ;(prisma.gitHubAccount.upsert as any).mockResolvedValueOnce({
        id: 'acc-new',
        username: 'new-dev',
        accountName: 'Work PAT',
        tokenType: 'pat',
        avatarUrl: 'https://avatar.com/new-dev',
        isDefault: true,
      })
      ;(prisma.user.update as any).mockResolvedValueOnce({})

      const created = await addGitHubAccount('user-1', {
        token: 'ghp_secret_new',
        accountName: 'Work PAT',
      })

      expect(created.username).toBe('new-dev')
      expect(prisma.gitHubAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_username: { userId: 'user-1', username: 'new-dev' } },
        })
      )
    })
  })

  describe('listUserRepos', () => {
    it('fetches repositories with User-Agent header and returns mapped repos', async () => {
      ;(prisma.gitHubAccount.findFirst as any).mockResolvedValueOnce({
        id: 'acc-1',
        username: 'octocat',
        accessToken: 'enc_my_token',
      })
      ;(prisma.user.findUnique as any).mockResolvedValueOnce({
        githubUsername: 'octocat',
        githubAccessToken: 'enc_my_token',
      })
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [
          {
            id: 101,
            name: 'dev-hub',
            full_name: 'octocat/dev-hub',
            html_url: 'https://github.com/octocat/dev-hub',
            default_branch: 'main',
            private: false,
            description: 'Developer workbench',
            language: 'TypeScript',
            updated_at: '2026-09-17T00:00:00Z',
          },
        ],
      })

      const res = await listUserRepos('user-1')
      expect(res.repos).toHaveLength(1)
      expect(res.repos[0].name).toBe('dev-hub')
      expect(res.isPublicFallback).toBe(false)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.github.com/user/repos'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my_token',
            'User-Agent': 'Arbor-App',
          }),
        })
      )
    })

    it('gracefully falls back to public repos when token is 401 expired', async () => {
      ;(prisma.gitHubAccount.findFirst as any).mockResolvedValueOnce({
        id: 'acc-1',
        username: 'octocat',
        accessToken: 'enc_bad_token',
      })
      ;(prisma.user.findUnique as any).mockResolvedValueOnce({
        githubUsername: 'octocat',
        githubAccessToken: 'enc_bad_token',
      })
      // First call (authenticated) returns 401
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 401,
        ok: false,
      })
      // Second call (public fallback) returns 200 with public repos
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [
          {
            id: 102,
            name: 'public-repo',
            full_name: 'octocat/public-repo',
            html_url: 'https://github.com/octocat/public-repo',
            default_branch: 'main',
            private: false,
            description: 'Public project',
            language: 'TypeScript',
            updated_at: '2026-09-17T00:00:00Z',
          },
        ],
      })

      const res = await listUserRepos('user-1')
      expect(res.isPublicFallback).toBe(true)
      expect(res.warning).toContain('expired or invalid')
      expect(res.repos).toHaveLength(1)
      expect(res.repos[0].name).toBe('public-repo')
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('api.github.com/users/octocat/repos'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Arbor-App',
          }),
        })
      )
    })

    it('throws when both authenticated and public fallback fail', async () => {
      ;(prisma.gitHubAccount.findFirst as any).mockResolvedValueOnce({
        id: 'acc-1',
        username: 'octocat',
        accessToken: 'enc_bad_token',
      })
      ;(prisma.user.findUnique as any).mockResolvedValueOnce({
        githubUsername: 'octocat',
        githubAccessToken: 'enc_bad_token',
      })
      // First call 401
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 401,
        ok: false,
      })
      // Public fallback also fails
      ;(global.fetch as any).mockResolvedValueOnce({
        status: 500,
        ok: false,
      })

      await expect(listUserRepos('user-1')).rejects.toThrow('expired or invalid')
    })
  })

  describe('resolveGitHubToken', () => {
    it('resolves token from specific account if accountId is provided', async () => {
      ;(prisma.gitHubAccount.findFirst as any).mockResolvedValueOnce({
        id: 'acc-target',
        accessToken: 'enc_specific_token',
      })

      const res = await resolveGitHubToken('user-1', 'acc-target')
      expect(res.token).toBe('specific_token')
      expect(res.accountId).toBe('acc-target')
    })

    it('resolves token from default account if no accountId is provided', async () => {
      ;(prisma.gitHubAccount.findFirst as any).mockResolvedValueOnce({
        id: 'acc-default',
        accessToken: 'enc_default_token',
        isDefault: true,
      })

      const res = await resolveGitHubToken('user-1')
      expect(res.token).toBe('default_token')
      expect(res.accountId).toBe('acc-default')
    })

    it('falls back to legacy user.githubAccessToken if no gitHubAccount exists', async () => {
      ;(prisma.gitHubAccount.findFirst as any)
        .mockResolvedValueOnce(null) // default
        .mockResolvedValueOnce(null) // any
      ;(prisma.user.findUnique as any).mockResolvedValueOnce({
        id: 'user-1',
        githubAccessToken: 'enc_legacy_token',
      })

      const res = await resolveGitHubToken('user-1')
      expect(res.token).toBe('legacy_token')
      expect(res.accountId).toBeNull()
    })
  })
})
