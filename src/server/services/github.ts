import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

export type GitHubRepo = {
  id: number
  name: string
  fullName: string
  url: string
  defaultBranch: string
  private: boolean
  description: string | null
  language: string | null
  updatedAt: string
}

export type GitHubAccountSummary = {
  id: string
  username: string
  accountName: string | null
  tokenType: string
  avatarUrl: string | null
  scope: string | null
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  status?: 'healthy' | 'expired' | 'rate_limited' | 'error'
}

type RawRepo = {
  id: number
  name: string
  full_name: string
  html_url: string
  default_branch: string
  private: boolean
  description: string | null
  language: string | null
  updated_at: string
}

export interface TokenValidationResult {
  valid: boolean
  username?: string
  name?: string
  avatarUrl?: string
  scopes?: string[]
  error?: string
}

/**
 * Validates a GitHub token against GitHub's API using the mandatory User-Agent header.
 */
export async function validateGitHubToken(token: string): Promise<TokenValidationResult> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevHub-App',
      },
      cache: 'no-store',
    })

    if (res.status === 401) {
      return { valid: false, error: 'Token is invalid or expired (401 Bad credentials)' }
    }

    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining')
      if (remaining === '0') {
        return { valid: false, error: 'GitHub API rate limit exceeded' }
      }
      return { valid: false, error: 'Access forbidden (403). Check token permissions.' }
    }

    if (!res.ok) {
      return { valid: false, error: `GitHub API error: ${res.status}` }
    }

    const data = await res.json()
    const scopesHeader = res.headers.get('x-oauth-scopes')
    const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()) : []

    return {
      valid: true,
      username: data.login,
      name: data.name ?? data.login,
      avatarUrl: data.avatar_url,
      scopes,
    }
  } catch (err: any) {
    return { valid: false, error: err.message ?? 'Failed to connect to GitHub' }
  }
}

/**
 * List all connected GitHub accounts for a user.
 * Automatically migrates/seeds from legacy User.githubAccessToken if no accounts exist yet.
 */
export async function listUserAccounts(userId: string): Promise<GitHubAccountSummary[]> {
  let accounts = await prisma.gitHubAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  // Auto-seed from legacy User.githubAccessToken if accounts table is empty
  if (accounts.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        githubAccessToken: true,
        githubUsername: true,
        avatarUrl: true,
        tokenScope: true,
      },
    })

    if (user?.githubAccessToken) {
      const created = await prisma.gitHubAccount.create({
        data: {
          userId,
          username: user.githubUsername,
          accountName: 'Primary (OAuth)',
          accessToken: user.githubAccessToken,
          tokenType: 'oauth',
          avatarUrl: user.avatarUrl,
          scope: user.tokenScope,
          isDefault: true,
        },
      })
      accounts = [created]
    }
  }

  return accounts.map((a: any) => ({
    id: a.id,
    username: a.username,
    accountName: a.accountName,
    tokenType: a.tokenType,
    avatarUrl: a.avatarUrl,
    scope: a.scope,
    isDefault: a.isDefault,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }))
}

/**
 * Connects a new GitHub account using a Personal Access Token or OAuth token.
 */
export async function addGitHubAccount(
  userId: string,
  input: {
    token: string
    accountName?: string
  }
) {
  const token = input.token.trim()
  if (!token) {
    throw new Error('Access token is required')
  }

  // Validate token against GitHub
  const validation = await validateGitHubToken(token)
  if (!validation.valid || !validation.username) {
    throw new Error(validation.error ?? 'Invalid GitHub token')
  }

  const existingAccounts = await prisma.gitHubAccount.findMany({
    where: { userId },
  })

  // First account is default
  const isDefault = existingAccounts.length === 0

  const encryptedToken = encrypt(token)
  const defaultLabel = input.accountName?.trim() || `${validation.username} (PAT)`

  const account = await prisma.gitHubAccount.upsert({
    where: {
      userId_username: {
        userId,
        username: validation.username,
      },
    },
    update: {
      accessToken: encryptedToken,
      accountName: defaultLabel,
      tokenType: 'pat',
      avatarUrl: validation.avatarUrl,
      scope: validation.scopes?.join(', '),
      ...(isDefault ? { isDefault: true } : {}),
    },
    create: {
      userId,
      username: validation.username,
      accountName: defaultLabel,
      accessToken: encryptedToken,
      tokenType: 'pat',
      avatarUrl: validation.avatarUrl,
      scope: validation.scopes?.join(', '),
      isDefault,
    },
  })

  // Keep User.githubAccessToken in sync if this is default
  if (isDefault || account.isDefault) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubAccessToken: encryptedToken,
        githubUsername: validation.username,
        avatarUrl: validation.avatarUrl ?? undefined,
        tokenScope: validation.scopes?.join(', '),
      },
    })
  }

  return {
    id: account.id,
    username: account.username,
    accountName: account.accountName,
    tokenType: account.tokenType,
    avatarUrl: account.avatarUrl,
    isDefault: account.isDefault,
  }
}

