import { createHash } from 'node:crypto'
import type { Finding } from './types'

export function fingerprintFinding(finding: Pick<Finding, 'id' | 'ruleId' | 'file' | 'title'>): string {
  const stableRule = finding.ruleId ?? finding.id
  const stablePath = (finding.file ?? '').replaceAll('\\', '/').toLowerCase()
  return createHash('sha256')
    .update(`${stableRule}\0${stablePath}\0${finding.title.trim().toLowerCase()}`)
    .digest('hex')
}
