import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

interface ComposeDependsOnEntry {
  condition?: string
  required?: boolean
}

interface ComposeService {
  image?: string
  profiles?: string[]
  build?: { context?: string; dockerfile?: string }
  command?: string[] | string
  depends_on?: Record<string, ComposeDependsOnEntry>
  environment?: Record<string, string>
  healthcheck?: { test?: string[] | string }
}

interface ComposeFile {
  services?: Record<string, ComposeService>
  volumes?: Record<string, unknown>
}

function findDockerfiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findDockerfiles(full))
    } else if (/^dockerfile(\..+)?$/i.test(entry.name)) {
      results.push(path.relative(process.cwd(), full))
    }
  }
  return results
}

describe('self-hosted single Dockerfile, Compose profiles & worker deployment config', () => {
  const repoRoot = process.cwd()

  it('maintains a single root Dockerfile with entrypoint, healthcheck, Next.js app, and worker support', () => {
    expect(findDockerfiles(repoRoot)).toEqual(['Dockerfile'])

    const dockerfilePath = path.join(repoRoot, 'Dockerfile')
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8')
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS deps')
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS builder')
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS runner')
    expect(dockerfile).toContain('git')
    expect(dockerfile).toContain('openssl')
    expect(dockerfile).toContain('COPY --from=builder --chown=arbor:arbor /app/src ./src')
    expect(dockerfile).toContain('HEALTHCHECK')
    expect(dockerfile).toContain('/api/health')
    expect(dockerfile).toContain('ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]')
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]')

    const entrypointPath = path.join(repoRoot, 'scripts', 'docker-entrypoint.sh')
    expect(fs.existsSync(entrypointPath)).toBe(true)
    execFileSync('sh', ['-n', entrypointPath])
  })

  it('defines postgres/redis profiles and migrate/app/worker services sharing the single Dockerfile', () => {
    const composeRaw = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8')
    const parsed = yaml.load(composeRaw) as ComposeFile

    const postgres = parsed.services?.postgres
    const redis = parsed.services?.redis
    const migrate = parsed.services?.migrate
    const app = parsed.services?.app
    const worker = parsed.services?.worker

    expect(postgres?.profiles).toEqual(expect.arrayContaining(['postgres', 'bundled']))
    expect(redis?.profiles).toEqual(expect.arrayContaining(['redis', 'bundled']))

    expect(migrate?.build?.dockerfile).toBe('Dockerfile')
    expect(migrate?.image).toBe('arbor-selfhosted:local')
    expect(migrate?.command).toEqual(['npx', 'prisma', 'db', 'push', '--skip-generate'])
    expect(migrate?.depends_on?.postgres?.required).toBe(false)

    expect(app?.build?.dockerfile).toBe('Dockerfile')
    expect(app?.image).toBe('arbor-selfhosted:local')
    expect(app?.command).toEqual(['npm', 'run', 'start'])
    expect(app?.depends_on?.postgres).toEqual({
      condition: 'service_healthy',
      required: false,
    })
    expect(app?.depends_on?.redis).toEqual({
      condition: 'service_healthy',
      required: false,
    })
    expect(app?.depends_on?.migrate?.condition).toBe('service_completed_successfully')

    expect(worker?.build?.dockerfile).toBe('Dockerfile')
    expect(worker?.image).toBe('arbor-selfhosted:local')
    expect(worker?.command).toEqual(['npm', 'run', 'worker'])
    expect(worker?.depends_on?.postgres).toEqual({
      condition: 'service_healthy',
      required: false,
    })
    expect(worker?.depends_on?.redis).toEqual({
      condition: 'service_healthy',
      required: false,
    })
    expect(worker?.depends_on?.migrate?.condition).toBe('service_completed_successfully')
    expect(worker?.environment?.REDIS_URL).toContain('redis://redis:6379')
    expect(worker?.environment?.DATABASE_URL).toContain(
      'postgresql://arbor:arbor@postgres:5432/arbor'
    )

    const envExample = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8')
    expect(envExample).toContain('COMPOSE_PROFILES="postgres,redis"')

    const selfHostDoc = fs.readFileSync(path.join(repoRoot, 'docs', 'self-hosting.md'), 'utf8')
    expect(selfHostDoc).toContain('docker compose up -d --build')
    expect(selfHostDoc).toContain('COMPOSE_PROFILES')
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
