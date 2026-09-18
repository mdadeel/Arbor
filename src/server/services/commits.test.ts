import { describe, it, expect, vi } from 'vitest'
import {
  categorizeCommitMessage,
  aggregateContributors,
  generateTimelineSummary,
  type CommitItem,
} from '@/server/services/commits'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((val) => val),
}))

describe('commits service', () => {
  describe('categorizeCommitMessage', () => {
    it('categorizes conventional commit prefixes', () => {
      expect(categorizeCommitMessage('feat(auth): add github oauth')).toBe('feat')
      expect(categorizeCommitMessage('fix: resolve 401 token expiry')).toBe('fix')
      expect(categorizeCommitMessage('refactor(ast): optimize traversal')).toBe('refactor')
      expect(categorizeCommitMessage('perf: memoize expensive computation')).toBe('perf')
      expect(categorizeCommitMessage('docs: update installation instructions')).toBe('docs')
      expect(categorizeCommitMessage('test: add unit tests for commits service')).toBe('test')
      expect(categorizeCommitMessage('chore: bump dependencies')).toBe('chore')
      expect(categorizeCommitMessage('ci: update github actions')).toBe('ci')
    })

    it('falls back to keyword-based categorization for natural messages', () => {
      expect(categorizeCommitMessage('Add dark mode theme toggle')).toBe('feat')
      expect(categorizeCommitMessage('Create new workspace settings')).toBe('feat')
      expect(categorizeCommitMessage('Fix crash on empty repository')).toBe('fix')
      expect(categorizeCommitMessage('Resolve issue with circular imports')).toBe('fix')
      expect(categorizeCommitMessage('Clean up unused variables')).toBe('refactor')
      expect(categorizeCommitMessage('Update README.md with live demo')).toBe('docs')
      expect(categorizeCommitMessage('Initial commit')).toBe('chore')
      expect(categorizeCommitMessage('wip testing something')).toBe('test')
    })

    it('handles unexpected messages gracefully', () => {
      expect(categorizeCommitMessage('')).toBe('other')
      expect(categorizeCommitMessage('random commit message')).toBe('other')
    })
  })

  describe('aggregateContributors', () => {
    const mockCommits: CommitItem[] = [
      {
        sha: 'abc1234567890',
        shortSha: 'abc1234',
        message: 'feat: add user auth',
        date: '2026-09-18T12:00:00Z',
        category: 'feat',
        url: 'https://github.com/org/repo/commit/abc1234',
        author: { name: 'Alice', login: 'alice', avatarUrl: 'https://avatar/alice' },
      },
      {
        sha: 'def1234567890',
        shortSha: 'def1234',
        message: 'fix: handle token expiration',
        date: '2026-09-17T15:00:00Z',
        category: 'fix',
        url: 'https://github.com/org/repo/commit/def1234',
        author: { name: 'Alice', login: 'alice', avatarUrl: 'https://avatar/alice' },
      },
      {
        sha: 'ghi1234567890',
        shortSha: 'ghi1234',
        message: 'docs: update readme',
        date: '2026-09-16T10:00:00Z',
        category: 'docs',
        url: 'https://github.com/org/repo/commit/ghi1234',
        author: { name: 'Bob', login: 'bob', avatarUrl: 'https://avatar/bob' },
      },
    ]

    it('aggregates commits per contributor and ranks them by commit count', () => {
      const summary = aggregateContributors(mockCommits)
      expect(summary).toHaveLength(2)

      expect(summary[0].login).toBe('alice')
      expect(summary[0].commitCount).toBe(2)
      expect(summary[0].categories.feat).toBe(1)
      expect(summary[0].categories.fix).toBe(1)
      expect(summary[0].primaryFocus).toBe('feat')

      expect(summary[1].login).toBe('bob')
      expect(summary[1].commitCount).toBe(1)
      expect(summary[1].categories.docs).toBe(1)
      expect(summary[1].primaryFocus).toBe('docs')
    })

    it('generates an informative timeline summary', () => {
      const contributors = aggregateContributors(mockCommits)
      const summary = generateTimelineSummary(mockCommits, contributors)
      expect(summary).toContain('3 commits')
      expect(summary).toContain('2 contributors')
      expect(summary).toContain('feat')
    })
  })
})
