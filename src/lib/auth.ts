import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'
import { env } from '@/lib/env'
import { encrypt } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'

/**
 * Constant-time comparison using SHA-256 digests and timingSafeEqual
 * to prevent side-channel timing attacks on credential verification.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  // ponytail: JWT sessions, no adapter tables — keeps the 3-table v1 schema
  session: { strategy: 'jwt' },
  debug: Boolean(process.env.NODE_ENV === 'development' || process.env.VERCEL),
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorization: { params: { scope: 'read:user user:email repo' } },
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Admin Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim() ?? ''
        const password = credentials?.password?.trim() ?? ''

        if (!username || !password) {
          return null
        }

        // Protect against brute-force attacks via sliding window rate limiting (5 attempts / 5 mins)
        const rateLimitKey = `auth:admin:login:${username.toLowerCase()}`
        const { allowed } = await checkRateLimit(rateLimitKey, 5, 300)
        if (!allowed) {
          console.warn(`[Auth:Admin] Rate limit exceeded for login attempts on user: ${username}`)
          throw new Error('Too many login attempts. Please try again in a few minutes.')
        }

        const validUsername = env.ADMIN_USERNAME || 'adeel'
        const validPassword = env.ADMIN_PASSWORD || 'adeel1212'

        const isUserMatch = timingSafeCompare(username, validUsername)
        const isPassMatch = timingSafeCompare(password, validPassword)

        if (isUserMatch && isPassMatch) {
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { githubUsername: 'mdadeel' },
                { githubUsername: 'adeel' },
                { email: 'mdadeel125@gmail.com' },
                { email: 'adeel@admin.local' },
              ],
            },
          })

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: 'adeel@admin.local',
                name: 'Adeel (Admin)',
                githubUsername: 'adeel',
                githubId: 99999999,
              },
            })
          }

          return {
            id: user.id,
            name: user.name ?? 'Adeel (Admin)',
            email: user.email,
            image: user.avatarUrl,
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === 'credentials') {
          return true
        }

        if (account?.provider !== 'github' || !profile) return false

        const githubProfile = profile as { id?: number | string; login?: string }
        const githubId = Number(githubProfile.id)
        if (!githubId || isNaN(githubId)) {
          console.error('[NextAuth:signIn] Missing valid githubId in profile:', profile)
          return false
        }

        const githubUsername = String(githubProfile.login ?? user.name ?? '')
        const email = user.email ?? `${githubUsername}@users.noreply.github.com`

        let encryptedToken: string | undefined
        if (account.access_token) {
          try {
            encryptedToken = encrypt(account.access_token)
          } catch (encErr) {
            console.warn('[NextAuth:signIn] Warning: Failed to encrypt GitHub access token:', encErr)
          }
        }

        const data = {
          email,
          name: user.name ?? githubUsername,
          avatarUrl: user.image,
          githubUsername,
          githubAccessToken: encryptedToken,
          tokenScope: account.scope,
        }

        // Safe user lookup by githubId OR email to prevent P2002 unique constraint violations
        let dbUser = await prisma.user.findFirst({
          where: {
            OR: [{ githubId }, { email }],
          },
        })

        if (dbUser) {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              githubId,
              ...data,
            },
          })
        } else {
          dbUser = await prisma.user.create({
            data: {
              githubId,
              ...data,
            },
          })
        }

        if (encryptedToken && githubUsername && dbUser?.id) {
          await prisma.gitHubAccount.upsert({
            where: {
              userId_username: {
                userId: dbUser.id,
                username: githubUsername,
              },
            },
            update: {
              accessToken: encryptedToken,
              tokenType: 'oauth',
              avatarUrl: user.image,
              scope: account.scope,
            },
            create: {
              userId: dbUser.id,
              username: githubUsername,
              accountName: 'Primary (OAuth)',
              accessToken: encryptedToken,
              tokenType: 'oauth',
              avatarUrl: user.image,
              scope: account.scope,
              isDefault: true,
            },
          }).catch((accErr) => {
            console.warn('[NextAuth:signIn] Non-fatal error creating gitHubAccount record:', accErr)
          })
        }

        return true
      } catch (err) {
        console.error('[NextAuth:signIn] Error processing GitHub sign-in:', err)
        // Return error page redirect instead of throwing unhandled exception which causes HTTP 500
        return '/login?error=Callback'
      }
    },

    async jwt({ token, user, account, profile }) {
      try {
        if (user?.id) {
          token.userId = user.id
        }
        if (account && (profile || token.email)) {
          const githubProfile = profile as { id?: number | string } | undefined
          const gId = githubProfile?.id ? Number(githubProfile.id) : undefined
          const dbUser = await prisma.user.findFirst({
            where: {
              OR: [
                ...(gId && !isNaN(gId) ? [{ githubId: gId }] : []),
                ...(token.email ? [{ email: token.email }] : []),
                ...(user?.email ? [{ email: user.email }] : []),
              ],
            },
            select: { id: true },
          })
          if (dbUser) {
            token.userId = dbUser.id
          }
        }
      } catch (err) {
        console.error('[NextAuth:jwt] Error fetching user in jwt callback:', err)
      }
      return token
    },

    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}