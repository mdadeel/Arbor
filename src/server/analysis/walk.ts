import * as fs from 'node:fs'
import * as path from 'node:path'

const IGNORED = new Set([
  '.git', 'node_modules', '.next', '.turbo', 'dist', 'build', 'out',
  '.cache', 'coverage', '.nuxt', '.output', '.svelte-kit', '.expo',
  '.vercel', '__pycache__', '.venv', 'venv', 'target',
])

export function listFiles(dir: string): string[] {
  const out: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (IGNORED.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(full))
    else out.push(full)
  }
  return out
}

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'])

export function isSourceFile(file: string): boolean {
  return SOURCE_EXT.has(path.extname(file))
}

const CONFIG_NAMES = new Set([
  'package.json', 'tsconfig.json', 'next.config.mjs', 'next.config.js', 'next.config.ts',
  'vite.config.ts', 'vite.config.js', 'tailwind.config.ts', 'tailwind.config.js',
  'eslint.config.mjs', '.eslintrc.json', '.eslintrc.js', 'prettier.config.js',
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '.env.example', '.gitignore',
  'vitest.config.ts', 'jest.config.js', 'playwright.config.ts', 'tsup.config.ts',
])

export function isConfigFile(file: string): boolean {
  return CONFIG_NAMES.has(path.basename(file))
}

export function readText(file: string): string | null {
  try {
    // skip binary files entirely
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}