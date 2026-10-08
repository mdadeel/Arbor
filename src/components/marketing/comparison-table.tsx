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
    capability: 'Source Code Handling',
    arbor: 'Temporary analysis copy removed after processing',
    arborHighlight: true,
    manual: 'Depends on the documentation tool',
    llm: 'Depends on the provider and configuration',
    linters: 'Depends on local or CI setup',
  },
  {
    capability: 'Analysis Latency',
    arbor: 'Typically about 30s; varies by repository',
    arborHighlight: true,
    manual: 'Varies by project and reviewer',
    llm: 'Varies by model, prompt, and context',
    linters: 'Local execution; ruleset-dependent',
  },
  {
    capability: 'Interactive Dependency Graph',
    arbor: 'Interactive dependency graph',
    arborHighlight: true,
    manual: 'Static outdated PNG/SVG exports',
    llm: 'None',
    linters: 'None',
  },
  {
    capability: 'Repeatability',
    arbor: 'Same source and rules produce the same structural checks',
    arborHighlight: true,
    manual: 'Depends on reviewer and documentation age',
    llm: 'Depends on model, prompt, and available context',
    linters: 'Depends on configured rules',
  },
  {
    capability: 'Setup & Configuration',
    arbor: 'Connect GitHub and choose a repository',
    manual: 'Create and maintain a map',
    llm: 'Configure prompts and provider access',
    linters: 'Configure a ruleset',
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
          <span>Temporary analysis copy removed after processing · Review GitHub permissions first</span>
          <span className="font-semibold text-foreground">Deterministic AST v2.1</span>
        </div>
      </div>
    </section>
  )
}