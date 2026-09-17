export type FindingCategory =
  | 'structure'
  | 'techDebt'
  | 'performance'
  | 'documentation'
  | 'security'
  | 'environment'

export type FindingSeverity = 'info' | 'warning' | 'critical'

export interface Finding {
  id: string
  category: FindingCategory
  severity: FindingSeverity
  title: string
  detail: string
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

export interface ProjectStructure {
  fileCount: number
  loc: number
  avgFileLines: number
  dirs: { path: string; files: number }[]
  topLevelDirs: string[]
  entryPoints: string[]
  configFiles: string[]
  hugeFiles: { file: string; lines: number }[]
}

export interface ImportGraph {
  nodes: string[]
  edges: [string, string][]
}

export interface AnalysisMetrics {
  files: number
  loc: number
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

export interface Scores {
  architecture: number
  techDebt: number
  performance: number
  documentation: number
  security: number
  overall: number
}

export interface AnalysisReport {
  techStack: DetectedTechStack
  structure: ProjectStructure
  metrics: AnalysisMetrics
  importGraph: ImportGraph
  findings: Finding[]
  scores: Scores
}

export interface EnvCheck {
  required: string[]
  documented: string[]
  missingFromExample: string[]
}