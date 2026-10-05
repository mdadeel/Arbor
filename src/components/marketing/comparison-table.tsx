'use client'

import { ChevronLeft } from 'lucide-react'

interface MatrixRow {
  capability: string
  arbor: string
  arborHighlight?: boolean
  manual: string
  llm: string
  linters: string
}

const MATRIX_DATA: MatrixRow[] = [
  {
    capability: 'Multi-File Cycle Detection',
    arbor: 'Resolved via AST import graph',
    arborHighlight: true,
    manual: 'Manual diagram (drifts)',
    llm: 'Missed (context window limits)',
    linters: 'Ignored (file-isolated)',
  },
  {
    capability: 'Detection Mechanism',
    arbor: 'Deterministic syntax tree (Babel)',
    arborHighlight: true,
    manual: 'Subjective human review',
    llm: 'Stochastic next-token guess',
    linters: 'Single-file regex / rules',
  },
  {
    capability: 'Source Code Retention',
    arbor: '0 bytes (ephemeral clone, purged in ~30s)',
    arborHighlight: true,
    manual: 'Copied to external wiki cloud',
    llm: 'Transmitted to LLM cloud providers',
    linters: 'Local machine only',
  },
  {
    capability: 'Analysis Latency',
    arbor: '< 30s single-pass audit',
    arborHighlight: true,
    manual: 'Hours to weeks of authoring',
    llm: '2–5 minutes token streaming',
    linters: 'Instant (surface syntax only)',
  },
  {
    capability: 'Interactive Dependency Graph',
    arbor: 'Full route & service DAG canvas',
    arborHighlight: true,
    manual: 'Static outdated PNG/SVG exports',
    llm: 'None',
    linters: 'None',
  },
  {
    capability: 'Hallucination Probability',
    arbor: '0% (100% reproducible AST)',
    arborHighlight: true,
    manual: 'High (memory drift & stale docs)',
    llm: 'Significant (fabricates imports)',
    linters: '0% (rule-based)',
  },
  {
    capability: 'Setup & Configuration',
    arbor: 'Zero (1-click read-only GitHub OAuth)',
    manual: 'Continuous manual maintenance',
    llm: 'Prompt engineering & API keys',
    linters: 'Complex config files & rulesets',
  },
]

export function ComparisonTable() {
  return (
    <section id="comparison" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
      {/* Section Head: 05 / EVIDENCE MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[260px_1fr] gap-6 sm:gap-10 mb-10 pb-8 border-b border-border dark:border-line">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-acid">
            05 / EVIDENCE MATRIX
          </span>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display text-balance leading-[1.08]">
            Mechanisms over checkmarks.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed text-balance">
            Checkmarks flatten nuance. Here is how Arbor&apos;s deterministic AST engine behaves compared to manual wikis, generative LLM reviewers, and isolated linters.
          </p>
        </div>
      </div>

      {/* Comparison Grid Table */}
      <div className="border border-border dark:border-line-strong bg-card text-foreground font-mono">
        {/* Mobile swipe hint */}
        <div className="sm:hidden flex items-center gap-1.5 px-4 py-2 border-b border-border dark:border-line text-[11px] text-muted-foreground bg-muted/20">
          <ChevronLeft className="h-3 w-3" />
          <span>Scroll horizontally for full matrix</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border dark:border-line-strong bg-muted/40 text-muted-foreground">
                <th className="sticky left-0 bg-muted/95 py-3.5 px-4 sm:px-5 font-semibold text-foreground z-10 w-[220px]">
                  Capability
                </th>
                <th className="py-3.5 px-4 sm:px-5 font-bold text-foreground bg-muted/60 border-x border-border dark:border-line-strong text-emerald-600 dark:text-acid">
                  Arbor AST
                </th>
                <th className="py-3.5 px-4 sm:px-5 font-semibold text-muted-foreground">
                  Manual Wikis
                </th>
                <th className="py-3.5 px-4 sm:px-5 font-semibold text-muted-foreground">
                  LLM AI Reviewers
                </th>
                <th className="py-3.5 px-4 sm:px-5 font-semibold text-muted-foreground">
                  CLI Linters
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-line">
              {MATRIX_DATA.map((row, idx) => (
                <tr key={idx} className="group hover:bg-muted/20 transition-colors">
                  <td className="sticky left-0 bg-card group-hover:bg-muted/30 transition-colors py-3.5 px-4 sm:px-5 font-semibold text-foreground z-10 font-sans text-xs">
                    {row.capability}
                  </td>
                  <td className="py-3.5 px-4 sm:px-5 font-medium text-foreground bg-muted/20 border-x border-border dark:border-line-strong text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-600 dark:text-acid font-bold">&#10003;</span>
                      <span className={row.arborHighlight ? 'font-semibold text-foreground' : ''}>
                        {row.arbor}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 sm:px-5 text-muted-foreground text-[11px]">
                    {row.manual}
                  </td>
                  <td className="py-3.5 px-4 sm:px-5 text-muted-foreground text-[11px]">
                    {row.llm}
                  </td>
                  <td className="py-3.5 px-4 sm:px-5 text-muted-foreground text-[11px]">
                    {row.linters}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-3.5 border-t border-border dark:border-line text-[11px] text-muted-foreground bg-muted/10 flex flex-wrap items-center justify-between gap-2">
          <span>Zero third-party code storage · Read-only GitHub OAuth integration</span>
          <span className="font-semibold text-foreground">Deterministic AST v2.1</span>
        </div>
      </div>
    </section>
  )
}