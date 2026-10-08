export type FindingCategory =
  | 'structure'
  | 'techDebt'
  | 'performance'
  | 'documentation'
  | 'security'
  | 'environment'
  | 'designSystem'
  | 'accessibility'
  | 'analysis'

export type FindingSeverity = 'info' | 'warning' | 'critical'

export interface Finding {
  id: string
  category: FindingCategory
  severity: FindingSeverity
  title: string
  detail: string
  /** Why the static rule reported this finding. */
  explanation?: string
  /** Potential engineering or user impact if the signal is confirmed. */
  impact?: string
  /** A concrete, safe next step for the repository owner. */
  recommendation?: string
  /** Heuristic certainty; findings are not proof of a defect or exploit. */
  confidence?: 'high' | 'medium' | 'low'
  ruleId?: string
  policyPack?: string
  policyVersion?: string
  policySuppressed?: boolean
  fingerprint?: string
  evidence?: string[]
  file?: string
  line?: number
  count?: number
  paths?: string[]
}

export interface DetectedTechStack {
  languages: string[]
  framework: string | null
  packageManager: string | null
  databases: string[]
  testing: string[]
  ui: string[]
  keyDeps: string[]
  typescript: boolean
  monorepo: boolean
}

export interface StructureNode {
  name: string
  type: 'dir' | 'file'
  lines?: number
  children?: StructureNode[]
}

export interface ProjectStructure {
  fileCount: number
  loc: number
  avgFileLines: number
  dirs: { path: string; files: number }[]
  topLevelDirs: string[]
  entryPoints: string[]
  configFiles: string[]
  hugeFiles: { file: string; lines: number }[]
  tree: StructureNode[]
}

export interface ImportGraph {
  nodes: string[]
  edges: [string, string][]
}

export interface AnalysisCoverage {
  filesIncluded: number
  discoveredFilesAtLeast: number
  sourceFiles: number
  parsedFiles: number
  parseFailedFiles: number
  skippedLargeFiles: number
  unsupportedSourceFiles: number
  unreadableSourceFiles: number
  truncated: boolean
  partial: boolean
  repoBytes: number
  maxFiles: number
  maxFileSizeBytes: number
  maxParseFiles: number
}

export interface AnalysisMetrics {
  files: number
  loc: number
  coverage: AnalysisCoverage
  components: number
  hooks: number
  anyTypes: number
  consoleLogs: number
  todos: number
  reactFiles: number
  clientFiles: number
  serverComponents: number
  clientComponents: number
  unusedDeps: string[]
  deadExports: string[]
  circularDeps: string[][]
  imgTagCount: number
  nextImageCount: number
  jsdocCount: number
  commentRatio: number
  sourceEnvVars: string[]
}

export interface DesignSystemAudit {
  componentFiles: number
  components: number
  componentDirs: string[]
  // distinct source of design tokens (css vars, tailwind theme, etc.)
  tokenFiles: string[]
  tokenType: string | null
  // hardcoded color literals inside component files (#hex, rgb())
  hardcodedColors: number
  // share of component files that declare a variant prop (cva/shadcn-style)
  variantComponents: number
}

export interface Scores {
  architecture: number
  techDebt: number
  performance: number
  documentation: number
  security: number
  designSystem: number
  overall: number
}

export interface AnalysisReport {
  techStack: DetectedTechStack
  structure: ProjectStructure
  metrics: AnalysisMetrics
  importGraph: ImportGraph
  designSystem: DesignSystemAudit
  findings: Finding[]
  scores: Scores
}

export interface EnvCheck {
  required: string[]
  documented: string[]
  missingFromExample: string[]
}