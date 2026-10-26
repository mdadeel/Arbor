import type { CSSProperties } from 'react'
import Image from 'next/image'
import { ArrowRight, Check, Github, GitBranch, ClipboardCheck } from 'lucide-react'

interface ProductRow {
  id?: string
  eyebrow: string
  title: string
  body: string
  points: string[]
  image: string
  alt: string
  accent: string
  /** Paper rows use warm light surfaces; all others stay on the dark canvas. */
  surface?: 'dark' | 'paper'
}

const rows: ProductRow[] = [
  {
    eyebrow: 'Architecture',
    title: 'See the import graph before you change it.',
    body: 'Arbor parses supported JavaScript and TypeScript files to map local imports, then draws the module graph so layers, dependencies, and cycles are visible at a glance.',
    points: [
      'Dependency graph of analyzed module imports',
      'Cycles and oversized files surfaced for review',
      'Module detail with line count and imports',
    ],
    image: '/marketing/architecture.webp',
    alt: 'Import graph of a sample repository with app, router, orders, billing, and database modules, and a highlighted circular import.',
    accent: '#7dd3fc',
  },
  {
    id: 'health',
    eyebrow: 'Health',
    title: 'Six dimensions, one score you can act on.',
    body: 'Each completed analysis scores architecture, tech debt, performance, documentation, security, and design system from 0 to 100, then lists the next actions in priority order.',
    points: [
      'Overall score updates when an analysis completes',
      'Dimension scores show where the work is',
      'Next actions ranked by level',
    ],
    image: '/marketing/health.webp',
    alt: 'Repository health report with an overall score of 83 out of 100 and six dimension bars.',
    accent: '#34d399',
  },
  {
    id: 'findings',
    eyebrow: 'Findings',
    title: 'Every finding shows the evidence behind it.',
    body: 'Each result points to the file, the line, and the rule that produced it. Read the code excerpt, then decide what to change or ask for a patch suggestion.',
    points: [
      'Detection method stated for every finding',
      'Patch suggestions for supported findings',
      'Optional AI explanations with your own provider key',
    ],
    image: '/marketing/findings.webp',
    alt: 'Finding inspector showing a circular import in src/routes/orders.ts with a code excerpt and recommendation.',
    accent: '#f5b84b',
  },
  {
    id: 'security',
    eyebrow: 'Secret & env shield',
    title: 'Catch committed secrets and undocumented variables.',
    body: 'Static pattern checks flag common secret formats. Environment checks compare the variables your code references with your .env.example. Findings store locations, not the matched value.',
    points: [
      'Common committed-secret patterns',
      'Referenced variables compared with .env.example',
      'Matched secret values are not stored in findings',
    ],
    image: '/marketing/secrets.webp',
    alt: 'Secrets and environment review listing redacted matches and environment variables missing from the example file.',
    accent: '#f47c6c',
  },
  {
    eyebrow: 'Living docs',
    title: 'Project notes that stay next to the code.',
    body: 'Write Markdown for architecture notes, APIs, runbooks, and decisions. Version history keeps prior edits, and review dates flag notes that may have gone stale.',
    points: [
      'Version history for every saved edit',
      'Review dates and staleness checks',
      'Notes organized by project',
    ],
    image: '/marketing/docs.webp',
    alt: 'Living docs page for a billing service with a responsibilities list, a code excerpt, and version history.',
    accent: '#e07a45',
    surface: 'paper',
  },
  {
    eyebrow: 'API explorer',
    title: 'Try the API without leaving the workbench.',
    body: 'Import an OpenAPI schema, inspect its endpoints, and send requests through a server-side proxy, so the browser never calls the target API directly.',
    points: [
      'OpenAPI schema import',
      'Requests run through a server-side proxy',
      'Request and response inspection',
    ],
    image: '/marketing/api.webp',
    alt: 'API explorer with an imported schema, a POST request builder, and a 200 OK JSON response.',
    accent: '#38bdf8',
  },
]

