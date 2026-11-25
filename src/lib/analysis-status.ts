export const QUEUED_WARNING_MS = 2 * 60_000

export function analysisAgeMs(createdAt: string | Date | null | undefined, now = Date.now()): number | null {
  if (!createdAt) return null
  const time = new Date(createdAt).getTime()
  return Number.isFinite(time) ? Math.max(0, now - time) : null
}

export function formatAnalysisWait(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) {
    const s = Math.max(1, seconds)
    return `${s} second${s === 1 ? '' : 's'}`
  }
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

export type ProjectScanState =
  | 'never_analyzed'
  | 'waiting'
  | 'waiting_with_previous'
  | 'delayed'
  | 'delayed_with_previous'
  | 'processing'
  | 'processing_with_previous'
  | 'failed'
  | 'failed_with_previous'
  | 'completed'

export interface ProjectScanPresentation {
  state: ProjectScanState
  statusKey: string
  label: string
  sublabel?: string
  isWaiting: boolean
  isProcessing: boolean
  isFailed: boolean
  isCompleted: boolean
  hasPreviousReport: boolean
  isDelayed: boolean
  ageMs: number | null
  formattedWait?: string
}

export interface ProjectLikeForStatus {
  lastAnalyzedAt?: string | Date | null
  _count?: { analyses?: number }
  analyses?: Array<{
    id?: string
    status: string
    createdAt?: string | Date
    errorMessage?: string | null
  }>
}

export function getProjectScanPresentation(
  project: ProjectLikeForStatus,
  now = Date.now()
): ProjectScanPresentation {
  const analyses = project.analyses ?? []
  const hasAnalyses = (project._count?.analyses ?? analyses.length) > 0
  const latest = analyses[0]
  const hasPreviousReport = Boolean(project.lastAnalyzedAt)

  if (!hasAnalyses || !latest) {
    return {
      state: 'never_analyzed',
      statusKey: 'no-analysis',
      label: 'Not analyzed',
      sublabel: 'Never scanned',
      isWaiting: false,
      isProcessing: false,
      isFailed: false,
      isCompleted: false,
      hasPreviousReport: false,
      isDelayed: false,
      ageMs: null,
    }
  }

  const ageMs = analysisAgeMs(latest.createdAt, now)
  const isDelayed = latest.status === 'queued' && ageMs !== null && ageMs >= QUEUED_WARNING_MS
  const formattedWait = ageMs !== null ? formatAnalysisWait(ageMs) : undefined

  if (latest.status === 'completed') {
    return {
      state: 'completed',
      statusKey: 'completed',
      label: 'Completed',
      sublabel: 'Report ready',
      isWaiting: false,
      isProcessing: false,
      isFailed: false,
      isCompleted: true,
      hasPreviousReport: true,
      isDelayed: false,
      ageMs,
      formattedWait,
    }
  }

  if (latest.status === 'queued') {
    if (isDelayed) {
      return {
        state: hasPreviousReport ? 'delayed_with_previous' : 'delayed',
        statusKey: 'queued',
        label: hasPreviousReport ? 'Waiting · Delayed' : 'Waiting (delayed)',
        sublabel: hasPreviousReport ? 'Previous report available' : 'Worker may be busy',
        isWaiting: true,
        isProcessing: false,
        isFailed: false,
        isCompleted: false,
        hasPreviousReport,
        isDelayed: true,
        ageMs,
        formattedWait,
      }
    }
    return {
      state: hasPreviousReport ? 'waiting_with_previous' : 'waiting',
      statusKey: 'queued',
      label: hasPreviousReport ? 'Waiting · Queued' : 'Queued',
      sublabel: hasPreviousReport ? 'Previous report available' : 'Waiting to start',
      isWaiting: true,
      isProcessing: false,
      isFailed: false,
      isCompleted: false,
      hasPreviousReport,
      isDelayed: false,
      ageMs,
      formattedWait,
    }
  }

  if (latest.status === 'cloning' || latest.status === 'analyzing') {
    const stageName = latest.status === 'cloning' ? 'Preparing repository' : 'Inspecting codebase'
    return {
      state: hasPreviousReport ? 'processing_with_previous' : 'processing',
      statusKey: latest.status,
      label: hasPreviousReport ? `${stageName} · Working` : stageName,
      sublabel: hasPreviousReport ? 'Previous report available' : 'Processing active',
      isWaiting: false,
      isProcessing: true,
      isFailed: false,
      isCompleted: false,
      hasPreviousReport,
      isDelayed: false,
      ageMs,
      formattedWait,
    }
  }

  if (latest.status === 'failed') {
    return {
      state: hasPreviousReport ? 'failed_with_previous' : 'failed',
      statusKey: 'failed',
      label: hasPreviousReport ? 'Failed · Needs retry' : 'Failed',
      sublabel: hasPreviousReport ? 'Previous report available' : 'Analysis failed',
      isWaiting: false,
      isProcessing: false,
      isFailed: true,
      isCompleted: false,
      hasPreviousReport,
      isDelayed: false,
      ageMs,
      formattedWait,
    }
  }

  return {
    state: 'never_analyzed',
    statusKey: latest.status,
    label: latest.status,
    isWaiting: false,
    isProcessing: false,
    isFailed: false,
    isCompleted: false,
    hasPreviousReport,
    isDelayed: false,
    ageMs,
    formattedWait,
  }
}

