'use client'

import { Check, ChevronLeft, X } from 'lucide-react'

export function ComparisonTable() {
  const criteria = [
    {
      feature: 'Analysis Speed',
      arbor: '< 30 seconds',
      manual: 'Days / Weeks',
      aiTools: '2-5 minutes (slow tokens)',
      linters: 'Instant (surface only)',
    },
    {
      feature: 'Accuracy & Determinism',
      arbor: '100% AST deterministic',
      manual: 'Prone to human drift',
      aiTools: 'Hallucination risk',
      linters: 'Rule-based syntax only',
    },
    {
      feature: 'Interactive Dependency Graph',
      arbor: true,
      manual: false,
      aiTools: false,
      linters: false,
    },
    {
      feature: 'Zero Source Code Stored',
      arbor: true,
      manual: 'Stored in doc tools',
      aiTools: 'Sent to LLM clouds',
      linters: true,
    },
    {
      feature: 'Dynamic SVG README Badges',
      arbor: true,
      manual: false,
      aiTools: false,
      linters: false,
    },
    {
      feature: 'Commit Velocity & Conventional Recency',
      arbor: true,
      manual: false,
      aiTools: false,
      linters: false,
    },
    {
      feature: 'Setup Effort',
      arbor: 'Zero (1-click GitHub OAuth)',
      manual: 'Heavy manual authoring',
      aiTools: 'API key & prompts required',
      linters: 'Config files (.eslintrc, etc.)',
    },
  ]

  const cell = (value: boolean | string) =>
    typeof value === 'boolean'
      ? value ? (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <Check className="h-4 w-4" />
            <span>Included</span>
          </div>
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40" />
        )
      : (
        <span className="text-muted-foreground">{value}</span>
      )

  return (
    <section id="comparison" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-display">
          Arbor vs Traditional Tools
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Deterministic codebase intelligence without the maintenance tax of manual
          documentation or the hallucinations of black-box AI.
        </p>
      </div>

      <div className="relative rounded-2xl border border-border bg-card shadow-md">
        {/* Mobile swipe hint */}
        <div className="sm:hidden flex items-center gap-1.5 px-5 pt-3 pb-1 text-[11px] text-muted-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Scroll horizontally to compare
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="sticky left-0 bg-muted py-4 px-5 sm:px-6 font-semibold text-foreground z-10">
                  Capability
                </th>
                <th className="py-4 px-5 sm:px-6 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.07] border-x border-emerald-500/40 shadow-[inset_0_0_24px_-12px_rgba(16,185,129,0.35)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Arbor AST
                  </span>
                </th>
                <th className="py-4 px-5 sm:px-6 font-semibold text-muted-foreground">Manual Wikis (Notion/Confluence)</th>
                <th className="py-4 px-5 sm:px-6 font-semibold text-muted-foreground">LLM AI Code Reviewers</th>
                <th className="py-4 px-5 sm:px-6 font-semibold text-muted-foreground">CLI Linters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {criteria.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/15 transition-colors">
                  <td className="sticky left-0 bg-card py-3.5 px-5 sm:px-6 font-medium text-foreground z-10">
                    {item.feature}
                  </td>
                  <td className="py-3.5 px-5 sm:px-6 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.07] border-x border-emerald-500/40">
                    {cell(item.arbor)}
                  </td>
                  <td className="py-3.5 px-5 sm:px-6">{cell(item.manual)}</td>
                  <td className="py-3.5 px-5 sm:px-6">{cell(item.aiTools)}</td>
                  <td className="py-3.5 px-5 sm:px-6">{cell(item.linters)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}