function ProductRowSection({ row, reversed }: { row: ProductRow; reversed: boolean }) {
  const paper = row.surface === 'paper'
  const style = { color: row.accent } as CSSProperties
  return (
    <section
      id={row.id}
      className="mx-auto grid max-w-[1400px] scroll-mt-28 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8"
      aria-labelledby={`${row.eyebrow.replace(/\W+/g, '-').toLowerCase()}-heading`}
    >
      <div className={`lg:col-span-7 ${reversed ? 'lg:order-2' : ''}`}>
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] opacity-[0.16] blur-3xl"
            style={{ background: `radial-gradient(closest-side, ${row.accent}, transparent)` }}
            aria-hidden="true"
          />
          <div
            className={`overflow-hidden rounded-2xl border shadow-2xl shadow-black/40 ${paper ? 'border-[#d9cdb4] bg-[#f6f1e7]' : 'border-border bg-background'}`}
          >
            <Image
              src={row.image}
              alt={row.alt}
              width={1280}
              height={800}
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="h-auto w-full"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Illustrative sample data, drawn from the product layout.</p>
        </div>
      </div>

      <div className={`lg:col-span-5 ${reversed ? 'lg:order-1' : ''}`}>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em]" style={style}>
          {row.eyebrow}
        </p>
        <h2
          id={`${row.eyebrow.replace(/\W+/g, '-').toLowerCase()}-heading`}
          className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-4xl"
        >
          {row.title}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground text-pretty">{row.body}</p>
        <ul className="mt-7 divide-y divide-border border-y border-border text-sm text-muted-foreground">
          {row.points.map((point) => (
            <li key={point} className="flex items-start gap-3 py-3.5">
              <Check className="mt-0.5 size-4 shrink-0" style={style} aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function ProductRows() {
  return (
    <div id="features" className="scroll-mt-28 space-y-24 sm:space-y-32">
      {rows.map((row, index) => (
        <ProductRowSection key={row.eyebrow} row={row} reversed={index % 2 === 1} />
      ))}
    </div>
  )
}

const steps = [
  { number: '01', icon: Github, title: 'Connect a repository', body: 'Choose a GitHub repository and review the requested permissions before connecting. No workflow file or local setup is required.' },
  { number: '02', icon: GitBranch, title: 'Map the code', body: 'Arbor parses source structure and import relationships to build an inspectable architecture map.' },
  { number: '03', icon: ClipboardCheck, title: 'Review the evidence', body: 'Open health dimensions and findings with the file paths and checks behind each result.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1400px] scroll-mt-28 px-4 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">How it works</p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-4xl">
            From a repo you own to a map you can inspect.
          </h2>
        </div>
        <ol className="divide-y divide-border border-y border-border lg:col-span-8">
          {steps.map(({ number, icon: Icon, title, body }) => (
            <li key={number} className="grid gap-4 py-7 sm:grid-cols-[72px_1fr_auto] sm:items-start sm:gap-8">
              <span className="font-mono text-sm font-semibold text-muted-foreground">{number}</span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{body}</p>
              </div>
              <Icon className="size-5 text-primary sm:mt-1" aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const commits = [
  { hash: '3f1a9c2', type: 'feat', message: 'custom AST logo' },
  { hash: 'b74de12', type: 'feat', message: 'dynamic shields badge' },
  { hash: 'a08c3ff', type: 'fix', message: 'PAT token refresh window' },
  { hash: '9d2e410', type: 'chore', message: 'bump lint configuration' },
]

const activity = [38, 52, 41, 66, 58, 74, 61, 88, 70, 92, 84, 96]

/** Gapless bento: tiles share borders and fill holes with grid-flow-dense. */
export function WorkbenchBento() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8" aria-labelledby="workbench-heading">
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">Developer workbench</p>
        <h2 id="workbench-heading" className="mt-4 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-4xl">
          Built like a workbench, not a generic dashboard.
        </h2>
      </div>

      <div className="mt-12 grid grid-flow-dense grid-cols-1 overflow-hidden rounded-2xl border border-border md:grid-cols-3">
        <div className="flex flex-col justify-between gap-8 border-b border-border p-7 sm:p-9 md:col-span-2">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#a3e635]">Commit pulse</p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">Conventional commits, summarized</h3>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Recent commit activity grouped by Conventional Commit type. Sample data.</p>
          </div>
          <div className="flex items-end gap-6">
            <div className="flex h-24 flex-1 items-end gap-1.5" aria-hidden="true">
              {activity.map((value, index) => (
                <span key={index} className="flex-1 rounded-sm bg-[#a3e635]/70" style={{ height: `${value}%` }} />
              ))}
            </div>
          </div>
          <ul className="divide-y divide-border border-t border-border font-mono text-sm">
            {commits.map((commit) => (
              <li key={commit.hash} className="grid grid-cols-[90px_64px_1fr] gap-4 py-3">
                <span className="text-muted-foreground">{commit.hash}</span>
                <span className={commit.type === 'fix' ? 'text-[#f5b84b]' : 'text-[#a3e635]'}>{commit.type}</span>
                <span className="truncate text-foreground">{commit.message}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col border-b border-border md:row-span-2 md:border-b-0 md:border-l">
          <div className="p-7 sm:p-9">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#34d399]">README badges</p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">Show the score where people look</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Copy a badge that updates after each completed audit of a public repository.</p>
          </div>
          <div className="mt-auto border-t border-border">
            <Image src="/marketing/readme.webp" alt="README preview showing the Arbor Audit badge with a score of 83 out of 100 and its Markdown snippet." width={1280} height={800} sizes="(min-width: 768px) 33vw, 100vw" className="h-auto w-full" />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 border-b border-border p-7 sm:p-9 md:border-b-0">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]">Share a report</p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">Send a report, then take the link back</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Shared report links can be revoked at any time, so access ends when you decide.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 font-mono text-xs text-muted-foreground">
            Revoke link <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>

        <div className="flex flex-col justify-between gap-6 border-b border-border p-7 sm:p-9 md:border-b-0 md:border-l">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#f47c6c]">Private by default</p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">Private repositories stay out of public surfaces</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Private repositories do not get public badges. Shared links are created on purpose and can be revoked.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