export type FailureCategory =
  | 'timeout'
  | 'auth'
  | 'repo_not_found'
  | 'branch_not_found'
  | 'memory'
  | 'limits'
  | 'worker_restart'
  | 'generic'

export interface FailureExplanation {
  category: FailureCategory
  summary: string
  guidance: string
  actionLabel: string
  actionType: 'retry' | 'settings' | 'general'
}

export function getFailureExplanation(errorMessage: string | null | undefined): FailureExplanation {
  const msg = (errorMessage ?? '').toLowerCase()

  // New rows carry a machine code prefix (`CODE: message`) written by the
  // analysis runner — classify on the code, not on substring guessing.
  const code = msg.match(/^([a-z_]+):/) ? (msg.match(/^([a-z_]+):/)![1] as string) : null
  if (code) {
    if (code === 'analysis_timeout') return timeoutExplanation()
    if (code === 'github_auth') return authExplanation()
    if (code === 'repo_not_found') return repoNotFoundExplanation()
    if (code === 'branch_not_found') return branchNotFoundExplanation()
    if (code === 'github_rate_limit') {
      return {
        category: 'generic',
        summary: 'GitHub rate limits were hit while preparing this scan.',
        guidance: 'GitHub temporarily restricted requests from this account or IP. The scan can be retried once the rate limit window resets.',
        actionLabel: 'Start a new analysis',
        actionType: 'retry',
      }
    }
    if (code === 'repository_too_large' || code === 'analysis_limit') return limitsExplanation()
    // analysis_internal and unknown codes fall through to the generic handler
    // below, which still reads the remainder of the message.
  }

  if (msg.includes('timed out') || msg.includes('timeout')) return timeoutExplanation()

  if (msg.includes('401') || msg.includes('bad credentials') || msg.includes('authentication') || msg.includes('token')) return authExplanation()

  if (msg.includes('branch') || msg.includes('remote branch')) return branchNotFoundExplanation()

  if (msg.includes('not found') || msg.includes('404') || msg.includes('repository not found')) return repoNotFoundExplanation()

  if (msg.includes('worker process restarted') || msg.includes('worker crashed') || msg.includes('terminated')) {
    return {
      category: 'worker_restart',
      summary: 'The worker process restarted while this scan was executing.',
      guidance: 'This usually occurs during deployment updates or container restarts. The previous job was cleanly reclaimed and you can safely start a new analysis.',
      actionLabel: 'Start a new analysis',
      actionType: 'retry',
    }
  }

  if (msg.includes('limit') || msg.includes('exceeded') || msg.includes('analysislimiterror')) return limitsExplanation()

  return {
    category: 'generic',
    summary: 'The analysis encountered an error during inspection.',
    guidance: 'You can safely trigger a new analysis. If the failure persists, inspect the technical error details below.',
    actionLabel: 'Start a new analysis',
    actionType: 'retry',
  }
}

function timeoutExplanation(): FailureExplanation {
  return {
    category: 'timeout',
    summary: 'Analysis timed out before completing inspection.',
    guidance: 'Large repositories, massive dependency trees, or prolonged clone operations can exceed execution budgets. Arbor shallow-clones repositories to keep inspections fast.',
    actionLabel: 'Start a new analysis',
    actionType: 'retry',
  }
}

function authExplanation(): FailureExplanation {
  return {
    category: 'auth',
    summary: 'GitHub authentication was rejected while preparing the repository.',
    guidance: 'The stored OAuth token or Personal Access Token may have expired or lacks access to this repository. Reconnect your GitHub account in Settings.',
    actionLabel: 'Check GitHub integrations',
    actionType: 'settings',
  }
}

function branchNotFoundExplanation(): FailureExplanation {
  return {
    category: 'branch_not_found',
    summary: 'The requested branch was not found in the remote repository.',
    guidance: 'Ensure the default branch configured in Arbor matches an existing branch on GitHub.',
    actionLabel: 'Check repository settings',
    actionType: 'settings',
  }
}

function repoNotFoundExplanation(): FailureExplanation {
  return {
    category: 'repo_not_found',
    summary: 'The repository could not be located on GitHub.',
    guidance: 'The remote repository may have been renamed, transferred, or deleted, or your account lacks read access.',
    actionLabel: 'Check repository settings',
    actionType: 'settings',
  }
}

function limitsExplanation(): FailureExplanation {
  return {
    category: 'limits',
    summary: 'The repository exceeded static analysis safety limits.',
    guidance: 'The codebase exceeds configured file count or file size limits for single-pass AST parsing.',
    actionLabel: 'Start a new analysis',
    actionType: 'retry',
  }
}
