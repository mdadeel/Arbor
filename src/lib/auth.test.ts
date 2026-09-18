import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    GITHUB_CLIENT_ID: 'mock_gh_client_id',
    GITHUB_CLIENT_SECRET: 'mock_gh_client_secret',
    NEXTAUTH_SECRET: 'mock_nextauth_secret_32_chars_long',
    ADMIN_USERNAME: 'adeel',
    ADMIN_PASSWORD: 'adeel1212',
  },
  githubConfigured: true,
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((val: string) => `encrypted_${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted_', '')),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    gitHubAccount: {
      upsert: vi.fn().mockResolvedValue({ id: 'mock-gh-acc' }),
    },
  },
}))

import { authOptions } from './auth'
import { prisma } from './prisma'

const callSignIn = async (params: any) => {
  const cb = authOptions.callbacks?.signIn as any
  return cb(params)
}

const callJwt = async (params: any) => {
  const cb = authOptions.callbacks?.jwt as any
  return cb(params)
}

const callSession = async (params: any) => {
  const cb = authOptions.callbacks?.session as any
  return cb(params)
}

describe('authOptions callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signIn callback', () => {
    it('returns true for credentials provider', async () => {
      const result = await callSignIn({
        user: { id: 'admin-1', name: 'Adeel (Admin)', email: 'adeel@admin.local' },
        account: { provider: 'credentials', type: 'credentials' },
        profile: undefined,
      })

      expect(result).toBe(true)
    })

    it('returns false when provider is not github or profile is missing', async () => {
      const result = await callSignIn({
        user: { id: '1' },
        account: { provider: 'google', type: 'oauth' },
        profile: undefined,
      })

      expect(result).toBe(false)
    })

    it('links existing user by email without unique constraint violation', async () => {
      const existingUser = {
        id: 'user-cuid-existing',
        email: 'adeel@example.com',
        name: 'Adeel',
        githubId: 99999999,
      }

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(existingUser as any)
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        ...existingUser,
        githubId: 12345,
      } as any)

      const result = await callSignIn({
        user: { id: 'gh-1', name: 'adeel', email: 'adeel@example.com' },
        account: { provider: 'github', type: 'oauth', access_token: 'ghp_secret' },
        profile: { id: 12345, login: 'adeel' },
      })

      expect(result).toBe(true)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-cuid-existing' },
          data: expect.objectContaining({ githubId: 12345 }),
        })
      )
    })

    it('creates new user when no matching user is found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user-cuid',
        email: 'newbie@example.com',
        name: 'Newbie',
        githubId: 54321,
      } as any)

      const result = await callSignIn({
        user: { id: 'gh-2', name: 'newbie', email: 'newbie@example.com' },
        account: { provider: 'github', type: 'oauth', access_token: 'ghp_secret' },
        profile: { id: 54321, login: 'newbie' },
      })

      expect(result).toBe(true)
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ githubId: 54321, email: 'newbie@example.com' }),
        })
      )
    })

    it('handles database errors gracefully without throwing an exception', async () => {
      vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error('Connection slot limit reached'))

      const result = await callSignIn({
        user: { id: 'gh-1', name: 'testuser', email: 'test@example.com' },
        account: { provider: 'github', type: 'oauth', access_token: 'ghp_secret' },
        profile: { id: 12345, login: 'testuser' },
      })

      // Must return redirect to login instead of throwing HTTP 500 error
      expect(result).toBe('/login?error=Callback')
    })
  })

  describe('jwt and session callbacks', () => {
    it('preserves user id in jwt token', async () => {
      const token = await callJwt({
        token: {},
        user: { id: 'user-cuid-123' },
      })

      expect(token.userId).toBe('user-cuid-123')
    })

    it('populates session user id from token', async () => {
      const session = await callSession({
        session: { user: { name: 'Adeel' }, expires: '2099-01-01' },
        token: { userId: 'user-cuid-123' },
      })

      expect(session.user.id).toBe('user-cuid-123')
    })
  })
})
