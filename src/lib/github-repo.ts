const REPO_PART_RE = /^[A-Za-z0-9_.-]{1,100}$/

/**
 * Returns a canonical HTTPS clone URL for a GitHub.com repository and verifies
 * that the URL path represents the separately supplied owner/repository name.
 * Userinfo, custom ports, query strings, fragments, and alternate hosts are rejected.
 */
export function normalizeGitHubRepoUrl(rawUrl: string, repoFullName: string): string {
  const fullName = repoFullName.trim()
  const nameParts = fullName.split('/')
  if (nameParts.length !== 2 || nameParts.some((part) => !REPO_PART_RE.test(part))) {
    throw new Error('Repository must use the GitHub owner/repository format.')
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Repository URL is invalid.')
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname.toLowerCase() !== 'github.com' ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Only canonical HTTPS GitHub.com repository URLs are allowed.')
  }

  let pathParts: string[]
  try {
    pathParts = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
  } catch {
    throw new Error('Repository URL contains an invalid path.')
  }

  if (
    pathParts.length !== 2 ||
    pathParts.some((part) => !REPO_PART_RE.test(part)) ||
    pathParts[0].toLowerCase() !== nameParts[0].toLowerCase()
  ) {
    throw new Error('Repository URL does not match the supplied owner/repository name.')
  }

  const urlRepoName = pathParts[1].toLowerCase()
  const expectedRepoName = nameParts[1].toLowerCase()
  if (urlRepoName !== expectedRepoName && urlRepoName !== `${expectedRepoName}.git`) {
    throw new Error('Repository URL does not match the supplied owner/repository name.')
  }

  return `https://github.com/${nameParts[0]}/${nameParts[1]}.git`
}
