'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  FileCode2,
  GitPullRequest,
  RefreshCw,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react'

interface FindingScenario {
  id: string
  title: string
  file: string
  summaryMissed: string
  mechanismMissed: string
  missedTool: string
  summaryCaught: string
  mechanismCaught: string
  codeSnippet: {
    filename: string
    lines: { num: number; code: string; highlight?: 'warn' | 'crit' }[]
  }
}

const FINDINGS: FindingScenario[] = [
  {
    id: 'cyclic-import',
    title: 'Cyclic import loop across modules',
    file: 'src/server/routers/project.ts ↔ src/server/services/system-analysis.ts',
    summaryMissed: 'MISSED',
    mechanismMissed: 'Relationship not traversed',
    missedTool: 'ESLint: 0 errors (valid TS in isolation). LLM reviewer: "LGTM! Clean modular code."',
    summaryCaught: 'CAUGHT',
    mechanismCaught: 'Resolved AST edge',
    codeSnippet: {
      filename: 'src/server/routers/project.ts',
      lines: [
        { num: 14, code: 'import { systemAnalysisService } from "../services/system-analysis"' },
        { num: 15, code: 'import { createTRPCRouter, protectedProcedure } from "../trpc"' },
        { num: 16, code: '// system-analysis.ts imports projectRouter → 2-node cycle', highlight: 'crit' },
        { num: 17, code: 'export const projectRouter = createTRPCRouter({' },
        { num: 18, code: '  analyze: protectedProcedure.mutation(async ({ ctx }) => {' },
        { num: 19, code: '    return systemAnalysisService.run(ctx.user.id)' },
        { num: 20, code: '  }),' },
        { num: 21, code: '})' },
      ],
    },
  },
  {
    id: 'exposed-secret',
    title: 'Exposed internal service token in outbound fetch',
    file: 'src/app/api/proxy/route.ts:12',
    summaryMissed: 'MISSED',
    mechanismMissed: 'Pattern not checked',
    missedTool: 'Linter passes syntax. LLM: "Added bearer authorization header successfully."',
    summaryCaught: 'CAUGHT',
    mechanismCaught: 'Regex-verified',
    codeSnippet: {
      filename: 'src/app/api/proxy/route.ts',
      lines: [
        { num: 8, code: 'export async function POST(req: NextRequest) {' },
        { num: 9, code: '  const { targetUrl } = await req.json()' },
        { num: 10, code: '  // Blindly forwarding server secret without CIDR check', highlight: 'crit' },
        { num: 11, code: '  const res = await fetch(targetUrl, {' },
        { num: 12, code: '    headers: { Authorization: `Bearer ${process.env.INTERNAL_TOKEN}` },', highlight: 'crit' },
        { num: 13, code: '  })' },
        { num: 14, code: '  return NextResponse.json(await res.json())' },
        { num: 15, code: '}' },
      ],
    },
  },
  {
    id: 'unguarded-route',
    title: 'Unguarded administrative procedure in router',
    file: 'src/server/routers/admin.ts:42',
    summaryMissed: 'MISSED',
    mechanismMissed: 'Middleware edge absent',
    missedTool: 'Linter: valid function export. LLM bot: misses missing ensureAdmin middleware call.',
    summaryCaught: 'CAUGHT',
    mechanismCaught: 'Graph path check',
    codeSnippet: {
      filename: 'src/server/routers/admin.ts',
      lines: [
        { num: 39, code: 'export const adminRouter = createTRPCRouter({' },
        { num: 40, code: '  // Missing ensureAdmin / protectedProcedure middleware guard', highlight: 'warn' },
        { num: 41, code: '  purgeAnalyses: publicProcedure' },
        { num: 42, code: '    .mutation(async ({ ctx }) => {', highlight: 'crit' },
        { num: 43, code: '      return adminService.purgeFailedAnalyses()' },
        { num: 44, code: '    }),' },
        { num: 45, code: '})' },
      ],
    },
  },
]

