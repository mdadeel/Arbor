/**
 * Product screens used on the marketing site.
 *
 * Each screen is a fixed 1280x800 composition built from Arbor's real layout
 * language (sidebar, report panels, dependency canvas, finding inspector) and
 * illustrative sample data. They are rendered by the dev-only /showcase route
 * and captured to static images in public/marketing/ with a headless browser,
 * so the marketing page shows crisp, reproducible product imagery instead of
 * depending on a live database. Every screen is labelled as sample data.
 *
 * Palette values mirror the dark tokens in src/app/globals.css.
 */
import type { ReactNode } from 'react'
import {
  Activity,
  BookOpen,
  GitBranch,
  LayoutGrid,
  Network,
  Settings,
  ShieldAlert,
  Terminal,
} from 'lucide-react'

export const SCREEN_NAMES = [
  'dashboard',
  'architecture',
  'health',
  'findings',
  'secrets',
  'docs',
  'api',
  'readme',
  'chip-score',
  'chip-finding',
] as const

export type ScreenName = (typeof SCREEN_NAMES)[number]

const INK = {
  bg: '#0b0f0c',
  panel: '#0f1511',
  raised: '#151d17',
  line: '#26322a',
  lineSoft: '#1b241e',
  fg: '#edf4ee',
  muted: '#9aa69e',
  dim: '#66736b',
  acid: '#b7ed69',
  emerald: '#34d399',
  amber: '#f5b84b',
  red: '#f47c6c',
  sky: '#7dd3fc',
  violet: '#c4b5fd',
}

function scoreColor(score: number) {
  if (score >= 80) return INK.emerald
  if (score >= 60) return INK.amber
  return INK.red
}

function Spark({ values, color, width = 120, height = 32 }: { values: number[]; color: string; width?: number; height?: number }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK.acid} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M12 9l6-4" />
      <path d="M12 14l-6-4" />
      <path d="M12 17l6-3" />
    </svg>
  )
}

const NAV = [
  { label: 'Projects', icon: LayoutGrid },
  { label: 'Architecture', icon: Network },
  { label: 'Health', icon: Activity },
  { label: 'Findings', icon: ShieldAlert },
  { label: 'Docs', icon: BookOpen },
  { label: 'API', icon: Terminal },
  { label: 'Settings', icon: Settings },
]

/** Dark application window: top bar, sidebar, and content area. */
function AppWindow({ active, status, children }: { active: string; status: string; children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-[13px]" style={{ background: INK.bg, color: INK.fg }}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: INK.line, background: INK.panel }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full" style={{ background: '#f47c6c99' }} />
            <span className="size-2.5 rounded-full" style={{ background: '#f5b84b99' }} />
            <span className="size-2.5 rounded-full" style={{ background: '#34d39999' }} />
          </div>
          <span className="mx-1 h-4 w-px" style={{ background: INK.line }} />
          <div className="flex items-center gap-2 font-mono text-[12px]" style={{ color: INK.muted }}>
            <GitBranch className="size-3.5" aria-hidden="true" />
            <span style={{ color: INK.fg }}>arbor / sample-api</span>
            <span>· main</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: INK.line, color: INK.muted }}>
          <span className="size-1.5 rounded-full" style={{ background: INK.emerald }} />
          {status}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-52 shrink-0 flex-col gap-1 border-r p-4" style={{ borderColor: INK.line, background: INK.panel }}>
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">Arbor</span>
          </div>
          {NAV.map(({ label, icon: Icon }) => {
            const isActive = label === active
            return (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]"
                style={{ background: isActive ? '#1d2a20' : 'transparent', color: isActive ? INK.fg : INK.muted }}
              >
                <Icon className="size-4" aria-hidden="true" style={{ color: isActive ? INK.acid : undefined }} />
                {label}
              </div>
            )
          })}
          <p className="mt-auto px-2 text-[11px] leading-relaxed" style={{ color: INK.dim }}>
            Sample data for illustration.
          </p>
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden p-8">{children}</main>
      </div>
    </div>
  )
}

