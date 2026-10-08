import { describe, expect, it } from 'vitest'
import { normalizeGitHubRepoUrl } from './github-repo'

describe('normalizeGitHubRepoUrl', () => {
  it('canonicalizes a matching GitHub HTML URL', () => {
    expect(normalizeGitHubRepoUrl('https://github.com/Arbor/Arbor', 'Arbor/Arbor'))
      .toBe('https://github.com/Arbor/Arbor.git')
  })

  it('accepts the standard .git suffix and trailing slash', () => {
    expect(normalizeGitHubRepoUrl('https://github.com/org/repo.git/', 'org/repo'))
      .toBe('https://github.com/org/repo.git')
  })

  it.each([
    'http://github.com/org/repo',
    'https://github.com.attacker.example/org/repo',
    'https://attacker.example/org/repo',
    'https://user:pass@github.com/org/repo',
    'https://github.com:8443/org/repo',
    'https://github.com/org/repo?redirect=attacker',
    'https://github.com/org/repo#fragment',
  ])('rejects unsafe or non-canonical URL %s', (url) => {
    expect(() => normalizeGitHubRepoUrl(url, 'org/repo')).toThrow()
  })

  it('rejects a URL that does not match repoFullName', () => {
    expect(() => normalizeGitHubRepoUrl('https://github.com/attacker/repo', 'org/repo')).toThrow(/does not match/)
  })
})
