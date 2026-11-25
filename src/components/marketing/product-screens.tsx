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
 * Supports both Apple HIG Light mode ('apple', default) and legacy dark mode ('dark').
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
export type ThemeMode = 'apple' | 'dark'

export interface PaletteTokens {
  bg: string
  panel: string
  sidebar: string
  raised: string
  line: string
  lineSoft: string
  fg: string
  muted: string
  dim: string
  accent: string
  accentSoft: string
  accentText: string
  acid: string
  emerald: string
  amber: string
  red: string
  sky: string
  violet: string
  well: string
  gridDot: string
  tagBg: string
  activeNavBg: string
  activeNavFg: string
  trafficClose: string
  trafficMin: string
  trafficZoom: string
  trafficBorder: string
  cardShadow: string
  windowShadow: string
  codeBg: string
  codeBorder: string
  diffHighlight: string
}

export const APPLE_INK: PaletteTokens = {
  bg: '#ffffff',
  panel: '#ffffff',
  sidebar: '#f5f5f7',
  raised: '#ffffff',
  line: 'rgba(0, 0, 0, 0.09)',
  lineSoft: 'rgba(0, 0, 0, 0.05)',
  fg: '#1d1d1f', // Apple Label (Primary Text)
  muted: '#6e6e73', // Apple Secondary Label
  dim: '#86868b', // Apple Tertiary Label
  accent: '#007aff', // Apple System Blue
  accentSoft: 'rgba(0, 122, 255, 0.10)',
  accentText: '#0062cc',
  acid: '#007aff', // Map acid accent to Apple System Blue in light mode
  emerald: '#34c759', // Apple System Green
  amber: '#ff9500', // Apple System Orange
  red: '#ff3b30', // Apple System Red
  sky: '#30b0c7', // Apple System Teal
  violet: '#af52de', // Apple System Purple
  well: '#f2f2f7', // Apple System Gray 6 (Grouped)
  gridDot: '#d1d1d6', // Apple System Gray 4
  tagBg: '#e5e5ea', // Apple System Gray 5
  activeNavBg: 'rgba(0, 122, 255, 0.10)',
  activeNavFg: '#007aff',
  trafficClose: '#ff5f56',
  trafficMin: '#ffbd2e',
  trafficZoom: '#27c93f',
  trafficBorder: 'rgba(0, 0, 0, 0.14)',
  cardShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.06)',
  windowShadow: '0 0 0 1px rgba(0, 0, 0, 0.08), 0 20px 48px -12px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)',
  codeBg: '#f6f8fa',
  codeBorder: '#e1e4e8',
  diffHighlight: 'rgba(255, 149, 0, 0.12)',
}

export const DARK_INK: PaletteTokens = {
  bg: '#0b0f0c',
  panel: '#0f1511',
  sidebar: '#0f1511',
  raised: '#151d17',
  line: '#26322a',
  lineSoft: '#1b241e',
  fg: '#edf4ee',
  muted: '#9aa69e',
  dim: '#66736b',
  accent: '#b7ed69',
  accentSoft: 'rgba(183, 237, 105, 0.15)',
  accentText: '#b7ed69',
  acid: '#b7ed69',
  emerald: '#34d399',
  amber: '#f5b84b',
  red: '#f47c6c',
  sky: '#7dd3fc',
  violet: '#c4b5fd',
  well: '#0a0a0b',
  gridDot: '#22302a',
  tagBg: '#1b241e',
  activeNavBg: '#1d2a20',
  activeNavFg: '#edf4ee',
  trafficClose: '#f47c6c99',
  trafficMin: '#f5b84b99',
  trafficZoom: '#34d39999',
  trafficBorder: 'transparent',
  cardShadow: 'none',
  windowShadow: 'none',
  codeBg: '#0f1511',
  codeBorder: '#26322a',
  diffHighlight: '#2a2110',
}

