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
  dsComponentFiles: number
  dsTokens: boolean
  dsHardcodedColors: number
  dsVariantRatio: number
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function computeScores(i: ScoreInput): Scores {
  let architecture = 100
  if (i.entryPoints === 0 && i.topLevelDirs > 0) architecture -= 15
  if (i.configFiles === 0) architecture -= 15
  else if (i.configFiles < 2 && i.topLevelDirs > 4) architecture -= 5
  if (i.avgFileLines > 160) architecture -= Math.min(20, Math.round((i.avgFileLines - 160) / 10))
  if (i.topLevelDirs > 12) architecture -= 10
  if (i.circularDeps > 0) architecture -= Math.min(15, i.circularDeps * 5)

  let techDebt = 100
  techDebt -= Math.min(35, i.circularDeps * 8)
  techDebt -= Math.min(20, i.hugeFiles * 5)
  techDebt -= Math.min(25, i.unusedDeps * 5)
  techDebt -= Math.min(20, i.deadExports * 4)
  techDebt -= i.anyTypes > 25 ? 10 : i.anyTypes > 10 ? 5 : 0
  techDebt -= i.consoleLogs > 20 ? 5 : i.consoleLogs > 5 ? 3 : 0

  let performance = 100
  // Client component penalty is calibrated for hybrid/SSR frameworks
  if (i.clientRatio > 0.85) performance -= 15
  else if (i.clientRatio > 0.6) performance -= 10
  if (i.hasNextImage && i.imgTags > 0) performance -= Math.min(15, i.imgTags * 2)
  if (i.avgFileLines > 250) performance -= 10

  let documentation = 0
  if (i.readme) documentation += 50
  documentation += Math.min(25, Math.round((i.commentRatio / 0.12) * 25))
  if (i.jsdocCount > 0) documentation += Math.min(25, Math.max(15, i.jsdocCount * 5))

  let security = 100
  if (i.secrets === 1) security = 40
  else if (i.secrets > 1) security = 15
  if (i.missingEnvDocs > 12) security -= 40
  else if (i.missingEnvDocs > 8) security -= 30
  else if (i.missingEnvDocs > 4) security -= 20
  if (!i.hasEnvExample) security -= 10

  let designSystem = 0
  const isUiProject = i.dsComponentFiles > 0
  if (isUiProject) {
    designSystem = 35
    if (i.dsTokens) designSystem += 35
    designSystem += Math.round(i.dsVariantRatio * 30)
    designSystem -= Math.min(25, i.dsHardcodedColors * 2)
  } else {
    // not a UI project — neutral baseline
    designSystem = 100
  }

  const architecture2 = clamp(architecture)
  const techDebt2 = clamp(techDebt)
  const performance2 = clamp(performance)
  const documentation2 = clamp(documentation)
  const security2 = clamp(security)
  const designSystem2 = clamp(designSystem)

  // Overall score: dynamically weighted so non-UI projects aren't penalized for lack of design system
  const overall = isUiProject
    ? clamp(
        architecture2 * 0.2 +
          techDebt2 * 0.15 +
          performance2 * 0.2 +
          documentation2 * 0.2 +
          security2 * 0.15 +
          designSystem2 * 0.1
      )
    : clamp(
        architecture2 * 0.25 +
          techDebt2 * 0.2 +
          performance2 * 0.2 +
          documentation2 * 0.2 +
          security2 * 0.15
      )

  return {
    architecture: architecture2,
    techDebt: techDebt2,
    performance: performance2,
    documentation: documentation2,
    security: security2,
    designSystem: designSystem2,
    overall,
  }
}
