import { describe, expect, it } from 'vitest'
import { isSafeGitRef, nextScheduleTime } from '@/lib/schedule-utils'

describe('scheduled scan timing and branch validation', () => {
  it('advances a delayed schedule beyond now without queuing every missed interval', () => {
    const previous = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date('2026-01-04T03:00:00.000Z')
    expect(nextScheduleTime('daily', previous, now)).toEqual(new Date('2026-01-05T00:00:00.000Z'))
    expect(nextScheduleTime('weekly', previous, now)).toEqual(new Date('2026-01-08T00:00:00.000Z'))
  })

  it('accepts valid Git refs and rejects option-like or traversal refs', () => {
    expect(isSafeGitRef('feature/fix-analysis')).toBe(true)
    expect(isSafeGitRef('main')).toBe(true)
    expect(isSafeGitRef('-c core.sshCommand=evil')).toBe(false)
    expect(isSafeGitRef('feature/../main')).toBe(false)
    expect(isSafeGitRef('feature branch')).toBe(false)
  })
})
