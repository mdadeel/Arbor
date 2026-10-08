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
import { Badge } from '@/components/ui/createui/badge'
import Link from 'next/link'

const healthDimensions = [
  { name: 'Architecture', score: 91 },
  { name: 'Tech Debt', score: 78 },
  { name: 'Performance', score: 88 },
  { name: 'Documentation', score: 63 },
  { name: 'Security', score: 96 },
  { name: 'Design System', score: 84 },
]

const commits = [
  { hash: '3f1a9c2', message: 'feat(brand): custom AST logo', tone: 'text-foreground' },
  { hash: 'b74de12', message: 'feat(export): dynamic shields badge', tone: 'text-foreground' },
  { hash: 'a08c3ff', message: 'fix(auth): PAT token refresh window', tone: 'text-foreground' },
]

export function FeatureSections() {
  return (
    <div className="space-y-24 sm:space-y-32">
      {/* Feature A: System Topology & Architecture */}
      <section id="architecture" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">
              <Layers className="h-3.5 w-3.5" />
              <span>System Topology</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance text-foreground font-display">
              Architecture &amp; Import Graph
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed text-balance">
              Arbor parses supported JavaScript and TypeScript files to map local imports. Explore
              module relationships in a graph, then inspect detected cycles and other structural
              findings in the report.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                'Dependency graph of analyzed module imports',
                'Detected cycles and oversized files surfaced for review',
                'A first-pass architectural audit in about 30 seconds',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Minimal Canvas: Node Wiring Graphic */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <Layers className="h-4 w-4 text-foreground" />
                <span>Import Graph Preview</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px]">
                <Badge variant="neutral" appearance="outline" size="xs">Sample graph</Badge>
                <span className="rounded-full bg-muted text-foreground px-2 py-0.5 border border-border">
                  0 Cycles
                </span>
                <span className="text-muted-foreground hidden sm:inline">18 Modules · 42 Edges</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <div className="text-foreground font-bold text-[11px] font-mono">PRESENTATION LAYER</div>
                <div className="text-foreground font-semibold font-sans">src/app · src/components</div>
                <div className="text-[10px] text-muted-foreground font-sans">24 unidirectional imports</div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <div className="text-foreground font-bold text-[11px] font-mono">DOMAIN SERVICES</div>
                <div className="text-foreground font-semibold font-sans">src/server/services</div>
                <div className="text-[10px] text-muted-foreground font-sans">16 procedure handlers</div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <div className="text-foreground font-bold text-[11px] font-mono">PERSISTENCE LAYER</div>
                <div className="text-foreground font-semibold font-sans">src/lib/prisma</div>
                <div className="text-[10px] text-muted-foreground font-sans">Postgres relational client</div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground font-sans">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Example import relationships
              </span>
              <span className="text-muted-foreground font-semibold font-mono">ILLUSTRATIVE</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature B: Repository Health & Metrics */}
      <section id="health" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Health Report Canvas */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm font-mono text-xs order-2 lg:order-1">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2 text-foreground font-semibold font-sans">
                <Activity className="h-4 w-4 text-foreground" />
                <span>Repository Health Report</span>
              </div>
              <Badge variant="neutral" appearance="soft" size="xs">Example · 82 / 100</Badge>
            </div>

            <div className="space-y-2.5 mb-5 font-sans">
              {healthDimensions.map(({ name, score }) => (
                <div key={name} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground truncate">{name}</span>
                  <span className="text-foreground font-bold font-mono tabular-nums">{score}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground font-sans">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <Zap className="h-3.5 w-3.5 text-foreground" />
                Technical debt reduction roadmap generated
              </span>
              <span className="text-foreground font-bold font-mono">PROCESSED</span>
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span>Health Signals</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance text-foreground font-display">
              Repository Health &amp; Metrics
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed text-balance">
              Each report includes an overall score and six dimension scores: architecture, tech debt,
              performance, documentation, security, and design system. The scores update when an
              analysis completes, and the README badge reflects the latest completed audit.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                'Dynamic README badge for the latest completed audit',
                'Commit Pulse summarizes Conventional Commit activity',
                'Static checks for common secret patterns and environment docs',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bento Grid: 3 secondary cards */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">
            <Terminal className="h-3.5 w-3.5" />
            <span>Developer Workbench</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display text-balance">
            Built Like a Workbench. Not a Generic Dashboard.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed text-balance">
            Replaces ambiguous summaries with concrete syntax structures, dependency maps, and
            Conventional Commits impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cell 1: Secret & Env Shield */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-all">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-foreground border border-border">
                <Lock className="h-3.5 w-3.5" />
                <span>SECRET &amp; ENV SHIELD</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                Secret &amp; Env Shield
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Static pattern checks flag common committed-secret formats, while environment
                checks compare referenced variable names with your `.env.example`. Findings store
                file locations, not the matched secret value.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[11px]">
                <span className="text-foreground">Example static-check output</span>
                <Badge variant="neutral" appearance="outline" size="xs">Illustrative</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-foreground">Common secret patterns</span>
                <span className="text-muted-foreground font-bold">Rule-based</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-foreground">Environment documentation</span>
                <span className="text-muted-foreground font-bold">.env.example</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-foreground">Large source files</span>
                <span className="text-muted-foreground font-bold">Review flag</span>
              </div>
            </div>
          </article>

          {/* Cell 2: Interactive API Explorer */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-all">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-foreground border border-border">
                <Terminal className="h-3.5 w-3.5" />
                <span>API EXPLORER</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                Interactive API Explorer
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Import an OpenAPI schema, inspect endpoints, and try HTTP requests through a
                server-side proxy without leaving the workbench.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[11px]">
                <span className="text-foreground">Example request log</span>
                <Badge variant="neutral" appearance="outline" size="xs">Illustrative</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="min-w-0 truncate text-foreground font-semibold">GET /api/badge/[slug]</span>
                <span className="shrink-0 text-muted-foreground font-mono text-[10px]">Response preview</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="min-w-0 truncate text-foreground font-semibold">POST /api/trpc/project.analyze</span>
                <span className="shrink-0 text-muted-foreground font-mono text-[10px]">Response preview</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                <span>Schema import</span>
                <span className="text-foreground font-semibold">OpenAPI</span>
              </div>
            </div>
          </article>

          {/* Cell 3: Living Docs */}
          <article className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-all md:col-span-2 lg:col-span-1">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs font-mono font-semibold text-foreground border border-border">
                <FileCode className="h-3.5 w-3.5" />
                <span>LIVING DOCS</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
                Living Docs
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Create project-specific Markdown for architecture notes, APIs, runbooks, guides, and
                decisions. Version history preserves prior edits, while review dates and staleness
                checks help teams keep documentation current.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[11px]">
                <span className="text-foreground">Example project activity</span>
                <Badge variant="neutral" appearance="outline" size="xs">Illustrative</Badge>
              </div>
              {commits.map(({ hash, message }) => (
                <div key={hash} className="flex items-center gap-2 text-foreground text-[11px]">
                  <GitCommit className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span className="font-mono text-muted-foreground">{hash}</span>
                  <span className="truncate">{message}</span>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="w-full justify-between font-mono text-[11px] text-muted-foreground hover:text-foreground mt-1"
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