export function WhatOthersMiss() {
  const [mode, setMode] = useState<'summary' | 'mechanism'>('summary')
  const [selectedFinding, setSelectedFinding] = useState<string>(FINDINGS[0].id)
  const [hoveredFinding, setHoveredFinding] = useState<string | null>(null)
  const activeFindingId = hoveredFinding || selectedFinding
  const current = FINDINGS.find((f) => f.id === activeFindingId) || FINDINGS[0]

  return (
    <section id="proof" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
      {/* Section Head: 03 / SIGNATURE MODULE */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[260px_1fr] gap-6 sm:gap-10 mb-10 pb-8 border-b border-border dark:border-line">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-acid">
            03 / SIGNATURE MODULE
          </span>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display text-balance leading-[1.08]">
            Turn &ldquo;deterministic&rdquo; into a visual comparison.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed text-balance">
            This is Arbor&apos;s ownable moment: not a feature grid, not a decorative animation, but a side-by-side audit that explains exactly why Arbor is different.
          </p>
        </div>
      </div>

      {/* Main Proof Demo Card */}
      <div className="border border-border dark:border-line-strong bg-card text-foreground font-mono">
        
        {/* Demo Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-border dark:border-line text-xs font-medium bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground uppercase tracking-wider">
              PROPOSED MODULE / DEMONSTRATION CONTENT
            </span>
          </div>

          {/* Toggle: Summary vs Mechanism */}
          <div className="flex items-center gap-1 border border-border dark:border-line-strong p-0.5 bg-card" role="group" aria-label="Finding detail density">
            <button
              type="button"
              onClick={() => setMode('summary')}
              className={`px-3 py-1 text-xs transition-colors ${
                mode === 'summary'
                  ? 'bg-foreground text-background font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setMode('mechanism')}
              className={`px-3 py-1 text-xs transition-colors ${
                mode === 'mechanism'
                  ? 'bg-foreground text-background font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mechanism
            </button>
          </div>
        </div>

        {/* Demo Grid: Missed vs Caught */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border dark:divide-line-strong">
          
          {/* Left Column: What Other Reviews Miss */}
          <div className="p-6 sm:p-8 space-y-6 bg-card/40">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                WHAT OTHER REVIEWS MISS
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans mt-1">
                Partial context.
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-sans">
                Linters only check single files in isolation; LLMs hallucinate unseen dependencies; static wikis rot.
              </p>
            </div>

            {/* Findings List */}
            <div className="space-y-4 pt-2">
              {FINDINGS.map((f) => {
                const isSelected = selectedFinding === f.id
                const isHovered = activeFindingId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFinding(f.id)}
                    onMouseEnter={() => setHoveredFinding(f.id)}
                    onMouseLeave={() => setHoveredFinding(null)}
                    className={`w-full text-left p-3.5 border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'border-destructive bg-destructive/15 shadow-[2px_2px_0_currentColor]'
                        : isHovered
                        ? 'border-destructive/60 bg-destructive/5'
                        : 'border-border dark:border-line bg-muted/20 hover:border-foreground/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-destructive font-bold text-base leading-none mt-0.5">
                          &times;
                        </span>
                        <div>
                          <b className="block text-xs font-sans text-foreground font-semibold">
                            {f.title}
                          </b>
                          <code className="text-[11px] text-muted-foreground block mt-1">
                            {f.file}
                          </code>
                          <span className="text-[10px] text-muted-foreground block mt-1 font-sans">
                            {f.missedTool}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold border border-destructive/40 text-destructive bg-destructive/10 uppercase">
                        {mode === 'summary' ? f.summaryMissed : f.mechanismMissed}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: What Arbor Shows */}
          <div className="p-6 sm:p-8 space-y-6 bg-muted/10">
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-acid tracking-wider uppercase">
                WHAT ARBOR SHOWS
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans mt-1">
                Evidence attached.
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-sans">
                Every finding connects to a deterministic mechanism: AST import graph, static pattern matcher, or route middleware path check.
              </p>
            </div>

            {/* Caught Findings List */}
            <div className="space-y-4 pt-2">
              {FINDINGS.map((f) => {
                const isSelected = selectedFinding === f.id
                const isHovered = activeFindingId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFinding(f.id)}
                    onMouseEnter={() => setHoveredFinding(f.id)}
                    onMouseLeave={() => setHoveredFinding(null)}
                    className={`w-full text-left p-3.5 border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/15 dark:bg-acid/15 shadow-[2px_2px_0_currentColor]'
                        : isHovered
                        ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-acid/5'
                        : 'border-border dark:border-line bg-card hover:border-foreground/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-600 dark:text-acid font-bold text-base leading-none mt-0.5">
                          &#10003;
                        </span>
                        <div>
                          <b className="block text-xs font-sans text-foreground font-semibold">
                            {f.title}
                          </b>
                          <code className="text-[11px] text-emerald-600 dark:text-acid block mt-1">
                            {f.file}
                          </code>
                          <span className="text-[10px] text-muted-foreground block mt-1 font-sans">
                            AST deterministic inspection · zero hallucinations
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/40 text-emerald-600 dark:text-acid bg-emerald-500/10 dark:bg-acid/10 uppercase">
                        {mode === 'summary' ? f.summaryCaught : f.mechanismCaught}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {/* Selected Code Diff Snippet Inspector */}
        <div className="border-t border-border dark:border-line-strong p-4 sm:p-6 bg-black text-neutral-200">
          <div className="flex items-center justify-between mb-3 text-xs text-neutral-400">
            <span>INSPECTING: <strong className="text-neutral-100">{current.codeSnippet.filename}</strong></span>
            <span>Deterministic AST Walk: &lt; 5s</span>
          </div>
          <div className="space-y-1 overflow-x-auto text-xs py-1">
            {current.codeSnippet.lines.map((l) => (
              <div
                key={l.num}
                className={`flex items-center gap-4 px-2 py-0.5 ${
                  l.highlight === 'crit'
                    ? 'bg-red-500/20 text-red-200 border-l-2 border-red-500'
                    : l.highlight === 'warn'
                    ? 'bg-amber-500/20 text-amber-200 border-l-2 border-amber-500'
                    : 'text-neutral-400'
                }`}
              >
                <span className="w-6 text-right select-none text-neutral-600">{l.num}</span>
                <span className="font-mono">{l.code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="p-4 border-t border-border dark:border-line text-[11px] text-muted-foreground bg-muted/20">
          Important: Every finding in Arbor is backed by Babel AST parsing or static pattern checking. No generative AI guesses, no probabilistic false positives.
        </div>

      </div>
    </section>
  )
}
