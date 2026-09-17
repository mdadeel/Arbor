export type GitProviderType = 'github' | 'gitlab' | 'bitbucket'

export interface GitRepository {
  id: string
  name: string
  fullName: string
  defaultBranch: string
  isPrivate: boolean
  url: string
  description?: string | null
  provider: GitProviderType
}

export interface GitProvider {
  name: GitProviderType
  displayName: string
  listRepositories(token: string): Promise<GitRepository[]>
  getRepository(token: string, fullName: string): Promise<GitRepository | null>
  getBranches(token: string, fullName: string): Promise<string[]>
}

export class GitHubProvider implements GitProvider {
  name: GitProviderType = 'github'
  displayName = 'GitHub'

  async listRepositories(token: string): Promise<GitRepository[]> {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DevHub-App',
      },
    })
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.statusText}`)
    }
    const data = await res.json()
    return data.map((r: any) => ({
      id: String(r.id),
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      url: r.html_url,
      description: r.description,
      provider: 'github' as const,
    }))
  }

  async getRepository(token: string, fullName: string): Promise<GitRepository | null> {
    const res = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DevHub-App',
      },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub API error: ${res.statusText}`)
    const r = await res.json()
    return {
      id: String(r.id),
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      url: r.html_url,
      description: r.description,
      provider: 'github',
    }
  }

  async getBranches(token: string, fullName: string): Promise<string[]> {
    const res = await fetch(`https://api.github.com/repos/${fullName}/branches`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DevHub-App',
      },
    })
    if (!res.ok) return ['main']
    const data = await res.json()
    return Array.isArray(data) ? data.map((b: any) => b.name) : ['main']
  }
}

export class GitLabProvider implements GitProvider {
  name: GitProviderType = 'gitlab'
  displayName = 'GitLab'

  async listRepositories(token: string): Promise<GitRepository[]> {
    const res = await fetch('https://gitlab.com/api/v4/projects?membership=true&order_by=updated_at', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) {
      throw new Error(`GitLab API error: ${res.statusText}`)
    }
    const data = await res.json()
    return data.map((r: any) => ({
      id: String(r.id),
      name: r.name,
      fullName: r.path_with_namespace,
      defaultBranch: r.default_branch || 'main',
      isPrivate: r.visibility !== 'public',
      url: r.web_url,
      description: r.description,
      provider: 'gitlab' as const,
    }))
  }

  async getRepository(token: string, fullName: string): Promise<GitRepository | null> {
    const encoded = encodeURIComponent(fullName)
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const r = await res.json()
    return {
      id: String(r.id),
      name: r.name,
      fullName: r.path_with_namespace,
      defaultBranch: r.default_branch || 'main',
      isPrivate: r.visibility !== 'public',
      url: r.web_url,
      description: r.description,
      provider: 'gitlab',
    }
  }

  async getBranches(token: string, fullName: string): Promise<string[]> {
    const encoded = encodeURIComponent(fullName)
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/repository/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return ['main']
    const data = await res.json()
    return Array.isArray(data) ? data.map((b: any) => b.name) : ['main']
  }
}

export class BitbucketProvider implements GitProvider {
  name: GitProviderType = 'bitbucket'
  displayName = 'Bitbucket'

  async listRepositories(token: string): Promise<GitRepository[]> {
    const res = await fetch('https://api.bitbucket.org/2.0/repositories?role=member', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new Error(`Bitbucket API error: ${res.statusText}`)
    }
    const data = await res.json()
    const values = Array.isArray(data.values) ? data.values : []
    return values.map((r: any) => ({
      id: r.uuid || r.full_name,
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.mainbranch?.name || 'main',
      isPrivate: Boolean(r.is_private),
      url: r.links?.html?.href,
      description: r.description,
      provider: 'bitbucket' as const,
    }))
  }

  async getRepository(token: string, fullName: string): Promise<GitRepository | null> {
    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${fullName}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const r = await res.json()
    return {
      id: r.uuid || r.full_name,
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.mainbranch?.name || 'main',
      isPrivate: Boolean(r.is_private),
      url: r.links?.html?.href,
      description: r.description,
      provider: 'bitbucket',
    }
  }

  async getBranches(token: string, fullName: string): Promise<string[]> {
    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${fullName}/refs/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return ['main']
    const data = await res.json()
    const values = Array.isArray(data.values) ? data.values : []
    return values.map((b: any) => b.name)
  }
}

export function getGitProvider(type: GitProviderType): GitProvider {
  switch (type) {
    case 'gitlab':
      return new GitLabProvider()
    case 'bitbucket':
      return new BitbucketProvider()
    case 'github':
    default:
      return new GitHubProvider()
  }
}