function Dashboard() {
  const projects = [
    { name: 'arbor / sample-api', stack: 'Next.js · Prisma', score: 83, trend: [71, 74, 76, 79, 80, 82, 83], findings: 4, when: '3 min ago', active: true },
    { name: 'billing-service', stack: 'TypeScript · Express', score: 71, trend: [64, 66, 70, 69, 71, 70, 71], findings: 9, when: '1 h ago', active: false },
    { name: 'web-dashboard', stack: 'React · Vite', score: 92, trend: [88, 90, 89, 91, 92, 91, 92], findings: 1, when: '2 h ago', active: false },
    { name: 'mobile-api', stack: 'Go · Python', score: 58, trend: [66, 63, 61, 60, 59, 58, 58], findings: 14, when: 'Yesterday', active: false },
    { name: 'docs-site', stack: 'Astro · MDX', score: 88, trend: [84, 85, 86, 85, 87, 88, 88], findings: 2, when: '2 days ago', active: false },
  ]
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[26px] font-semibold tracking-tight">Projects</h2>
          <p className="mt-1" style={{ color: INK.muted }}>5 repositories · 2 audits running · 1 critical finding</p>
        </div>
        <div className="rounded-lg px-3.5 py-2 text-[12px] font-semibold" style={{ background: INK.acid, color: '#11170f' }}>
          Analyze repository
        </div>
      </div>
      <div className="flex-none overflow-hidden rounded-xl border" style={{ borderColor: INK.line }}>
        <div className="grid grid-cols-[2.2fr_1.3fr_1.6fr_1fr_1.2fr_0.9fr] gap-4 border-b px-5 py-3 text-[11px] font-medium uppercase tracking-wider" style={{ borderColor: INK.line, color: INK.dim }}>
          <span>Project</span>
          <span>Stack</span>
          <span>Health</span>
          <span>Trend</span>
          <span>Last audit</span>
          <span className="text-right">Findings</span>
        </div>
        {projects.map((p) => (
          <div
            key={p.name}
            className="grid grid-cols-[2.2fr_1.3fr_1.6fr_1fr_1.2fr_0.9fr] items-center gap-4 border-b px-5 py-4 last:border-b-0"
            style={{ borderColor: INK.lineSoft, background: p.active ? '#131c15' : 'transparent' }}
          >
            <span className="flex items-center gap-2.5 font-mono text-[13px]">
              <span className="size-2 rounded-full" style={{ background: scoreColor(p.score) }} />
              {p.name}
            </span>
            <span style={{ color: INK.muted }}>{p.stack}</span>
            <span className="flex items-center gap-3">
              <span className="w-8 font-mono font-semibold tabular-nums">{p.score}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: INK.lineSoft }}>
                <span className="block h-full rounded-full" style={{ width: `${p.score}%`, background: scoreColor(p.score) }} />
              </span>
            </span>
            <Spark values={p.trend} color={scoreColor(p.score)} width={96} height={28} />
            <span style={{ color: INK.muted }}>{p.when}</span>
            <span className="text-right font-mono tabular-nums">{p.findings}</span>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <p className="mb-4 text-[11px] uppercase tracking-wider" style={{ color: INK.dim }}>Recent activity</p>
        {[
          ['Audit completed', 'arbor / sample-api', 'Score 83, up 3 since last run', INK.emerald],
          ['Circular import found', 'billing-service', 'orders.ts ↔ billing.ts', INK.amber],
          ['Patch suggestion ready', 'mobile-api', 'Adds missing auth guard to 2 routes', INK.sky],
          ['Badge published', 'docs-site', 'README badge now shows 88', INK.acid],
        ].map(([title, project, detail, color]) => (
          <div key={title} className="grid grid-cols-[14px_1.4fr_1fr_1.6fr] items-center gap-4 border-b py-3.5 text-[13px] last:border-b-0" style={{ borderColor: INK.lineSoft }}>
            <span className="size-2 rounded-full" style={{ background: color }} />
            <span>{title}</span>
            <span className="font-mono text-[12px]" style={{ color: INK.muted }}>{project}</span>
            <span style={{ color: INK.dim }}>{detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MODULES = {
  'app.ts': { x: 110, y: 300, layer: 'Application entry', color: INK.acid },
  'router.ts': { x: 370, y: 130, layer: 'Route dispatch', color: INK.sky },
  'auth.ts': { x: 630, y: 130, layer: 'Authentication', color: INK.sky },
  'orders.ts': { x: 370, y: 300, layer: 'Route handler', color: INK.sky },
  'billing.ts': { x: 630, y: 300, layer: 'Billing service', color: INK.violet },
  'db.ts': { x: 370, y: 470, layer: 'Persistence', color: INK.emerald },
  'audit.ts': { x: 630, y: 470, layer: 'AST analysis', color: INK.violet },
} as const

type ModuleName = keyof typeof MODULES

function Architecture() {
  const W = 168
  const H = 64
  const edges: Array<{ from: ModuleName; to: ModuleName; dy?: number; cycle?: boolean }> = [
    { from: 'app.ts', to: 'router.ts' },
    { from: 'router.ts', to: 'auth.ts' },
    { from: 'router.ts', to: 'orders.ts' },
    { from: 'orders.ts', to: 'billing.ts', dy: -9 },
    { from: 'billing.ts', to: 'orders.ts', dy: 9, cycle: true },
    { from: 'billing.ts', to: 'audit.ts' },
    { from: 'orders.ts', to: 'db.ts' },
    { from: 'audit.ts', to: 'db.ts' },
    { from: 'auth.ts', to: 'db.ts' },
  ]
  const center = (m: ModuleName) => ({ x: MODULES[m].x, y: MODULES[m].y })
  return (
    <div className="flex h-full gap-6">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border" style={{ borderColor: INK.line, background: INK.panel }}>
        <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(#22302a 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="absolute left-5 top-4 flex items-center gap-4 text-[11px]" style={{ color: INK.muted }}>
          <span className="font-semibold" style={{ color: INK.fg }}>Import graph</span>
          <span>18 modules</span>
          <span>42 edges</span>
          <span style={{ color: INK.amber }}>1 cycle</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative aspect-[4/3] h-full max-w-full">
        <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#4b5a50" />
            </marker>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill={INK.amber} />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = center(e.from)
            const b = center(e.to)
            const dy = e.dy ?? 0
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={a.x + 20 * Math.sign(b.x - a.x)}
                y1={a.y + dy}
                x2={b.x - 20 * Math.sign(b.x - a.x)}
                y2={b.y + dy}
                stroke={e.cycle ? INK.amber : '#4b5a50'}
                strokeWidth={e.cycle ? 2 : 1.5}
                strokeDasharray={e.cycle ? '6 5' : undefined}
                markerEnd={e.cycle ? 'url(#arrow-amber)' : 'url(#arrow)'}
              />
            )
          })}
        </svg>
        {(Object.keys(MODULES) as ModuleName[]).map((name) => {
          const m = MODULES[name]
          const selected = name === 'orders.ts'
          return (
            <div
              key={name}
              className="absolute rounded-lg border px-3.5 py-2.5"
              style={{
                left: `${(m.x - W / 2) / 8}%`,
                top: `${((m.y - H / 2) / 600) * 100}%`,
                width: `${(W / 800) * 100}%`,
                background: selected ? '#1a2a1d' : INK.raised,
                borderColor: selected ? INK.acid : INK.line,
                boxShadow: selected ? `0 0 0 3px ${INK.acid}33` : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: m.color }} />
                <span className="font-mono text-[12.5px] font-semibold">{name}</span>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: INK.dim }}>{m.layer}</div>
            </div>
          )
        })}
        </div>
        </div>
      </div>
      <aside className="flex w-72 shrink-0 flex-col gap-6 border-l pl-6" style={{ borderColor: INK.line }}>
        <div>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: INK.dim }}>Selected module</p>
          <h3 className="mt-2 font-mono text-[20px] font-semibold">orders.ts</h3>
          <p className="mt-1 font-mono text-[12px]" style={{ color: INK.muted }}>src/routes/orders.ts</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-[12px]">
          {[
            ['Lines', '182'],
            ['Imports', '3'],
            ['Used by', '2'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt style={{ color: INK.dim }}>{k}</dt>
              <dd className="mt-1 font-mono text-[18px] font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-wider" style={{ color: INK.dim }}>Imports</p>
          {['billing.ts', 'db.ts', 'validation.ts'].map((f) => (
            <div key={f} className="flex items-center justify-between border-b py-2.5 font-mono text-[12.5px]" style={{ borderColor: INK.lineSoft }}>
              {f}
              {f === 'billing.ts' && <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: '#3a2c12', color: INK.amber }}>cycle</span>}
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: '#5a4618', background: '#1f1a0e' }}>
          <p className="text-[12px] font-semibold" style={{ color: INK.amber }}>Circular import detected</p>
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: INK.muted }}>orders → billing → orders. Break the cycle by moving the shared function into its own module.</p>
        </div>
      </aside>
    </div>
  )
}

