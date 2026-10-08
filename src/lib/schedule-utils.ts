export type ScanCadenceName = 'daily' | 'weekly'

export function nextScheduleTime(cadence: ScanCadenceName, previous: Date, now = new Date()) {
  const interval = cadence === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  const elapsed = Math.max(0, now.getTime() - previous.getTime())
  const intervals = Math.floor(elapsed / interval) + 1
  return new Date(previous.getTime() + intervals * interval)
}

export function isSafeGitRef(branch: string) {
  return branch.length > 0 && branch.length <= 255 &&
    !branch.startsWith('-') && !branch.startsWith('/') && !branch.endsWith('/') &&
    !branch.endsWith('.') && !branch.endsWith('.lock') &&
    !/[\s\0~^:?*\[\\]/.test(branch) && !branch.includes('..') && !branch.includes('@{')
}
