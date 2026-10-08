import fs from 'node:fs'
import path from 'node:path'
import { listFiles, readText } from './walk'
import type { DetectedTechStack } from './types'

const FRAMEWORKS: [string, string][] = [
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['@sveltejs/kit', 'SvelteKit'],
  ['svelte', 'Svelte'],
  ['@remix-run/react', 'Remix'],
  ['remix', 'Remix'],
  ['astro', 'Astro'],
  ['vite', 'Vite'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['angular', 'Angular'],
  ['hono', 'Hono'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['nestjs', 'NestJS'],
  ['solid-js', 'Solid'],
  ['gatsby', 'Gatsby'],
]

const DATABASES: [RegExp, string][] = [
  [/@prisma\/client/, 'Prisma'],
  [/drizzle-orm/, 'Drizzle ORM'],
  [/@supabase\/supabase-js/, 'Supabase'],
  [/pg\b/, 'PostgreSQL'],
  [/mysql2?/, 'MySQL'],
  [/mongoose/, 'MongoDB (Mongoose)'],
  [/mongodb/, 'MongoDB'],
  [/better-sqlite3|sqlite3|@libsql\/client/, 'SQLite'],
  [/redis|@upstash\/redis|ioredis/, 'Redis'],
]

const TESTING: [RegExp, string][] = [
  [/vitest/, 'Vitest'],
  [/jest/, 'Jest'],
  [/@playwright\/test/, 'Playwright'],
  [/cypress/, 'Cypress'],
  [/@testing-library\//, 'Testing Library'],
  [/\bava\b/, 'AVA'],
]

const UI: [RegExp, string][] = [
  [/tailwindcss/, 'Tailwind CSS'],
  [/class-variance-authority/, 'shadcn/ui'],
  [/radix-ui/, 'Radix UI'],
  [/lucide-react/, 'Lucide Icons'],
  [/framer-motion/, 'Framer Motion'],
  [/styled-components/, 'styled-components'],
  [/@emotion\//, 'Emotion'],
  [/material-ui|@mui\//, 'Material UI'],
  [/antd/, 'Ant Design'],
  [/chakra-ui/, 'Chakra UI'],
]

const LANGUAGES: [RegExp, string][] = [
  [/\.tsx?$/, 'TypeScript'],
  [/\.jsx?$/, 'JavaScript'],
  [/\.py$/, 'Python'],
  [/\.go$/, 'Go'],
  [/\.rs$/, 'Rust'],
  [/\.java$/, 'Java'],
  [/\.rb$/, 'Ruby'],
  [/\.php$/, 'PHP'],
  [/\.cs$/, 'C#'],
  [/\.swift$/, 'Swift'],
  [/\.cpp$|\.cc$|\.hpp$/, 'C++'],
  [/\.c$|\.h$/, 'C'],
  [/\.kt$/, 'Kotlin'],
]

function readJson(dir: string, file: string): Record<string, unknown> | null {
  try {
    const text = readText(path.join(dir, file))
    return text == null ? null : JSON.parse(text)
  } catch {
    return null
  }
}

export function detectTechStack(dir: string, files: string[] = listFiles(dir)): DetectedTechStack {
  const pkg = readJson(dir, 'package.json')
  const deps = { ...((pkg?.dependencies as object) ?? {}), ...((pkg?.devDependencies as object) ?? {}) }
  const depNames = Object.keys(deps)
  const depStr = depNames.join(' ')

  const languages = new Set<string>()
  const extensionCount: Record<string, number> = {}
  for (const f of files) {
    for (const [re, lang] of LANGUAGES) {
      if (re.test(f)) {
        extensionCount[lang] = (extensionCount[lang] ?? 0) + 1
        languages.add(lang)
        break
      }
    }
  }

  const match = (list: [RegExp, string][]) =>
    list.filter(([re]) => re.test(depStr)).map(([, name]) => name)

  const locked = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']
    .find((l) => files.includes(path.join(dir, l)))

  const packageManager =
    locked === 'package-lock.json' ? 'npm'
    : locked === 'yarn.lock' ? 'yarn'
    : locked === 'pnpm-lock.yaml' ? 'pnpm'
    : locked === 'bun.lockb' ? 'bun' : null

  const framework = FRAMEWORKS.find(([name]) => depNames.includes(name))?.[1] ?? null

  return {
    languages: [...languages].sort((a, b) => (extensionCount[b] ?? 0) - (extensionCount[a] ?? 0)),
    framework,
    packageManager,
    databases: [...new Set(match(DATABASES))],
    testing: [...new Set(match(TESTING))],
    ui: [...new Set(match(UI))],
    keyDeps: depNames.slice(0, 12),
    typescript: (extensionCount.TypeScript ?? 0) > 0,
    monorepo: Boolean(pkg?.workspaces) || fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')),
  }
}