function Health() {
  const dims = [
    ['Architecture', 91],
    ['Tech debt', 78],
    ['Performance', 88],
    ['Documentation', 63],
    ['Security', 96],
    ['Design system', 84],
  ] as const
  const r = 92
  const circ = 2 * Math.PI * r
  return (
    <div className="flex h-full flex-col gap-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[26px] font-semibold tracking-tight">Repository health</h2>
          <p className="mt-1" style={{ color: INK.muted }}>Analysis completed 3 minutes ago · main @ 3f1a9c2</p>
        </div>
        <Spark values={[71, 74, 76, 79, 80, 82, 83]} color={INK.emerald} width={180} height={44} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-12">
        <div className="flex flex-col items-center justify-center gap-5">
          <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r={r} fill="none" stroke={INK.lineSoft} strokeWidth="16" />
            <circle
              cx="130"
              cy="130"
              r={r}
              fill="none"
              stroke={INK.emerald}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${circ * 0.83} ${circ}`}
              transform="rotate(-90 130 130)"
            />
            <text x="130" y="134" textAnchor="middle" fill={INK.fg} fontSize="64" fontWeight="600" fontFamily="var(--font-geist-mono), monospace">83</text>
            <text x="130" y="166" textAnchor="middle" fill={INK.dim} fontSize="16" fontFamily="var(--font-geist-sans), sans-serif">out of 100</text>
          </svg>
          <p className="text-center text-[13px]" style={{ color: INK.muted }}>Overall score, weighted across six dimensions</p>
        </div>
        <div className="flex flex-col justify-center gap-7">
          <div className="space-y-5">
            {dims.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[170px_1fr_44px] items-center gap-5">
                <span className="text-[14px]">{label}</span>
                <span className="h-2.5 overflow-hidden rounded-full" style={{ background: INK.lineSoft }}>
                  <span className="block h-full rounded-full" style={{ width: `${value}%`, background: scoreColor(value) }} />
                </span>
                <span className="text-right font-mono text-[14px] font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-6" style={{ borderColor: INK.line }}>
            <p className="mb-4 text-[11px] uppercase tracking-wider" style={{ color: INK.dim }}>Next actions</p>
            {[
              ['Break the orders ↔ billing cycle', 'Architecture', 'High'],
              ['Document five undocumented environment variables', 'Documentation', 'Medium'],
              ['Split audit.ts, which is 310 lines', 'Tech debt', 'Review'],
            ].map(([title, area, level], i) => (
              <div key={title} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b py-3.5 text-[13.5px] last:border-b-0" style={{ borderColor: INK.lineSoft }}>
                <span className="font-mono text-[12px]" style={{ color: INK.dim }}>0{i + 1}</span>
                <span>
                  {title}
                  <span className="ml-2.5 text-[12px]" style={{ color: INK.dim }}>{area}</span>
                </span>
                <span className="font-mono text-[11.5px]" style={{ color: level === 'High' ? INK.amber : INK.muted }}>{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Findings() {
  const items = [
    { title: 'Circular import: orders ↔ billing', file: 'src/routes/orders.ts', sev: 'High', color: INK.amber },
    { title: 'Admin procedure has no guard', file: 'src/server/admin.ts', sev: 'Critical', color: INK.red },
    { title: 'Large source file', file: 'src/server/services/audit.ts', sev: 'Review', color: INK.sky },
    { title: 'Variable missing from .env.example', file: 'src/lib/billing.ts', sev: 'Low', color: INK.muted },
  ]
  return (
    <div className="flex h-full gap-0">
      <div className="w-[330px] shrink-0 border-r pr-6" style={{ borderColor: INK.line }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-tight">Findings</h2>
          <span className="font-mono text-[12px]" style={{ color: INK.muted }}>4 open</span>
        </div>
        {items.map((it, i) => (
          <div key={it.title} className="border-b py-4" style={{ borderColor: INK.lineSoft, background: i === 0 ? '#131c15' : 'transparent', marginLeft: i === 0 ? -12 : 0, paddingLeft: i === 0 ? 12 : 0 }}>
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full" style={{ background: it.color }} />
              <span className="text-[13.5px] font-medium">{it.title}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between pl-[18px] font-mono text-[11.5px]" style={{ color: INK.dim }}>
              <span className="truncate">{it.file}</span>
              <span style={{ color: it.color }}>{it.sev}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 pl-10">
        <p className="text-[12px] font-mono" style={{ color: INK.amber }}>High · Architecture</p>
        <h3 className="mt-2 text-[24px] font-semibold tracking-tight">A circular import crosses two modules</h3>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]" style={{ color: INK.muted }}>
          <span className="font-mono">src/routes/orders.ts:1</span>
          <span>Mechanism: resolved AST import graph</span>
          <span>Rule: cyclic-import</span>
        </div>
        <div className="mt-7 overflow-hidden rounded-xl border font-mono text-[13px] leading-7" style={{ borderColor: INK.line, background: INK.panel }}>
          {[
            ['1', 'import { invoiceFor } from "../billing/invoices"', true],
            ['2', 'export const ordersRouter = createRouter({', false],
            ['3', '  invoice: () => invoiceFor(orderId),', false],
            ['4', '})', false],
            ['5', '// billing/invoices.ts imports ordersRouter', false],
          ].map(([n, code, hot]) => (
            <div key={String(n)} className="flex gap-5 px-5" style={{ background: hot ? '#2a2110' : 'transparent' }}>
              <span className="w-4 text-right" style={{ color: INK.dim }}>{n}</span>
              <span style={{ color: hot ? INK.fg : INK.muted }}>{code}</span>
            </div>
          ))}
        </div>
        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed" style={{ color: INK.muted }}>
          The import path closes a cycle: orders → billing → orders. Cycles make modules hard to test and reorder.
        </p>
        <div className="mt-6 border-l-2 pl-5" style={{ borderColor: INK.acid }}>
          <p className="text-[12px] uppercase tracking-wider" style={{ color: INK.dim }}>Recommendation</p>
          <p className="mt-1.5 text-[14px] leading-relaxed">Move invoiceFor into a shared module that neither route imports.</p>
        </div>
        <div className="mt-8 flex gap-3">
          <span className="rounded-lg border px-4 py-2 text-[12.5px] font-medium" style={{ borderColor: INK.line }}>Mark as triaged</span>
          <span className="rounded-lg px-4 py-2 text-[12.5px] font-semibold" style={{ background: INK.acid, color: '#11170f' }}>Suggest patch</span>
        </div>
      </div>
    </div>
  )
}

function Secrets() {
  const env = [
    ['DATABASE_URL', 'documented', INK.emerald],
    ['REDIS_URL', 'documented', INK.emerald],
    ['NEXT_PUBLIC_APP_URL', 'documented', INK.emerald],
    ['STRIPE_SECRET_KEY', 'missing from example', INK.red],
    ['SENTRY_DSN', 'missing from example', INK.amber],
  ] as const
  return (
    <div className="flex h-full flex-col gap-8">
      <div>
        <h2 className="text-[26px] font-semibold tracking-tight">Secrets and environment</h2>
        <p className="mt-1" style={{ color: INK.muted }}>Static pattern checks and .env.example comparison · values are never stored</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-12">
        <div>
          <p className="mb-4 text-[11px] uppercase tracking-wider" style={{ color: INK.dim }}>Committed secrets</p>
          <div className="border-t" style={{ borderColor: INK.line }}>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b py-4 text-[13.5px]" style={{ borderColor: INK.lineSoft }}>
              <span className="font-mono">src/config.ts:14</span>
              <span style={{ color: INK.muted }}>Credential-like assignment</span>
              <span className="font-mono text-[12px]" style={{ color: INK.red }}>Redacted</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b py-4 text-[13.5px]" style={{ borderColor: INK.lineSoft }}>
              <span className="font-mono">scripts/seed.ts:3</span>
              <span style={{ color: INK.muted }}>Private key header</span>
              <span className="font-mono text-[12px]" style={{ color: INK.red }}>Redacted</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b py-4 text-[13.5px]" style={{ borderColor: INK.lineSoft }}>
              <span className="font-mono">src/app/api/hooks/route.ts</span>
              <span style={{ color: INK.muted }}>No secret patterns found</span>
              <span className="font-mono text-[12px]" style={{ color: INK.emerald }}>Clear</span>
            </div>
          </div>
          <p className="mt-6 max-w-md text-[13px] leading-relaxed" style={{ color: INK.muted }}>
            Findings store the file, line, and rule that matched. The matched value is replaced before it is saved.
          </p>
        </div>
        <div>
          <p className="mb-4 text-[11px] uppercase tracking-wider" style={{ color: INK.dim }}>Environment variables · 14 referenced</p>
          <div className="border-t" style={{ borderColor: INK.line }}>
            {env.map(([key, state, color]) => (
              <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b py-3.5 text-[13.5px]" style={{ borderColor: INK.lineSoft }}>
                <span className="flex items-center gap-3 font-mono">
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  {key}
                </span>
                <span className="text-[12.5px]" style={{ color }}>{state}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-mono text-[40px] font-semibold tabular-nums" style={{ color: INK.amber }}>2</span>
            <span className="text-[13px]" style={{ color: INK.muted }}>variables need documentation in .env.example</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Docs() {
  const paper = '#f6f1e7'
  const ink = '#211d17'
  const soft = '#6f675a'
  const rule = '#e2d9c7'
  const rust = '#b4532a'
  const tree = [
    ['Architecture', true],
    ['Overview', false],
    ['Billing service', false],
    ['Order lifecycle', false],
    ['APIs', true],
    ['Runbooks', true],
    ['Decisions', true],
  ] as const
  return (
    <div className="flex h-full overflow-hidden text-[13px]" style={{ background: paper, color: ink }}>
      <aside className="w-60 shrink-0 border-r p-6" style={{ borderColor: rule }}>
        <p className="mb-5 font-semibold tracking-tight text-[15px]">Living docs</p>
        {tree.map(([label, isGroup]) => (
          <div
            key={label}
            className="py-1.5"
            style={{ paddingLeft: isGroup ? 0 : 14, color: isGroup ? ink : soft, fontWeight: isGroup ? 600 : 400, background: label === 'Billing service' ? '#ece4d2' : 'transparent', borderRadius: 6 }}
          >
            {label}
          </div>
        ))}
      </aside>
      <article className="min-w-0 flex-1 px-12 py-10">
        <div className="flex items-center gap-3 text-[12px]" style={{ color: soft }}>
          <span>Architecture</span>
          <span>/</span>
          <span style={{ color: ink }}>Billing service</span>
          <span className="ml-auto rounded px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#f3dcc9', color: rust }}>Review due Nov 2</span>
        </div>
        <h2 className="mt-6 font-serif text-[40px] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-geist-sans), sans-serif', fontWeight: 600 }}>Billing service</h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: soft }}>
          Owns invoices, refunds, and the handoff to the payment provider. It is called from the order routes and writes audit records for every state change.
        </p>
        <h3 className="mt-8 text-[18px] font-semibold">Responsibilities</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed">
          <li>Create and void invoices for a given order</li>
          <li>Process refunds through the payment adapter</li>
          <li>Emit an audit event for each state change</li>
        </ul>
        <h3 className="mt-8 text-[18px] font-semibold">Entry point</h3>
        <pre className="mt-3 overflow-hidden rounded-lg border p-4 font-mono text-[12.5px] leading-6" style={{ borderColor: rule, background: '#efe7d6' }}>
          {'export async function invoiceFor(orderId: string) {\n  return db.invoice.findFirst({ where: { orderId } })\n}'}
        </pre>
        <p className="mt-6 text-[13px]" style={{ color: soft }}>Last edited by Mira Chen · 2 hours ago</p>
      </article>
      <aside className="w-72 shrink-0 border-l p-6" style={{ borderColor: rule }}>
        <p className="mb-5 text-[12px] font-semibold uppercase tracking-wider" style={{ color: soft }}>Version history</p>
        {[
          ['v12', 'Clarify refund flow', '2 hours ago', true],
          ['v11', 'Add webhook retries', '3 days ago', false],
          ['v10', 'Split invoice states', '1 week ago', false],
          ['v9', 'Initial billing notes', '3 weeks ago', false],
        ].map(([v, t, when, current]) => (
          <div key={String(v)} className="relative border-l pb-7 pl-6" style={{ borderColor: rule }}>
            <span className="absolute -left-[5px] top-1 size-2.5 rounded-full" style={{ background: current ? rust : rule }} />
            <p className="font-mono text-[12px] font-semibold">{v}</p>
            <p className="mt-1 text-[13.5px]">{t}</p>
            <p className="mt-0.5 text-[12px]" style={{ color: soft }}>{when}</p>
          </div>
        ))}
      </aside>
    </div>
  )
}

function Api() {
  const K = '#7dd3fc'
  const S = '#86efac'
  const N = '#fbbf24'
  const P = '#94a3b8'
  const endpoints = [
    ['GET', '/orders'],
    ['POST', '/orders/{orderId}/invoice'],
    ['GET', '/webhooks/payments'],
    ['POST', '/refunds'],
  ] as const
  return (
    <div className="flex h-full overflow-hidden text-[13px]" style={{ background: '#0a1020', color: '#e2e8f0' }}>
      <aside className="w-72 shrink-0 border-r p-6" style={{ borderColor: '#1e293b' }}>
        <p className="mb-1 text-[12px] font-semibold" style={{ color: '#e2e8f0' }}>sample-api.yaml</p>
        <p className="mb-5 font-mono text-[11px]" style={{ color: '#64748b' }}>OpenAPI 3.1 · 4 endpoints</p>
        {endpoints.map(([method, path], i) => (
          <div key={path} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: i === 1 ? '#111c33' : 'transparent' }}>
            <span className="w-11 font-mono text-[11px] font-semibold" style={{ color: method === 'GET' ? '#4ade80' : '#38bdf8' }}>{method}</span>
            <span className="truncate font-mono text-[12px]" style={{ color: '#cbd5e1' }}>{path}</span>
          </div>
        ))}
      </aside>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-0">
        <div className="border-r p-8" style={{ borderColor: '#1e293b' }}>
          <div className="flex items-center gap-3">
            <span className="rounded px-2 py-1 font-mono text-[12px] font-semibold" style={{ background: '#0c2a3d', color: '#38bdf8' }}>POST</span>
            <span className="font-mono text-[13px]" style={{ color: '#e2e8f0' }}>/orders/{'{orderId}'}/invoice</span>
          </div>
          <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Headers</p>
          <div className="space-y-2 font-mono text-[12.5px]">
            <div><span style={{ color: K }}>Content-Type</span>: <span style={{ color: S }}>application/json</span></div>
            <div><span style={{ color: K }}>Authorization</span>: <span style={{ color: '#64748b' }}>Bearer •••</span></div>
          </div>
          <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Path parameters</p>
          <pre className="rounded-lg border p-4 font-mono text-[12.5px] leading-6" style={{ borderColor: '#1e293b', background: '#0f172a' }}>
            <span style={{ color: P }}>{'{'}</span>
            {'\n  '}
            <span style={{ color: K }}>&quot;orderId&quot;</span>
            <span style={{ color: P }}>: </span>
            <span style={{ color: S }}>&quot;ord_2fK9&quot;</span>
            {'\n'}
            <span style={{ color: P }}>{'}'}</span>
          </pre>
          <div className="mt-8 inline-flex rounded-lg px-4 py-2.5 font-semibold" style={{ background: '#38bdf8', color: '#0a1020' }}>Send request</div>
        </div>
        <div className="p-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[12.5px] font-semibold" style={{ color: '#4ade80' }}>200 OK</span>
            <span className="font-mono text-[12px]" style={{ color: '#64748b' }}>142 ms · application/json</span>
          </div>
          <pre className="mt-6 rounded-lg border p-5 font-mono text-[12.5px] leading-6" style={{ borderColor: '#1e293b', background: '#0f172a' }}>
            <span style={{ color: P }}>{'{'}</span>
            {'\n  '}
            <span style={{ color: K }}>&quot;invoiceId&quot;</span>
            <span style={{ color: P }}>: </span>
            <span style={{ color: S }}>&quot;inv_8Qd2&quot;</span>
            <span style={{ color: P }}>,</span>
            {'\n  '}
            <span style={{ color: K }}>&quot;total&quot;</span>
            <span style={{ color: P }}>: </span>
            <span style={{ color: N }}>8400</span>
            <span style={{ color: P }}>,</span>
            {'\n  '}
            <span style={{ color: K }}>&quot;currency&quot;</span>
            <span style={{ color: P }}>: </span>
            <span style={{ color: S }}>&quot;USD&quot;</span>
            <span style={{ color: P }}>,</span>
            {'\n  '}
            <span style={{ color: K }}>&quot;paid&quot;</span>
            <span style={{ color: P }}>: </span>
            <span style={{ color: '#f472b6' }}>false</span>
            {'\n'}
            <span style={{ color: P }}>{'}'}</span>
          </pre>
          <p className="mt-6 text-[12.5px] leading-relaxed" style={{ color: '#94a3b8' }}>
            Requests run through a server-side proxy, so the browser never calls the target API directly.
          </p>
        </div>
      </div>
    </div>
  )
}

function Readme() {
  const gh = { bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', line: '#30363d', code: '#161b22' }
  return (
    <div className="flex h-full flex-col overflow-hidden text-[14px]" style={{ background: gh.bg, color: gh.fg }}>
      <div className="flex h-12 items-center gap-3 border-b px-6 text-[13px]" style={{ borderColor: gh.line, background: '#161b22' }}>
        <span className="font-semibold">arbor-team</span>
        <span style={{ color: gh.muted }}>/</span>
        <span className="font-semibold">sample-api</span>
      </div>
      <div className="flex-1 p-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="border-b pb-3 text-[32px] font-semibold" style={{ borderColor: gh.line }}>sample-api</h2>
          <p className="mt-6 leading-relaxed" style={{ color: gh.fg }}>Order and billing API for the storefront.</p>
          <div className="mt-6 flex items-center gap-2.5">
            <svg width="132" height="20" viewBox="0 0 132 20" role="img" aria-label="Arbor Audit: 83/100">
              <rect width="132" height="20" rx="3" fill="#1e293b" />
              <rect x="82" width="50" height="20" rx="3" fill="#10b981" />
              <rect x="82" width="4" height="20" fill="#10b981" />
              <text x="41" y="14" textAnchor="middle" fill="#ffffff" fontSize="11" fontFamily="Verdana, DejaVu Sans, sans-serif">Arbor Audit</text>
              <text x="107" y="14" textAnchor="middle" fill="#ffffff" fontSize="11" fontFamily="Verdana, DejaVu Sans, sans-serif">83/100</text>
            </svg>
            <span className="text-[13px]" style={{ color: gh.muted }}>Badge updates after each completed audit</span>
          </div>
          <p className="mb-3 mt-10 text-[12px] font-semibold uppercase tracking-wider" style={{ color: gh.muted }}>Markdown</p>
          <pre className="overflow-hidden rounded-lg border p-5 font-mono text-[12.5px] leading-6" style={{ borderColor: gh.line, background: gh.code }}>
            {'[![Arbor Architecture](https://arborgit.vercel.app/api/badge/cmh7x2k0q0001)](https://arborgit.vercel.app/projects/sample-api)'}
          </pre>
        </div>
      </div>
    </div>
  )
}

function ChipScore() {
  return (
    <div className="flex h-full items-center justify-center p-8" style={{ background: 'transparent' }}>
      <div className="w-full rounded-2xl border p-7" style={{ borderColor: INK.line, background: INK.raised, color: INK.fg, boxShadow: '0 30px 60px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center justify-between text-[12px]" style={{ color: INK.muted }}>
          <span>Repository health</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: INK.emerald }} />Completed</span>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <span className="font-mono text-[64px] font-semibold leading-none tabular-nums">83</span>
          <span className="pb-2 text-[16px]" style={{ color: INK.dim }}>/100</span>
        </div>
        <div className="mt-6 space-y-3 text-[12px]">
          {[['Architecture', 91], ['Security', 96], ['Documentation', 63]].map(([l, v]) => (
            <div key={String(l)} className="grid grid-cols-[1fr_120px_32px] items-center gap-3">
              <span style={{ color: INK.muted }}>{l}</span>
              <span className="h-1.5 overflow-hidden rounded-full" style={{ background: INK.lineSoft }}>
                <span className="block h-full rounded-full" style={{ width: `${v}%`, background: scoreColor(Number(v)) }} />
              </span>
              <span className="text-right font-mono tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChipFinding() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full rounded-2xl border p-6" style={{ borderColor: '#5a4618', background: '#17130b', color: INK.fg, boxShadow: '0 30px 60px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center gap-2.5 text-[12px] font-semibold" style={{ color: INK.amber }}>
          <span className="size-2 rounded-full" style={{ background: INK.amber }} />
          Circular import
        </div>
        <p className="mt-3 font-mono text-[15px]">src/routes/orders.ts:1</p>
        <p className="mt-2 font-mono text-[13px]" style={{ color: INK.muted }}>orders → billing → orders</p>
      </div>
    </div>
  )
}

/** Renders one screen at 1280x800 (chips at their own size). */
export function ProductScreen({ name }: { name: ScreenName }) {
  switch (name) {
    case 'dashboard':
      return <AppWindow active="Projects" status="Audit complete · 3 min ago"><Dashboard /></AppWindow>
    case 'architecture':
      return <AppWindow active="Architecture" status="Graph ready · 18 modules"><Architecture /></AppWindow>
    case 'health':
      return <AppWindow active="Health" status="Analysis complete"><Health /></AppWindow>
    case 'findings':
      return <AppWindow active="Findings" status="4 open findings"><Findings /></AppWindow>
    case 'secrets':
      return <AppWindow active="Findings" status="Static checks complete"><Secrets /></AppWindow>
    case 'docs':
      return <DocsFrame />
    case 'api':
      return <ApiFrame />
    case 'readme':
      return <Readme />
    case 'chip-score':
      return <ChipScore />
    case 'chip-finding':
      return <ChipFinding />
    default:
      return null
  }
}

function DocsFrame() {
  return <div className="h-full w-full"><Docs /></div>
}

function ApiFrame() {
  return <div className="h-full w-full"><Api /></div>
}

export { Spark, Logo }