/**
 * Removes / disconnects a GitHub account.
 */
export async function removeGitHubAccount(userId: string, accountId: string) {
  const account = await prisma.gitHubAccount.findFirst({
    where: { id: accountId, userId },
  })

  if (!account) {
    throw new Error('GitHub account not found')
  }

  await prisma.gitHubAccount.delete({
    where: { id: accountId },
  })

  // Check remaining accounts
  const remaining = await prisma.gitHubAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  if (remaining.length === 0) {
    // Disconnected all accounts
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubAccessToken: null,
        tokenExpiresAt: null,
        tokenScope: null,
      },
    })
  } else if (account.isDefault) {
    // Promote the first remaining account to default
    const nextDefault = remaining[0]
    await prisma.gitHubAccount.update({
      where: { id: nextDefault.id },
      data: { isDefault: true },
    })
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubAccessToken: nextDefault.accessToken,
        githubUsername: nextDefault.username,
        avatarUrl: nextDefault.avatarUrl ?? undefined,
        tokenScope: nextDefault.scope,
      },
    })
  }

  return { success: true }
}

/**
 * Sets an account as the user's primary/default GitHub account.
 */
export async function setDefaultGitHubAccount(userId: string, accountId: string) {
  const account = await prisma.gitHubAccount.findFirst({
    where: { id: accountId, userId },
  })

  if (!account) {
    throw new Error('GitHub account not found')
  }

  await prisma.$transaction([
    prisma.gitHubAccount.updateMany({
      where: { userId },
      data: { isDefault: false },
    }),
    prisma.gitHubAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        githubAccessToken: account.accessToken,
        githubUsername: account.username,
        avatarUrl: account.avatarUrl ?? undefined,
        tokenScope: account.scope,
      },
    }),
  ])

  return { success: true }
}

/**
 * Tests connection health of a specific account.
 */
export async function checkAccountHealth(userId: string, accountId: string) {
  const account = await prisma.gitHubAccount.findFirst({
    where: { id: accountId, userId },
  })

  if (!account) {
    throw new Error('GitHub account not found')
  }

  const token = decrypt(account.accessToken)
  const validation = await validateGitHubToken(token)

  return {
    id: account.id,
    username: account.username,
    valid: validation.valid,
    error: validation.error,
    scopes: validation.scopes,
  }
}

/**
 * Resolves a GitHub access token for a user, checking explicitly specified account,
 * user default account, any account, and finally the legacy User.githubAccessToken.
 */
export async function resolveGitHubToken(
  userId: string,
  accountId?: string | null
): Promise<{ token: string | null; accountId: string | null }> {
  let targetAccount = null

  if (accountId) {
    targetAccount = await prisma.gitHubAccount.findFirst({
      where: { id: accountId, userId },
    })
  } else {
    // Try default account
    targetAccount = await prisma.gitHubAccount.findFirst({
      where: { userId, isDefault: true },
    })

    // If no default account, check any account
    if (!targetAccount) {
      targetAccount = await prisma.gitHubAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
    }
  }

  if (targetAccount?.accessToken) {
    return {
      token: decrypt(targetAccount.accessToken),
      accountId: targetAccount.id,
    }
  }

  // Check fallback user.githubAccessToken
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.githubAccessToken) {
    return {
      token: decrypt(user.githubAccessToken),
      accountId: null,
    }
  }

  return { token: null, accountId: null }
}

/**
 * Lists repositories for a specific GitHub account or the default account.
 */
export async function listUserRepos(userId: string, accountId?: string): Promise<GitHubRepo[]> {
  const { token } = await resolveGitHubToken(userId, accountId)

  if (!token) {
    throw new Error('GitHub account not connected. Please connect a GitHub account in Settings.')
  }

  const res = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DevHub-App',
      },
      cache: 'no-store',
    }
  )

  if (res.status === 401) {
    throw new Error(
      'GitHub authentication failed: Token is expired or invalid. Please reconnect your account or update your access token in Settings.'
    )
  }

  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      throw new Error('GitHub API rate limit exceeded. Please try again later.')
    }
    throw new Error('GitHub API access forbidden (403). Check account permissions.')
  }

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${res.statusText}`)
  }

  const repos = (await res.json()) as RawRepo[]
  return repos.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    defaultBranch: r.default_branch,
    private: r.private,
    description: r.description,
    language: r.language,
    updatedAt: r.updated_at,
  }))
}

