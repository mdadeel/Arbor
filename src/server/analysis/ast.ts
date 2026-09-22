import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse, type ParserPlugin } from '@babel/parser'
import traverse, { type NodePath } from '@babel/traverse'
import { readText } from './walk'

export interface FileAnalysis {
  imports: string[]
  exportedNames: string[]
  hasDefaultExport: boolean
  components: number
  hooks: number
  anyTypes: number
  consoleLogs: number
  imgTags: number
  nextImageImports: boolean
  processEnv: string[]
  clientDirective: boolean
  isReactFile: boolean
  commentLines: number
  jsdocCount: number
  localTargets: string[]
  parseFailed: boolean
}

const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

export function resolveLocalTarget(
  repoDir: string,
  file: string,
  spec: string
): string | null {
  if (!/^(\.\.?\/|@\/)/.test(spec)) return null
  const base =
    spec.startsWith('@/')
      ? path.join(repoDir, 'src', spec.slice(2)) // @/* alias maps to src/
      : path.resolve(path.dirname(file), spec)

  for (const ext of SOURCE_EXT) {
    if (fs.existsSync(base + ext)) return rel(repoDir, base + ext)
    if (fs.existsSync(path.join(base, 'index' + ext))) return rel(repoDir, path.join(base, 'index' + ext))
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return rel(repoDir, base)
  return null
}

function rel(repoDir: string, file: string): string {
  return path.relative(repoDir, file).split(path.sep).join('/')
}

function guessRepoDir(file: string): string {
  let cur = path.dirname(file)
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur
    cur = path.dirname(cur)
  }
  return path.dirname(file)
}

function countOccurrences(text: string, re: RegExp): number {
  let n = 0
  for (const _ of text.matchAll(new RegExp(re.source, re.flags))) n++
  return n
}

function isComponentDefinition(p: NodePath): boolean {
  let name: string | null = null
  let body: NodePath | null = null

  if (p.isFunctionDeclaration()) {
    name = p.node.id?.name ?? null
    body = p.get('body')
  } else if (p.isVariableDeclarator() && Array.isArray(p.node.id)) {
     return false
  } else if (p.isVariableDeclarator() && p.node.id.type === 'Identifier') {
    const init = p.get('init')
    if (Array.isArray(init) || !init || (!init.isArrowFunctionExpression() && !init.isFunctionExpression())) return false
    name = p.node.id.name
    body = init.get('body') as NodePath
  }
  if (!name || !/^[A-Z]/.test(name) || !body) return false

  let hasJsx = false
  body.traverse({ JSXElement() { hasJsx = true } })
  return hasJsx
}

export function parseFile(file: string): FileAnalysis {
  const text = readText(file)
  const result: FileAnalysis = {
    imports: [],
    exportedNames: [],
    hasDefaultExport: false,
    components: 0,
    hooks: 0,
    anyTypes: 0,
    consoleLogs: 0,
    imgTags: 0,
    nextImageImports: false,
    processEnv: [],
    clientDirective: false,
    isReactFile: false,
    commentLines: 0,
    jsdocCount: 0,
    localTargets: [],
    parseFailed: false,
  }
  if (text == null) return result

  // text-scoped cheap counters (work even when parsing fails)
  const firstLine = text.split('\n').find((l) => l.trim() !== '') ?? ''
  result.clientDirective = /^['"]use client['"];?$/.test(firstLine.trim())
  result.imgTags = countOccurrences(text, /\b<img\b/g)
  result.jsdocCount = countOccurrences(text, /\/\*\*/g)
  result.commentLines = text
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')
    }).length
  for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) result.processEnv.push(m[1])
  for (const m of text.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) result.processEnv.push(m[1])
  for (const m of text.matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g)) result.processEnv.push(m[1])
  result.processEnv = [...new Set(result.processEnv)]

  let ast: any
  try {
    const isTs = /\.tsx?$/.test(file)
    const isJsx = /\.(t|j)sx$/.test(file)
    const plugins: ParserPlugin[] = []
    if (isJsx) plugins.push('jsx')
    if (isTs) plugins.push('typescript')
    if (plugins.length === 0) plugins.push('flow')
    ast = parse(text, { sourceType: 'unambiguous', plugins, errorRecovery: true })
  } catch {
    result.parseFailed = true
    return result
  }

  const repoDir = guessRepoDir(file)
  let reactImport = false
  let jsxElements = 0

  traverse(ast, {
    ImportDeclaration(p) {
      const spec = p.node.source.value
      result.imports.push(spec)
      if (spec === 'react' || spec === 'react/jsx-runtime') reactImport = true
      if (spec === 'next/image') result.nextImageImports = true
      const resolved = resolveLocalTarget(repoDir, file, spec)
      if (resolved) result.localTargets.push(resolved)
    },
    ExportNamedDeclaration(p) {
      const d = p.node.declaration
      if (
        (d?.type === 'FunctionDeclaration' || d?.type === 'ClassDeclaration') &&
        d.id?.name
      ) {
        result.exportedNames.push(d.id.name)
      }
      if (d && d.type === 'VariableDeclaration') {
        for (const decl of d.declarations) {
          if (decl.id.type === 'Identifier') result.exportedNames.push(decl.id.name)
        }
      }
      for (const specifier of p.node.specifiers ?? []) {
        if (specifier.type === 'ExportSpecifier') {
          const expName =
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : (specifier.exported as any).value || (specifier.local as any)?.name
          if (expName) result.exportedNames.push(expName)
        } else if ('local' in specifier && (specifier as any).local?.name) {
          result.exportedNames.push((specifier as any).local.name)
        }
      }
    },
    ExportDefaultDeclaration() {
      result.hasDefaultExport = true
    },
    CallExpression(p) {
      const callee = p.node.callee
      if (
        callee.type === 'Identifier' &&
        callee.name === 'require' &&
        p.node.arguments[0]?.type === 'StringLiteral'
      ) {
        result.imports.push(p.node.arguments[0].value)
      }
      if (
        callee.type === 'Identifier' &&
        /^use[A-Z]/.test(callee.name)
      ) {
        result.hooks++
      }
      if (callee.type === 'MemberExpression') {
        const obj = callee.object
        const prop = callee.property
        if (
          prop.type === 'Identifier' &&
          prop.name === 'log' &&
          obj.type === 'Identifier' &&
          obj.name === 'console'
        ) {
          result.consoleLogs++
        }
      }
    },
    TSAnyKeyword() {
      result.anyTypes++
    },
    JSXElement() {
      jsxElements++
    },
    FunctionDeclaration(p) {
      if (isComponentDefinition(p)) result.components++
    },
    VariableDeclarator(p) {
      if (isComponentDefinition(p)) result.components++
    },
  })

  result.isReactFile = reactImport || jsxElements > 0
  return result
}