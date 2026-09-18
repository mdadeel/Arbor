import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().default(''),
    GITHUB_CLIENT_SECRET: z.string().default(''),
    ENCRYPTION_SECRET: z.string().min(1),
    CLONE_BASE_DIR: z.string().default('/tmp/arbor-clones'),
    CLONE_TIMEOUT: z.coerce.number().default(60),
    MAX_REPO_SIZE_MB: z.coerce.number().default(500),
    MAX_FILES: z.coerce.number().default(5000),
    MAX_FILE_SIZE_KB: z.coerce.number().default(100),
    ANALYSIS_TIMEOUT_MS: z.coerce.number().default(300000),
    ADMIN_EMAILS: z.string().default(''),
    ADMIN_GITHUB_USERNAMES: z.string().default(''),
    ADMIN_USERNAME: z.string().default('adeel'),
    ADMIN_PASSWORD: z.string().default('adeel1212'),
    APP_URL: z.string().default('https://arborgit.vercel.app'),
  },
  client: {},
  experimental__runtimeEnv: {
    ...process.env,
  },
})

export const githubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)