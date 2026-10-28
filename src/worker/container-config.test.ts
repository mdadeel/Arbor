import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

interface ComposeService {
  image?: string
  build?: { context?: string; dockerfile?: string }
  command?: string[] | string
  depends_on?: Record<string, { condition?: string }>
  environment?: Record<string, string>
}

interface ComposeFile {
  services?: Record<string, ComposeService>
  volumes?: Record<string, unknown>
}

describe('worker container & fallback deployment configuration', () => {
  const repoRoot = process.cwd()

  it('provides a multi-stage Dockerfile capable of running both Next.js and src/worker/', () => {
    const dockerfilePath = path.join(repoRoot, 'Dockerfile')
    expect(fs.existsSync(dockerfilePath)).toBe(true)

    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8')
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS deps')
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS builder')
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS runner')
    // Shallow cloning via simple-git and Prisma require git + openssl in runner stage
    expect(dockerfile).toContain('git')
    expect(dockerfile).toContain('openssl')
    expect(dockerfile).toContain('COPY --from=builder --chown=arbor:arbor /app/src ./src')
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]')
  })

  it('defines a long-lived worker service in docker-compose.yml wired to postgres and redis', () => {
    const composeRaw = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8')
    const parsed = yaml.load(composeRaw) as ComposeFile

    expect(parsed.services?.postgres).toBeDefined()
    expect(parsed.services?.redis).toBeDefined()
    expect(parsed.services?.app).toBeDefined()
    expect(parsed.services?.worker).toBeDefined()

    const worker = parsed.services?.worker
    expect(worker?.build?.dockerfile).toBe('Dockerfile')
    expect(worker?.command).toEqual(['npm', 'run', 'worker'])
    expect(worker?.depends_on?.postgres?.condition).toBe('service_healthy')
    expect(worker?.depends_on?.redis?.condition).toBe('service_healthy')
    expect(worker?.environment?.REDIS_URL).toContain('redis://redis:6379')
    expect(worker?.environment?.DATABASE_URL).toContain('postgresql://arbor:arbor@postgres:5432/arbor')
  })

  it('keeps the Vercel cron route as a documented fallback alongside Fly.io and Railway docs', () => {
    const vercelRaw = fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8')
    const vercelConfig = JSON.parse(vercelRaw) as {
      crons?: Array<{ path: string; schedule: string }>
    }
    expect(vercelConfig.crons).toEqual([
      {
        path: '/api/worker/process',
        schedule: '0 3 * * *',
      },
    ])

    const deployDoc = fs.readFileSync(
      path.join(repoRoot, 'docs', 'worker-deployment.md'),
      'utf8'
    )
    expect(deployDoc).toContain('Fly.io')
    expect(deployDoc).toContain('Railway')
    expect(deployDoc).toContain('REDIS_URL')
    expect(deployDoc).toContain('/api/worker/process')
  })
})
