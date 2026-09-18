'use client'

import {
  Activity,
  CheckCircle2,
  ChevronRight,
  FileCode,
  GitCommit,
  Layers,
  Lock,
  Terminal,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const healthDimensions = [
  { name: 'Architecture & Layer Isolation', score: 91 },
  { name: 'Tech Debt & Large Files', score: 78 },
  { name: 'Maintainability', score: 84 },
  { name: 'Dependency Health', score: 72 },
  { name: 'Runtime / Bundle Performance', score: 88 },
  { name: 'Security & Secret Audits', score: 96 },
  { name: 'Documentation Coverage', score: 63 },
]

const commits = [
  { hash: '3f1a9c2', message: 'feat(brand): custom AST logo', tone: 'text-emerald-400' },
  { hash: 'b74de12', message: 'feat(export): dynamic shields badge', tone: 'text-cyan-400' },
  { hash: 'a08c3ff', message: 'fix(auth): PAT token refresh window', tone: 'text-blue-400' },
]

export function FeatureSections() {
  return (
    <div className="space-y-28 sm:space-y-36">
      {/* 4 Numbers Banner — dark console ribbon */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">
          <div className="border-r border-border pr-4 space-y-1">
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              &lt; 30s
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Deterministic AST runtime
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Babel parser, zero LLM cold starts
            </div>
          </div>

          <div className="border-r border-border px-2 sm:px-4 space-y-1">
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-emerald-400">
              100%
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Deterministic Syntax Tree
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Pure AST nodes, zero hallucinations
            </div>
          </div>

          <div className="border-r border-border px-2 sm:px-4 space-y-1">
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-cyan-400">
              7
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Health Dimensions Evaluated
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Architecture, debt, security &amp; perf
            </div>
          </div>

          <div className="pl-4 space-y-1">
            <div className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-blue-400">
              0 bytes
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Source Code Retained
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              Ephemeral memory clone, purged in ~30s
            </div>
          </div>
        </div>
      </section>

      {/* Feature A: System Topology & Architecture */}
      <section id="architecture" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance text-foreground font-display">
              System Topology &amp; Architecture
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Arbor reads every file through a standard Babel AST parser and constructs an
              interactive Directed Acyclic Graph of your entire import architecture. Our
              dependency graph visualization flags forbidden cross-layer imports and cyclic
              dependencies before they ever reach
              <code className="text-foreground font-mono"> main</code>.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                'Live dependency graph with module boundary isolation',
                'Strict unidirectional rule: Controllers → Services → Data Layer',
                'Automated architectural audit on every push',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Dark Canvas: Node Wiring Graphic */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2 text-foreground">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span className="font-semibold">Module Boundary Isolation</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded bg-emerald-500/15 text-emerald-400 px-2 py-0.5 border border-emerald-500/30 font-semibold">
                  0 Cycles Detected
                </span>
                <span className="text-muted-foreground hidden sm:inline">18 Modules · 42 Edges</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-1">
                <div className="text-cyan-400 font-bold text-[11px]">PRESENTATION LAYER</div>
                <div className="text-foreground font-semibold">src/app &middot; src/components</div>
                <div className="text-[10px] text-muted-foreground">24 unidirectional imports</div>
              </div>

              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
                <div className="text-blue-400 font-bold text-[11px]">DOMAIN SERVICES</div>
                <div className="text-foreground font-semibold">src/server/services</div>
                <div className="text-[10px] text-muted-foreground">16 tRPC procedure handlers</div>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                <div className="text-emerald-400 font-bold text-[11px]">PERSISTENCE LAYER</div>
                <div className="text-foreground font-semibold">src/lib/prisma</div>
                <div className="text-[10px] text-muted-foreground">Postgres relational client</div>
              </div>
            </div>

            <div className="rounded border border-border bg-muted/60 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Strict unidirectional rule enforced
              </span>
              <span className="text-emerald-400 font-semibold font-mono">PASS 100%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature B: Repository Health & Metrics */}
      <section id="health" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Dark Canvas: Health Report */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl font-mono text-xs order-2 lg:order-1">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2 text-foreground">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span className="font-semibold">Repository Health Report</span>
              </div>
              <span className="rounded bg-emerald-500/15 text-emerald-400 px-2 py-0.5 border border-emerald-500/30 font-bold text-[11px]">
                OVERALL 82 / 100
              </span>
            </div>

            <div className="space-y-2.5 mb-5">
              {healthDimensions.map(({ name, score }) => (
                <div key={name} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground truncate">{name}</span>
                  <span className="text-foreground font-semibold">{score}</span>
                </div>
              ))}
            </div>

            <div className="rounded border border-border bg-muted/60 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                Technical debt reduction roadmap generated
              </span>
              <span className="text-cyan-400 font-semibold font-mono">PROCESSED</span>
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance text-foreground font-display">
              Repository Health &amp; Metrics
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Every repository receives a 0–100 audit across 7 dimensions — architecture,
              technical debt, security, documentation and more. The score updates on every run,
              so a shields badge in your README always reflects the latest audit.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                'Dynamic README badge that never goes stale',
                'Commit Pulse with Conventional Commits semantics',
                'Security & secret audits in seconds, not sprints',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bento Grid: 3 secondary cards */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display">
            Built Like a Workbench. Not a Generic Dashboard.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Replaces ambiguous summaries with concrete syntax structures, dependency maps, and
            Conventional Commits impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cell 1: Secret & Env Shield */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-md group hover:border-emerald-500/40 transition-all">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-500 dark:text-emerald-400">
                <Lock className="h-3.5 w-3.5" />
                <span>SECRET &amp; ENV SHIELD</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                Secret &amp; Env Shield
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Deterministic regex scanners audit your codebase for accidental private keys,
                database credentials, and unvalidated environment variables — comparing staging
                vs production definitions without ever reading secret values.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-foreground">JWT Secret Key Scanning</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold">0 Leaks</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-foreground">Staging / Prod Env Parity</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold">100%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-foreground">Files Over 350 LOC Warning</span>
                <span className="text-amber-500 dark:text-amber-400 font-bold">1 Flagged</span>
              </div>
            </div>
          </article>

          {/* Cell 2: Interactive API Explorer */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-md group hover:border-cyan-500/40 transition-all">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-cyan-500 dark:text-cyan-400">
                <Terminal className="h-3.5 w-3.5" />
                <span>INTERACTIVE API EXPLORER</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                Interactive API Explorer
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Import Swagger or OpenAPI schemas and execute test HTTP requests through a secure
                Node.js CORS bypass proxy — no external tools, no context switching.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-500 dark:text-cyan-400 font-semibold">GET /api/badge/[slug]</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-mono text-[10px]">200 OK · 14ms</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-primary font-semibold">POST /api/trpc/project.analyze</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-mono text-[10px]">200 OK · 42ms</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <span>Immutable version snapshot</span>
                <span className="text-foreground font-semibold">v1.2</span>
              </div>
            </div>
          </article>

          {/* Cell 3: Living Docs */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-md group hover:border-primary/40 transition-all md:col-span-2 lg:col-span-1">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
                <FileCode className="h-3.5 w-3.5" />
                <span>LIVING DOCS</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                Living Docs
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                AI-generated codebase documentation derived from the AST itself. Versioned
                snapshots stay immutable while automatic 90-day staleness alerts keep the docs
                honest.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 space-y-2 font-mono text-xs">
              {commits.map(({ hash, message, tone }) => (
                <div key={hash} className="flex items-center gap-2 text-foreground text-[11px]">
                  <GitCommit className={`h-3.5 w-3.5 ${tone} shrink-0`} />
                  <span className="font-mono text-muted-foreground">{hash}</span>
                  <span className="truncate">{message}</span>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="w-full justify-between font-mono text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Link href="/dashboard">
                  Open docs workspace
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}