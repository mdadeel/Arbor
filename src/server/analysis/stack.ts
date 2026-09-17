import fs from 'node:fs'
import path from 'node:path'
import { listFiles } from './walk'
import type { DetectedTechStack } from './types'

const FRAMEWORKS: [string, string][] = [
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
  ['angular', 'Angular'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['nestjs', 'NestJS'],
  ['solid-js', 'Solid'],
  ['remix', 'Remix'],
  ['gatsby', 'Gatsby'],
]

const DATABASES: [RegExp, string][] = [
  [/@prisma\/client/, 'PostgreSQL (Prisma)'],
  [/pg\b/, 'PostgreSQL'],
  [/mysql2/, 'MySQL'],
  [/mongoose/, 'MongoDB'],
  [/redis/, 'Redis'],
  [/mongodb/, 'MongoDB'],
  [/drizzle-orm/, 'PostgreSQL (Drizzle)'],
]

const TESTING: [RegExp, string][] = [
  [/vitest/, 'Vitest'],
  [/jest/, 'Jest'],
  [/@playwright\/test/, 'Playwright'],
  [/cypress/, 'Cypress'],
  [/\bava\b/, 'AVA'],
]

const UI: [RegExp, string][] = [
  [/tailwindcss/, 'Tailwind CSS'],
  [/styled-components/, 'styled-components'],
  [/@emotion\//, 'Emotion'],
  [/material-ui|@mui\//, 'Material UI'],
  [/antd/, 'Ant Design'],
  [/class-variance-authority/, 'shadcn/ui'],
  [/radix-ui/, 'Radix UI'],
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
    return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  } catch {
    return null
  }
}

export function detectTechStack(dir: string): DetectedTechStack {
  const files = listFiles(dir)
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