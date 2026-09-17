import type { Scores } from './types'

export interface ScoreInput {
  avgFileLines: number
  topLevelDirs: number
  entryPoints: number
  configFiles: number
  circularDeps: number
  hugeFiles: number
  unusedDeps: number
  deadExports: number
  anyTypes: number
  consoleLogs: number
  clientRatio: number // client react files / react files
  imgTags: number
  hasNextImage: boolean
  readme: boolean
  commentRatio: number
  jsdocCount: number
  secrets: number
  missingEnvDocs: number
  hasEnvExample: boolean
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function computeScores(i: ScoreInput): Scores {
  let architecture = 100
  if (i.entryPoints === 0 && i.topLevelDirs > 0) architecture -= 15
  if (i.configFiles < 3) architecture -= 10
  if (i.avgFileLines > 150) architecture -= Math.min(20, (i.avgFileLines - 150) / 10)
  if (i.topLevelDirs > 12) architecture -= 10

  let techDebt = 100
  techDebt -= Math.min(40, i.circularDeps * 8)
  techDebt -= Math.min(20, i.hugeFiles * 5)
  techDebt -= Math.min(25, i.unusedDeps * 5)
  techDebt -= Math.min(20, i.deadExports * 4)
  techDebt -= i.anyTypes > 25 ? 10 : i.anyTypes > 10 ? 5 : 0
  techDebt -= i.consoleLogs > 20 ? 5 : i.consoleLogs > 5 ? 3 : 0

  let performance = 100
  if (i.clientRatio > 0.6) performance -= 25
  else if (i.clientRatio > 0.4) performance -= 10
  if (i.hasNextImage && i.imgTags > 0) performance -= Math.min(15, i.imgTags)
  if (i.avgFileLines > 250) performance -= 10

  let documentation = 0
  if (i.readme) documentation += 40
  documentation += Math.min(35, Math.round((i.commentRatio / 0.15) * 35))
  if (i.jsdocCount > 0) documentation += 25

  let security = 100
  if (i.secrets === 1) security = 40
  else if (i.secrets > 1) security = 15
  if (i.missingEnvDocs > 12) security -= 40
  else if (i.missingEnvDocs > 8) security -= 30
  else if (i.missingEnvDocs > 4) security -= 20
  if (!i.hasEnvExample) security -= 10

  const architecture2 = clamp(architecture)
  const techDebt2 = clamp(techDebt)
  const performance2 = clamp(performance)
  const documentation2 = clamp(documentation)
  const security2 = clamp(security)

  const overall = clamp(
    architecture2 * 0.25 +
      techDebt2 * 0.15 +
      performance2 * 0.2 +
      documentation2 * 0.2 +
      security2 * 0.2
  )

  return {
    architecture: architecture2,
    techDebt: techDebt2,
    performance: performance2,
    documentation: documentation2,
    security: security2,
    overall,
  }
}