function scoreColor(score: number, ink: PaletteTokens) {
  if (score >= 80) return ink.emerald
  if (score >= 60) return ink.amber
  return ink.red
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

function Logo({ size = 20, color = '#007aff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

/** macOS-authentic application window: top bar, sidebar, and content area. */
function AppWindow({
  active,
  status,
  theme,
  ink,
  children,
}: {
  active: string
  status: string
  theme: ThemeMode
  ink: PaletteTokens
  children: ReactNode
}) {
  const isApple = theme === 'apple'

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden text-[13px] transition-colors"
      style={{
        background: ink.bg,
        color: ink.fg,
        fontFamily: isApple ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif' : undefined,
      }}
    >
      {/* Window Top Titlebar */}
      <div
        className="flex h-12 shrink-0 items-center justify-between border-b px-5"
        style={{
          borderColor: ink.line,
          background: isApple ? 'rgba(255, 255, 255, 0.95)' : ink.panel,
          backdropFilter: isApple ? 'blur(16px)' : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          {/* macOS Traffic Lights */}
          <div className="flex items-center gap-2" aria-hidden="true">
            <span
              className="size-3 rounded-full"
              style={{
                background: ink.trafficClose,
                border: isApple ? `0.5px solid ${ink.trafficBorder}` : undefined,
              }}
            />
            <span
              className="size-3 rounded-full"
              style={{
                background: ink.trafficMin,
                border: isApple ? `0.5px solid ${ink.trafficBorder}` : undefined,
              }}
            />
            <span
              className="size-3 rounded-full"
              style={{
                background: ink.trafficZoom,
                border: isApple ? `0.5px solid ${ink.trafficBorder}` : undefined,
              }}
            />
          </div>

          <span className="mx-1 h-4 w-px" style={{ background: ink.line }} />

          <div className="flex items-center gap-2 font-mono text-[12px]" style={{ color: ink.muted }}>
            <GitBranch className="size-3.5" aria-hidden="true" style={{ color: isApple ? ink.accent : undefined }} />
            <span className="font-medium" style={{ color: ink.fg }}>arbor / sample-api</span>
            <span>· main</span>
          </div>
        </div>

        {/* Status Pill */}
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium"
          style={{
            borderColor: isApple ? 'rgba(52, 199, 89, 0.25)' : ink.line,
            background: isApple ? 'rgba(52, 199, 89, 0.08)' : 'transparent',
            color: isApple ? '#248a3d' : ink.muted,
          }}
        >
          <span className="size-1.5 rounded-full" style={{ background: ink.emerald }} />
          {status}
        </div>
      </div>

      {/* Main Split: Sidebar + Content */}
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex w-52 shrink-0 flex-col gap-1 border-r p-4"
          style={{ borderColor: ink.line, background: ink.sidebar }}
        >
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <Logo color={isApple ? ink.accent : ink.acid} />
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: ink.fg }}>Arbor</span>
            {isApple && (
              <span className="ml-auto rounded px-1.5 py-0.5 text-[9.5px] font-mono font-semibold uppercase tracking-wider text-muted-foreground" style={{ background: ink.tagBg }}>
                DEV
              </span>
            )}
          </div>
          {NAV.map(({ label, icon: Icon }) => {
            const isActive = label === active
            return (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors"
                style={{
                  background: isActive ? ink.activeNavBg : 'transparent',
                  color: isActive ? ink.activeNavFg : ink.muted,
                }}
              >
                <Icon
                  className="size-4"
                  aria-hidden="true"
                  style={{ color: isActive ? (isApple ? ink.accent : ink.acid) : undefined }}
                />
                {label}
              </div>
            )
          })}
          <p className="mt-auto px-2 text-[11px] leading-relaxed" style={{ color: ink.dim }}>
            Sample data for illustration.
          </p>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden p-8" style={{ background: ink.bg }}>
          {children}
        </main>
      </div>
    </div>
  )
}

function Dashboard({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

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
          <h2 className="text-[26px] font-semibold tracking-tight" style={{ color: ink.fg }}>Projects</h2>
          <p className="mt-1" style={{ color: ink.muted }}>5 repositories · 2 audits running · 1 critical finding</p>
        </div>
        <div
          className="cursor-pointer rounded-lg px-4 py-2 text-[12.5px] font-semibold transition-all shadow-xs"
          style={{
            background: isApple ? ink.accent : ink.acid,
            color: isApple ? '#ffffff' : '#11170f',
          }}
        >
          Analyze repository
        </div>
      </div>

      <div
        className="flex-none overflow-hidden rounded-xl border"
        style={{ borderColor: ink.line, background: isApple ? ink.raised : 'transparent', boxShadow: isApple ? ink.cardShadow : undefined }}
      >
        <div
          className="grid grid-cols-[2.2fr_1.3fr_1.6fr_1fr_1.2fr_0.9fr] gap-4 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{ borderColor: ink.line, color: ink.dim, background: isApple ? '#f8f8fa' : 'transparent' }}
        >
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
            className="grid grid-cols-[2.2fr_1.3fr_1.6fr_1fr_1.2fr_0.9fr] items-center gap-4 border-b px-5 py-4 last:border-b-0 transition-colors"
            style={{
              borderColor: ink.lineSoft,
              background: p.active ? (isApple ? 'rgba(0, 122, 255, 0.04)' : '#131c15') : 'transparent',
            }}
          >
            <span className="flex items-center gap-2.5 font-mono text-[13px] font-medium" style={{ color: ink.fg }}>
              <span className="size-2 rounded-full" style={{ background: scoreColor(p.score, ink) }} />
              {p.name}
            </span>
            <span style={{ color: ink.muted }}>{p.stack}</span>
            <span className="flex items-center gap-3">
              <span className="w-8 font-mono font-semibold tabular-nums" style={{ color: ink.fg }}>{p.score}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: isApple ? '#e5e5ea' : ink.lineSoft }}>
                <span className="block h-full rounded-full" style={{ width: `${p.score}%`, background: scoreColor(p.score, ink) }} />
              </span>
            </span>
            <Spark values={p.trend} color={scoreColor(p.score, ink)} width={96} height={28} />
            <span style={{ color: ink.muted }}>{p.when}</span>
            <span className="text-right font-mono font-semibold tabular-nums" style={{ color: ink.fg }}>{p.findings}</span>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Recent activity</p>
        {[
          ['Audit completed', 'arbor / sample-api', 'Score 83, up 3 since last run', ink.emerald],
          ['Circular import found', 'billing-service', 'orders.ts ↔ billing.ts', ink.amber],
          ['Patch suggestion ready', 'mobile-api', 'Adds missing auth guard to 2 routes', ink.sky],
          ['Badge published', 'docs-site', 'README badge now shows 88', isApple ? ink.accent : ink.acid],
        ].map(([title, project, detail, color]) => (
          <div
            key={title}
            className="grid grid-cols-[14px_1.4fr_1fr_1.6fr] items-center gap-4 border-b py-3 text-[13px] last:border-b-0"
            style={{ borderColor: ink.lineSoft }}
          >
            <span className="size-2 rounded-full" style={{ background: color as string }} />
            <span className="font-medium" style={{ color: ink.fg }}>{title}</span>
            <span className="font-mono text-[12px]" style={{ color: ink.muted }}>{project}</span>
            <span style={{ color: ink.dim }}>{detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MODULE_DEFS = {
  'app.ts': { x: 110, y: 300, layer: 'Application entry', role: 'acid' },
  'router.ts': { x: 370, y: 130, layer: 'Route dispatch', role: 'sky' },
  'auth.ts': { x: 630, y: 130, layer: 'Authentication', role: 'sky' },
  'orders.ts': { x: 370, y: 300, layer: 'Route handler', role: 'sky' },
  'billing.ts': { x: 630, y: 300, layer: 'Billing service', role: 'violet' },
  'db.ts': { x: 370, y: 470, layer: 'Persistence', role: 'emerald' },
  'audit.ts': { x: 630, y: 470, layer: 'AST analysis', role: 'violet' },
} as const

type ModuleName = keyof typeof MODULE_DEFS

function Architecture({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

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
  const center = (m: ModuleName) => ({ x: MODULE_DEFS[m].x, y: MODULE_DEFS[m].y })

  const getModuleColor = (role: string) => {
    switch (role) {
      case 'acid': return isApple ? ink.accent : ink.acid
      case 'sky': return isApple ? ink.sky : ink.sky
      case 'violet': return isApple ? ink.violet : ink.violet
      case 'emerald': return ink.emerald
      default: return ink.muted
    }
  }

  return (
    <div className="flex h-full gap-6">
      {/* Graph Visualizer Panel */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden rounded-xl border"
        style={{
          borderColor: ink.line,
          background: isApple ? ink.well : ink.panel,
          boxShadow: isApple ? ink.cardShadow : undefined,
        }}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `radial-gradient(${ink.gridDot} 1px, transparent 1px)`,
            backgroundSize: '22px 22px',
          }}
        />

        <div className="absolute left-5 top-4 flex items-center gap-4 text-[11px]" style={{ color: ink.muted }}>
          <span className="font-semibold" style={{ color: ink.fg }}>Import graph</span>
          <span>18 modules</span>
          <span>42 edges</span>
          <span className="font-semibold" style={{ color: ink.amber }}>1 cycle</span>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-[4/3] h-full max-w-full">
            <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill={isApple ? '#8e8e93' : '#4b5a50'} />
                </marker>
                <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill={ink.amber} />
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
                    stroke={e.cycle ? ink.amber : (isApple ? '#c7c7cc' : '#4b5a50')}
                    strokeWidth={e.cycle ? 2 : 1.5}
                    strokeDasharray={e.cycle ? '6 5' : undefined}
                    markerEnd={e.cycle ? 'url(#arrow-amber)' : 'url(#arrow)'}
                  />
                )
              })}
            </svg>

            {(Object.keys(MODULE_DEFS) as ModuleName[]).map((name) => {
              const m = MODULE_DEFS[name]
              const selected = name === 'orders.ts'
              const color = getModuleColor(m.role)

              return (
                <div
                  key={name}
                  className="absolute rounded-lg border px-3.5 py-2.5 transition-all"
                  style={{
                    left: `${(m.x - W / 2) / 8}%`,
                    top: `${((m.y - H / 2) / 600) * 100}%`,
                    width: `${(W / 800) * 100}%`,
                    background: selected
                      ? (isApple ? '#ffffff' : '#1a2a1d')
                      : (isApple ? '#ffffff' : ink.raised),
                    borderColor: selected
                      ? (isApple ? ink.accent : ink.acid)
                      : ink.line,
                    boxShadow: selected
                      ? (isApple ? `0 0 0 3px ${ink.accentSoft}, 0 4px 12px rgba(0,0,0,0.06)` : `0 0 0 3px ${ink.acid}33`)
                      : (isApple ? '0 1px 3px rgba(0,0,0,0.04)' : undefined),
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: color }} />
                    <span className="font-mono text-[12.5px] font-semibold" style={{ color: ink.fg }}>{name}</span>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: ink.dim }}>{m.layer}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected Module Detail Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col gap-6 border-l pl-6" style={{ borderColor: ink.line }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Selected module</p>
          <h3 className="mt-2 font-mono text-[20px] font-semibold" style={{ color: ink.fg }}>orders.ts</h3>
          <p className="mt-1 font-mono text-[12px]" style={{ color: ink.muted }}>src/routes/orders.ts</p>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-[12px]">
          {[
            ['Lines', '182'],
            ['Imports', '3'],
            ['Used by', '2'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt style={{ color: ink.dim }}>{k}</dt>
              <dd className="mt-1 font-mono text-[18px] font-semibold tabular-nums" style={{ color: ink.fg }}>{v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Imports</p>
          {['billing.ts', 'db.ts', 'validation.ts'].map((f) => (
            <div key={f} className="flex items-center justify-between border-b py-2.5 font-mono text-[12.5px]" style={{ borderColor: ink.lineSoft, color: ink.fg }}>
              {f}
              {f === 'billing.ts' && (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    background: isApple ? 'rgba(255, 149, 0, 0.14)' : '#3a2c12',
                    color: isApple ? '#c96f00' : ink.amber,
                  }}
                >
                  cycle
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: isApple ? 'rgba(255, 149, 0, 0.3)' : '#5a4618',
            background: isApple ? 'rgba(255, 149, 0, 0.08)' : '#1f1a0e',
          }}
        >
          <p className="text-[12px] font-semibold" style={{ color: isApple ? '#c96f00' : ink.amber }}>
            Circular import detected
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: ink.muted }}>
            orders → billing → orders. Break the cycle by moving the shared function into its own module.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Health({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

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
          <h2 className="text-[26px] font-semibold tracking-tight" style={{ color: ink.fg }}>Repository health</h2>
          <p className="mt-1" style={{ color: ink.muted }}>Analysis completed 3 minutes ago · main @ 3f1a9c2</p>
        </div>
        <Spark values={[71, 74, 76, 79, 80, 82, 83]} color={ink.emerald} width={180} height={44} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-12">
        {/* Apple Watch-style score meter */}
        <div className="flex flex-col items-center justify-center gap-5">
          <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r={r} fill="none" stroke={isApple ? '#e5e5ea' : ink.lineSoft} strokeWidth="16" />
            <circle
              cx="130"
              cy="130"
              r={r}
              fill="none"
              stroke={ink.emerald}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${circ * 0.83} ${circ}`}
              transform="rotate(-90 130 130)"
            />
            <text x="130" y="134" textAnchor="middle" fill={ink.fg} fontSize="64" fontWeight="600" fontFamily="var(--font-geist-mono), monospace">83</text>
            <text x="130" y="166" textAnchor="middle" fill={ink.dim} fontSize="16" fontFamily="var(--font-geist-sans), sans-serif">out of 100</text>
          </svg>
          <p className="text-center text-[13px]" style={{ color: ink.muted }}>Overall score, weighted across six dimensions</p>
        </div>

        {/* Breakdown bars and Next actions */}
        <div className="flex flex-col justify-center gap-7">
          <div className="space-y-4">
            {dims.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[170px_1fr_44px] items-center gap-5">
                <span className="text-[14px] font-medium" style={{ color: ink.fg }}>{label}</span>
                <span className="h-2.5 overflow-hidden rounded-full" style={{ background: isApple ? '#e5e5ea' : ink.lineSoft }}>
                  <span className="block h-full rounded-full" style={{ width: `${value}%`, background: scoreColor(value, ink) }} />
                </span>
                <span className="text-right font-mono text-[14px] font-semibold tabular-nums" style={{ color: ink.fg }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-6" style={{ borderColor: ink.line }}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Next actions</p>
            {[
              ['Break the orders ↔ billing cycle', 'Architecture', 'High'],
              ['Document five undocumented environment variables', 'Documentation', 'Medium'],
              ['Split audit.ts, which is 310 lines', 'Tech debt', 'Review'],
            ].map(([title, area, level], i) => (
              <div
                key={title}
                className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b py-3 text-[13.5px] last:border-b-0"
                style={{ borderColor: ink.lineSoft }}
              >
                <span className="font-mono text-[12px]" style={{ color: ink.dim }}>0{i + 1}</span>
                <span style={{ color: ink.fg }}>
                  {title}
                  <span className="ml-2.5 text-[12px]" style={{ color: ink.dim }}>{area}</span>
                </span>
                <span
                  className="font-mono text-[11.5px] font-medium"
                  style={{ color: level === 'High' ? ink.amber : ink.muted }}
                >
                  {level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Findings({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

  const items = [
    { title: 'Circular import: orders ↔ billing', file: 'src/routes/orders.ts', sev: 'High', color: ink.amber },
    { title: 'Admin procedure has no guard', file: 'src/server/admin.ts', sev: 'Critical', color: ink.red },
    { title: 'Large source file', file: 'src/server/services/audit.ts', sev: 'Review', color: ink.sky },
    { title: 'Variable missing from .env.example', file: 'src/lib/billing.ts', sev: 'Low', color: ink.muted },
  ]

  return (
    <div className="flex h-full gap-0">
      <div className="w-[330px] shrink-0 border-r pr-6" style={{ borderColor: ink.line }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-tight" style={{ color: ink.fg }}>Findings</h2>
          <span className="font-mono text-[12px]" style={{ color: ink.muted }}>4 open</span>
        </div>
        {items.map((it, i) => (
          <div
            key={it.title}
            className="border-b py-4 transition-colors"
            style={{
              borderColor: ink.lineSoft,
              background: i === 0 ? (isApple ? 'rgba(0, 122, 255, 0.05)' : '#131c15') : 'transparent',
              marginLeft: i === 0 ? -12 : 0,
              paddingLeft: i === 0 ? 12 : 0,
              borderRadius: isApple && i === 0 ? '8px' : undefined,
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full" style={{ background: it.color }} />
              <span className="text-[13.5px] font-medium" style={{ color: ink.fg }}>{it.title}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between pl-[18px] font-mono text-[11.5px]" style={{ color: ink.dim }}>
              <span className="truncate">{it.file}</span>
              <span style={{ color: it.color }}>{it.sev}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 pl-10">
        <p className="text-[12px] font-mono font-semibold" style={{ color: isApple ? '#c96f00' : ink.amber }}>
          High · Architecture
        </p>
        <h3 className="mt-2 text-[24px] font-semibold tracking-tight" style={{ color: ink.fg }}>
          A circular import crosses two modules
        </h3>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]" style={{ color: ink.muted }}>
          <span className="font-mono font-medium">src/routes/orders.ts:1</span>
          <span>Mechanism: resolved AST import graph</span>
          <span>Rule: cyclic-import</span>
        </div>

        {/* Code Excerpt Box */}
        <div
          className="mt-7 overflow-hidden rounded-xl border font-mono text-[13px] leading-7"
          style={{
            borderColor: isApple ? ink.codeBorder : ink.line,
            background: isApple ? ink.codeBg : ink.panel,
          }}
        >
          {[
            ['1', 'import { invoiceFor } from "../billing/invoices"', true],
            ['2', 'export const ordersRouter = createRouter({', false],
            ['3', '  invoice: () => invoiceFor(orderId),', false],
            ['4', '})', false],
            ['5', '// billing/invoices.ts imports ordersRouter', false],
          ].map(([n, code, hot]) => (
            <div
              key={String(n)}
              className="flex gap-5 px-5"
              style={{
                background: hot ? (isApple ? ink.diffHighlight : '#2a2110') : 'transparent',
              }}
            >
              <span className="w-4 text-right" style={{ color: ink.dim }}>{n}</span>
              <span style={{ color: hot ? (isApple ? '#8a3b00' : ink.fg) : (isApple ? '#24292e' : ink.muted) }}>
                {code}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed" style={{ color: ink.muted }}>
          The import path closes a cycle: orders → billing → orders. Cycles make modules hard to test and reorder.
        </p>

        <div className="mt-6 border-l-2 pl-5" style={{ borderColor: isApple ? ink.accent : ink.acid }}>
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Recommendation</p>
          <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: ink.fg }}>
            Move invoiceFor into a shared module that neither route imports.
          </p>
        </div>

        <div className="mt-8 flex gap-3">
          <span
            className="cursor-pointer rounded-lg border px-4 py-2 text-[12.5px] font-medium transition-colors"
            style={{
              borderColor: ink.line,
              background: isApple ? '#ffffff' : 'transparent',
              color: ink.fg,
            }}
          >
            Mark as triaged
          </span>
          <span
            className="cursor-pointer rounded-lg px-4 py-2 text-[12.5px] font-semibold transition-all shadow-xs"
            style={{
              background: isApple ? ink.accent : ink.acid,
              color: isApple ? '#ffffff' : '#11170f',
            }}
          >
            Suggest patch
          </span>
        </div>
      </div>
    </div>
  )
}

function Secrets({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const env = [
    ['DATABASE_URL', 'documented', ink.emerald],
    ['REDIS_URL', 'documented', ink.emerald],
    ['NEXT_PUBLIC_APP_URL', 'documented', ink.emerald],
    ['STRIPE_SECRET_KEY', 'missing from example', ink.red],
    ['SENTRY_DSN', 'missing from example', ink.amber],
  ] as const

  return (
    <div className="flex h-full flex-col gap-8">
      <div>
        <h2 className="text-[26px] font-semibold tracking-tight" style={{ color: ink.fg }}>Secrets and environment</h2>
        <p className="mt-1" style={{ color: ink.muted }}>Static pattern checks and .env.example comparison · values are never stored</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-12">
        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Committed secrets</p>
          <div className="border-t" style={{ borderColor: ink.line }}>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b py-4 text-[13.5px]" style={{ borderColor: ink.lineSoft }}>
              <span className="font-mono" style={{ color: ink.fg }}>src/config.ts:14</span>
              <span style={{ color: ink.muted }}>Credential-like assignment</span>
              <span className="font-mono text-[12px] font-semibold" style={{ color: ink.red }}>Redacted</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b py-4 text-[13.5px]" style={{ borderColor: ink.lineSoft }}>
              <span className="font-mono" style={{ color: ink.fg }}>scripts/seed.ts:3</span>
              <span style={{ color: ink.muted }}>Private key header</span>
              <span className="font-mono text-[12px] font-semibold" style={{ color: ink.red }}>Redacted</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b py-4 text-[13.5px]" style={{ borderColor: ink.lineSoft }}>
              <span className="font-mono" style={{ color: ink.fg }}>src/app/api/hooks/route.ts</span>
              <span style={{ color: ink.muted }}>No secret patterns found</span>
              <span className="font-mono text-[12px] font-semibold" style={{ color: ink.emerald }}>Clear</span>
            </div>
          </div>
          <p className="mt-6 max-w-md text-[13px] leading-relaxed" style={{ color: ink.muted }}>
            Findings store the file, line, and rule that matched. The matched value is replaced before it is saved.
          </p>
        </div>

        <div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: ink.dim }}>Environment variables · 14 referenced</p>
          <div className="border-t" style={{ borderColor: ink.line }}>
            {env.map(([key, state, color]) => (
              <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b py-3.5 text-[13.5px]" style={{ borderColor: ink.lineSoft }}>
                <span className="flex items-center gap-3 font-mono font-medium" style={{ color: ink.fg }}>
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  {key}
                </span>
                <span className="text-[12.5px] font-medium" style={{ color }}>{state}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-mono text-[40px] font-semibold tabular-nums" style={{ color: ink.amber }}>2</span>
            <span className="text-[13px]" style={{ color: ink.muted }}>variables need documentation in .env.example</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Docs({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

  const paper = isApple ? '#ffffff' : '#f6f1e7'
  const inkColor = isApple ? '#1d1d1f' : '#211d17'
  const soft = isApple ? '#6e6e73' : '#6f675a'
  const rule = isApple ? 'rgba(0, 0, 0, 0.08)' : '#e2d9c7'
  const rust = isApple ? '#0071e3' : '#b4532a'

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
    <div className="flex h-full overflow-hidden text-[13px]" style={{ background: paper, color: inkColor }}>
      <aside className="w-60 shrink-0 border-r p-6" style={{ borderColor: rule, background: isApple ? '#f5f5f7' : 'transparent' }}>
        <p className="mb-5 font-semibold tracking-tight text-[15px]">Living docs</p>
        {tree.map(([label, isGroup]) => (
          <div
            key={label}
            className="py-1.5 transition-colors"
            style={{
              paddingLeft: isGroup ? 0 : 14,
              color: isGroup ? inkColor : soft,
              fontWeight: isGroup ? 600 : 400,
              background: label === 'Billing service' ? (isApple ? 'rgba(0, 122, 255, 0.10)' : '#ece4d2') : 'transparent',
              borderRadius: 6,
            }}
          >
            {label}
          </div>
        ))}
      </aside>

      <article className="min-w-0 flex-1 px-12 py-10 overflow-y-auto">
        <div className="flex items-center gap-3 text-[12px]" style={{ color: soft }}>
          <span>Architecture</span>
          <span>/</span>
          <span style={{ color: inkColor }}>Billing service</span>
          <span
            className="ml-auto rounded px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: isApple ? 'rgba(0, 113, 227, 0.10)' : '#f3dcc9', color: rust }}
          >
            Review due Nov 2
          </span>
        </div>
        <h2 className="mt-6 text-[36px] font-semibold leading-tight tracking-tight">Billing service</h2>
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
        <pre
          className="mt-3 overflow-hidden rounded-lg border p-4 font-mono text-[12.5px] leading-6"
          style={{ borderColor: rule, background: isApple ? '#f6f8fa' : '#efe7d6' }}
        >
          {'export async function invoiceFor(orderId: string) {\n  return db.invoice.findFirst({ where: { orderId } })\n}'}
        </pre>
        <p className="mt-6 text-[13px]" style={{ color: soft }}>Last edited by Mira Chen · 2 hours ago</p>
      </article>

      <aside className="w-72 shrink-0 border-l p-6" style={{ borderColor: rule, background: isApple ? '#fafafa' : 'transparent' }}>
        <p className="mb-5 text-[12px] font-semibold uppercase tracking-wider" style={{ color: soft }}>Version history</p>
        {[
          ['v12', 'Clarify refund flow', '2 hours ago', true],
          ['v11', 'Add webhook retries', '3 days ago', false],
          ['v10', 'Split invoice states', '1 week ago', false],
          ['v9', 'Initial billing notes', '3 weeks ago', false],
        ].map(([v, t, when, current]) => (
          <div key={String(v)} className="relative border-l pb-7 pl-6" style={{ borderColor: rule }}>
            <span className="absolute -left-[5px] top-1 size-2.5 rounded-full" style={{ background: current ? rust : (isApple ? '#c7c7cc' : rule) }} />
            <p className="font-mono text-[12px] font-semibold">{v}</p>
            <p className="mt-1 text-[13.5px] font-medium">{t}</p>
            <p className="mt-0.5 text-[12px]" style={{ color: soft }}>{when}</p>
          </div>
        ))}
      </aside>
    </div>
  )
}

function Api({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

  const bg = isApple ? '#ffffff' : '#0a1020'
  const fg = isApple ? '#1d1d1f' : '#e2e8f0'
  const rule = isApple ? 'rgba(0, 0, 0, 0.08)' : '#1e293b'
  const sidebarBg = isApple ? '#f5f5f7' : '#0a1020'
  const codeBg = isApple ? '#f6f8fa' : '#0f172a'
  const codeBorder = isApple ? '#e1e4e8' : '#1e293b'
  const K = isApple ? '#0550ae' : '#7dd3fc'
  const S = isApple ? '#116329' : '#86efac'
  const N = isApple ? '#953800' : '#fbbf24'
  const P = isApple ? '#57606a' : '#94a3b8'

  const endpoints = [
    ['GET', '/orders'],
    ['POST', '/orders/{orderId}/invoice'],
    ['GET', '/webhooks/payments'],
    ['POST', '/refunds'],
  ] as const

  return (
    <div className="flex h-full overflow-hidden text-[13px]" style={{ background: bg, color: fg }}>
      <aside className="w-72 shrink-0 border-r p-6" style={{ borderColor: rule, background: sidebarBg }}>
        <p className="mb-1 text-[12px] font-semibold" style={{ color: fg }}>sample-api.yaml</p>
        <p className="mb-5 font-mono text-[11px]" style={{ color: isApple ? '#6e6e73' : '#64748b' }}>OpenAPI 3.1 · 4 endpoints</p>
        {endpoints.map(([method, path], i) => (
          <div
            key={path}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
            style={{ background: i === 1 ? (isApple ? 'rgba(0, 122, 255, 0.10)' : '#111c33') : 'transparent' }}
          >
            <span
              className="w-11 font-mono text-[11px] font-semibold"
              style={{ color: method === 'GET' ? (isApple ? '#34c759' : '#4ade80') : (isApple ? '#007aff' : '#38bdf8') }}
            >
              {method}
            </span>
            <span className="truncate font-mono text-[12px]" style={{ color: fg }}>{path}</span>
          </div>
        ))}
      </aside>

      <div className="grid min-w-0 flex-1 grid-cols-2 gap-0">
        <div className="border-r p-8" style={{ borderColor: rule }}>
          <div className="flex items-center gap-3">
            <span
              className="rounded px-2 py-1 font-mono text-[12px] font-semibold"
              style={{ background: isApple ? 'rgba(0, 122, 255, 0.12)' : '#0c2a3d', color: isApple ? '#007aff' : '#38bdf8' }}
            >
              POST
            </span>
            <span className="font-mono text-[13px] font-medium" style={{ color: fg }}>/orders/{'{orderId}'}/invoice</span>
          </div>
          <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: isApple ? '#6e6e73' : '#64748b' }}>Headers</p>
          <div className="space-y-2 font-mono text-[12.5px]">
            <div><span style={{ color: K }}>Content-Type</span>: <span style={{ color: S }}>application/json</span></div>
            <div><span style={{ color: K }}>Authorization</span>: <span style={{ color: isApple ? '#6e6e73' : '#64748b' }}>Bearer •••</span></div>
          </div>
          <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-wider" style={{ color: isApple ? '#6e6e73' : '#64748b' }}>Path parameters</p>
          <pre className="rounded-lg border p-4 font-mono text-[12.5px] leading-6" style={{ borderColor: codeBorder, background: codeBg }}>
            <span style={{ color: P }}>{'{'}</span>
            {'\n  '}
            <span style={{ color: K }}>&quot;orderId&quot;</span>
            <span style={{ color: P }}>: </span>
            <span style={{ color: S }}>&quot;ord_2fK9&quot;</span>
            {'\n'}
            <span style={{ color: P }}>{'}'}</span>
          </pre>
          <div
            className="mt-8 inline-flex cursor-pointer rounded-lg px-4 py-2.5 font-semibold text-[13px] transition-all shadow-xs"
            style={{ background: isApple ? '#007aff' : '#38bdf8', color: '#ffffff' }}
          >
            Send request
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[12.5px] font-semibold" style={{ color: isApple ? '#34c759' : '#4ade80' }}>200 OK</span>
            <span className="font-mono text-[12px]" style={{ color: isApple ? '#86868b' : '#64748b' }}>142 ms · application/json</span>
          </div>
          <pre className="mt-6 rounded-lg border p-5 font-mono text-[12.5px] leading-6" style={{ borderColor: codeBorder, background: codeBg }}>
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
            <span style={{ color: isApple ? '#cf222e' : '#f472b6' }}>false</span>
            {'\n'}
            <span style={{ color: P }}>{'}'}</span>
          </pre>
          <p className="mt-6 text-[12.5px] leading-relaxed" style={{ color: isApple ? '#6e6e73' : '#94a3b8' }}>
            Requests run through a server-side proxy, so the browser never calls the target API directly.
          </p>
        </div>
      </div>
    </div>
  )
}

function Readme({ theme }: { theme: ThemeMode }) {
  const isApple = theme === 'apple'

  const gh = isApple
    ? { bg: '#ffffff', fg: '#1d1d1f', muted: '#6e6e73', line: 'rgba(0, 0, 0, 0.08)', code: '#f6f8fa' }
    : { bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', line: '#30363d', code: '#161b22' }

  return (
    <div className="flex h-full flex-col overflow-hidden text-[14px]" style={{ background: gh.bg, color: gh.fg }}>
      <div className="flex h-12 items-center gap-3 border-b px-6 text-[13px]" style={{ borderColor: gh.line, background: isApple ? '#f5f5f7' : '#161b22' }}>
        <span className="font-semibold">arbor-team</span>
        <span style={{ color: gh.muted }}>/</span>
        <span className="font-semibold">sample-api</span>
      </div>
      <div className="flex-1 p-14 overflow-y-auto">
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

function ChipScore({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

  return (
    <div className="flex h-full items-center justify-center p-8" style={{ background: 'transparent' }}>
      <div
        className="w-full max-w-sm rounded-2xl border p-7"
        style={{
          borderColor: ink.line,
          background: isApple ? '#ffffff' : ink.raised,
          color: ink.fg,
          boxShadow: isApple ? ink.windowShadow : '0 30px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="flex items-center justify-between text-[12px]" style={{ color: ink.muted }}>
          <span className="font-medium">Repository health</span>
          <span className="flex items-center gap-1.5 font-medium"><span className="size-1.5 rounded-full" style={{ background: ink.emerald }} />Completed</span>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <span className="font-mono text-[64px] font-semibold leading-none tabular-nums" style={{ color: ink.fg }}>83</span>
          <span className="pb-2 text-[16px]" style={{ color: ink.dim }}>/100</span>
        </div>
        <div className="mt-6 space-y-3 text-[12px]">
          {[['Architecture', 91], ['Security', 96], ['Documentation', 63]].map(([l, v]) => (
            <div key={String(l)} className="grid grid-cols-[1fr_120px_32px] items-center gap-3">
              <span style={{ color: ink.muted }}>{l}</span>
              <span className="h-1.5 overflow-hidden rounded-full" style={{ background: isApple ? '#e5e5ea' : ink.lineSoft }}>
                <span className="block h-full rounded-full" style={{ width: `${v}%`, background: scoreColor(Number(v), ink) }} />
              </span>
              <span className="text-right font-mono font-medium tabular-nums" style={{ color: ink.fg }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChipFinding({ theme, ink }: { theme: ThemeMode; ink: PaletteTokens }) {
  const isApple = theme === 'apple'

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{
          borderColor: isApple ? 'rgba(255, 149, 0, 0.3)' : '#5a4618',
          background: isApple ? '#ffffff' : '#17130b',
          color: ink.fg,
          boxShadow: isApple ? ink.windowShadow : '0 30px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="flex items-center gap-2.5 text-[12px] font-semibold" style={{ color: isApple ? '#c96f00' : ink.amber }}>
          <span className="size-2 rounded-full" style={{ background: ink.amber }} />
          Circular import
        </div>
        <p className="mt-3 font-mono text-[15px] font-semibold" style={{ color: ink.fg }}>src/routes/orders.ts:1</p>
        <p className="mt-2 font-mono text-[13px]" style={{ color: ink.muted }}>orders → billing → orders</p>
      </div>
    </div>
  )
}

/** Renders one screen at 1280x800 (chips at their own size). Defaults to Apple HIG Light theme. */
export function ProductScreen({ name, theme = 'apple' }: { name: ScreenName; theme?: ThemeMode }) {
  const ink = theme === 'apple' ? APPLE_INK : DARK_INK

  switch (name) {
    case 'dashboard':
      return <AppWindow active="Projects" status="Audit complete · 3 min ago" theme={theme} ink={ink}><Dashboard theme={theme} ink={ink} /></AppWindow>
    case 'architecture':
      return <AppWindow active="Architecture" status="Graph ready · 18 modules" theme={theme} ink={ink}><Architecture theme={theme} ink={ink} /></AppWindow>
    case 'health':
      return <AppWindow active="Health" status="Analysis complete" theme={theme} ink={ink}><Health theme={theme} ink={ink} /></AppWindow>
    case 'findings':
      return <AppWindow active="Findings" status="4 open findings" theme={theme} ink={ink}><Findings theme={theme} ink={ink} /></AppWindow>
    case 'secrets':
      return <AppWindow active="Findings" status="Static checks complete" theme={theme} ink={ink}><Secrets theme={theme} ink={ink} /></AppWindow>
    case 'docs':
      return <div className="h-full w-full"><Docs theme={theme} ink={ink} /></div>
    case 'api':
      return <div className="h-full w-full"><Api theme={theme} ink={ink} /></div>
    case 'readme':
      return <Readme theme={theme} />
    case 'chip-score':
      return <ChipScore theme={theme} ink={ink} />
    case 'chip-finding':
      return <ChipFinding theme={theme} ink={ink} />
    default:
      return null
  }
}

export { Spark, Logo }
