import { env } from '@/lib/env'
import type { AnalysisOptions } from './index'

export function analysisOptionsFromEnv(maxDurationMs = env.ANALYSIS_TIMEOUT_MS): AnalysisOptions {
  return {
    maxFiles: env.MAX_FILES,
    maxRepoSizeBytes: env.MAX_REPO_SIZE_MB * 1024 * 1024,
    maxFileSizeBytes: env.MAX_FILE_SIZE_KB * 1024,
    maxParseFiles: env.MAX_PARSE_FILES,
    maxDurationMs: Math.max(1, maxDurationMs),
    maxDirectoryDepth: 64,
  }
}
