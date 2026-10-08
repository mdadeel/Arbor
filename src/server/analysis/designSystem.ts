import path from 'node:path'
import { listFiles, readText } from './walk'
import type { DesignSystemAudit, Finding } from './types'

const COMPONENT_DIRS = new Set(['components', 'ui', 'shared', 'primitives'])

const TOKEN_FILE_RE = /(theme|tokens|design.?tokens|globals|colors?|variables)\.(css|scss|ts|tsx|js|jsx)$/i
const TAILWIND_RE = /tailwind\.config\.(ts|js|mjs|cjs)$/

const HEX_RE = /#[\da-f]{3,8}\b/gi
const RGB_RE = /rgba?\(|hsla?\(/gi
const VAR_RE = /--[\w-]+\s*:/

export interface ComponentAuditSummary {
  componentFiles: number
  components: number
  componentDirs: string[]
  hardcodedColors: number
  variantComponents: number
}

export function auditDesignSystem(
  repoDir: string,
  files: string[] = listFiles(repoDir),
  readTextFile: (file: string) => string | null = readText,
  precomputedComponents?: ComponentAuditSummary
): DesignSystemAudit {
  const componentFiles = files.filter((file) =>
    path.relative(repoDir, file).split(path.sep).some((segment) => COMPONENT_DIRS.has(segment))
  )

  // Read only plausible token/config files, never every asset in the repository.
  const tokenFiles: string[] = []
  let tokenType: string | null = null
  for (const file of files) {
    const base = path.basename(file)
    if (!TAILWIND_RE.test(base) && !TOKEN_FILE_RE.test(base)) continue
    const text = readTextFile(file)
    if (text == null) continue
    if (TAILWIND_RE.test(base) && /theme\s*:/.test(text)) {
      tokenFiles.push(path.relative(repoDir, file).split(path.sep).join('/'))
      tokenType ??= 'tailwind-theme'
    } else if (TOKEN_FILE_RE.test(base) && VAR_RE.test(text)) {
      tokenFiles.push(path.relative(repoDir, file).split(path.sep).join('/'))
      tokenType ??= 'css-vars'
    }
  }

  let hardcodedColors = precomputedComponents?.hardcodedColors ?? 0
  let variantComponents = precomputedComponents?.variantComponents ?? 0
  let components = precomputedComponents?.components ?? 0
  if (!precomputedComponents) {
    for (const file of componentFiles) {
      const text = readTextFile(file) ?? ''
      hardcodedColors += (text.match(HEX_RE) ?? []).length
      hardcodedColors += (text.match(RGB_RE) ?? []).length
      if (/\bvariant\s*\??[:=]/.test(text)) variantComponents++
      components += (text.match(/export\s+(?:default\s+)?function\s+([A-Z]\w*)/g) ?? []).length
      components += (text.match(/const\s+([A-Z]\w*)\s*[:=]\s*(?:React\.)?(?:memo\s*\(\s*)?\(?[^)]*\)?\s*=>/g) ?? []).length
    }
  }

  const componentDirs = precomputedComponents?.componentDirs ?? [...new Set(
    componentFiles
      .map((file) => path.relative(repoDir, file).split(path.sep).find((segment) => COMPONENT_DIRS.has(segment)))
      .filter(Boolean) as string[]
  )].sort()

  return {
    componentFiles: componentFiles.length,
    components,
    componentDirs,
    tokenFiles,
    tokenType,
    hardcodedColors,
    variantComponents,
  }
}

export function designSystemFindings(audit: DesignSystemAudit): Finding[] {
  const findings: Finding[] = []
  if (audit.componentFiles === 0) return findings

  if (audit.tokenType == null) {
    findings.push({
      id: 'no-design-tokens',
      category: 'designSystem',
      severity: 'warning',
      title: 'No design tokens detected',
      detail: 'No CSS variables or Tailwind theme extension found. Hardcoded values make the UI hard to re-theme.',
    })
  }
  if (audit.hardcodedColors > 0) {
    findings.push({
      id: 'hardcoded-colors',
      category: 'designSystem',
      severity: 'warning',
      title: `${audit.hardcodedColors} hardcoded color(s) in component files`,
      detail: 'Prefer theme tokens over raw colors so the design system stays consistent.',
      count: audit.hardcodedColors,
    })
  }
  if (
    audit.componentFiles > 3 &&
    audit.variantComponents < audit.componentFiles / 2 &&
    !audit.tokenType
  ) {
    findings.push({
      id: 'no-component-pattern',
      category: 'designSystem',
      severity: 'info',
      title: 'No consistent variant prop pattern',
      detail: 'Fewer than half of the components declare a variant prop; consider a shared convention like cva/shadcn.',
    })
  }
  if (audit.componentDirs.length > 1) {
    findings.push({
      id: 'split-component-dirs',
      category: 'designSystem',
      severity: 'info',
      title: 'Components live in multiple directories',
      detail: `${audit.componentDirs.join(', ')} — keep one place for shared UI.`,
    })
  }
  return findings
}