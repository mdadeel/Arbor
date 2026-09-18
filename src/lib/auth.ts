import type { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import { env } from '@/lib/env'
import { encrypt } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  // ponytail: JWT sessions, no adapter tables — keeps the 3-table v1 schema
  session: { strategy: 'jwt' },
  debug: Boolean(process.env.NODE_ENV === 'development' || process.env.VERCEL),
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorization: { params: { scope: 'read:user user:email repo' } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider !== 'github' || !profile) return false

      const githubProfile = profile as { id?: number | string; login?: string }
      const githubId = Number(githubProfile.id)
      const githubUsername = String(githubProfile.login ?? user.name ?? '')
      const email = user.email ?? `${githubUsername}@users.noreply.github.com`

      const encryptedToken = account.access_token ? encrypt(account.access_token) : undefined

      const data = {
        email,
        name: user.name ?? githubUsername,
        avatarUrl: user.image,
        githubUsername,
        githubAccessToken: encryptedToken,
        tokenScope: account.scope,
      }

      const dbUser = await prisma.user.upsert({
        where: { githubId },
        update: data,
        create: { githubId, ...data },
      })

      if (encryptedToken && githubUsername) {
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
        })
      }

      return true
      } catch (err) {
        console.error('[NextAuth:signIn] Error processing GitHub sign-in:', err)
        throw err
      }
    },

    async jwt({ token, account, profile }) {
      try {
        if (account && profile) {
          const githubProfile = profile as { id?: number | string }
          const dbUser = await prisma.user.findUnique({ where: { githubId: Number(githubProfile.id) } })
          if (dbUser) token.userId = dbUser.id
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