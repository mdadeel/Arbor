import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ProductScreen,
  SCREEN_NAMES,
  type ScreenName,
  type ThemeMode,
  Logo,
} from '@/components/marketing/product-screens'
import {
  Activity,
  BookOpen,
  CheckCircle2,
  GitBranch,
  Layers,
  LayoutGrid,
  Network,
  ShieldAlert,
  Terminal,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react'

export const metadata = {
  title: 'Product Screens · Showcase',
  robots: { index: false, follow: false },
}

const SCREEN_META: Record<ScreenName, { title: string; desc: string; icon: typeof LayoutGrid; category: string }> = {
  dashboard: {
    title: 'Workspace Dashboard',
    desc: 'Project table with health trends, active scans, and recent activity log.',
    icon: LayoutGrid,
    category: 'Workbench',
  },
  architecture: {
    title: 'Architecture & AST Import Graph',
    desc: 'Interactive 2D module dependency canvas highlighting circular import loops.',
    icon: Network,
    category: 'Core AST',
  },
  health: {
    title: 'Repository Health Breakdown',
    desc: 'Apple Watch-style circular score meter across 6 architectural dimensions.',
    icon: Activity,
    category: 'Diagnostics',
  },
  findings: {
    title: 'Findings Inspector & Patch Workbench',
    desc: 'Xcode-styled source excerpt with line diffs and patch suggestions.',
    icon: ShieldAlert,
    category: 'Analysis',
  },
  secrets: {
    title: 'Secrets & Environment Shield',
    desc: 'Static credential leak detection and .env.example variable coverage.',
    icon: Layers,
    category: 'Security',
  },
  docs: {
    title: 'Living Docs Notebook',
    desc: 'In-repo architecture documentation with version history and review dates.',
    icon: BookOpen,
    category: 'Knowledge',
  },
  api: {
    title: 'OpenAPI Explorer & Proxy',
    desc: 'Interactive endpoint schema inspector with sandbox request runner.',
    icon: Terminal,
    category: 'Testing',
  },
  readme: {
    title: 'Repository Readme & Live Badge',
    desc: 'Dynamic SVG architecture audit badges for GitHub project READMEs.',
    icon: GitBranch,
    category: 'Integration',
  },
  'chip-score': {
    title: 'Score Card Chip',
    desc: 'Compact elevated score pill for marketing cards and bento grids.',
    icon: CheckCircle2,
    category: 'Component',
  },
  'chip-finding': {
    title: 'Finding Alert Chip',
    desc: 'Compact elevated circular dependency badge for feature cards.',
    icon: ShieldAlert,
    category: 'Component',
  },
}

/**
 * Development-only route that renders one marketing product screen at a time
 * (?screen=dashboard&theme=apple). It is used to capture the images in public/marketing
 * and to review UI designs in both Apple Light and legacy dark modes.
 */
export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; theme?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const params = await searchParams
  const name = SCREEN_NAMES.find((n) => n === params.screen) as ScreenName | undefined
  const theme: ThemeMode = params.theme === 'dark' ? 'dark' : 'apple'
  const isApple = theme === 'apple'

  // Individual Screen Full View
  if (name) {
    return (
      <div
        className="relative h-screen w-screen overflow-hidden transition-colors"
        data-screen={name}
        data-theme={theme}
        style={{
          background: isApple ? '#f5f5f7' : '#0b0f0c',
          fontFamily: isApple ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif' : undefined,
        }}
      >
        <ProductScreen name={name} theme={theme} />

        {/* Floating Quick-Switch Toolbar (pinned bottom-right) */}
        <nav
          aria-label="Showcase controls"
          className="pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] shadow-lg backdrop-blur-md transition-opacity hover:opacity-100 opacity-80"
          style={{
            borderColor: isApple ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)',
            background: isApple ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 21, 17, 0.88)',
            color: isApple ? '#1d1d1f' : '#edf4ee',
          }}
        >
          <Link
            href={`/showcase?theme=${theme}`}
            className="flex items-center gap-1 font-medium hover:underline pr-1"
          >
            ← Studio
          </Link>

          <span className="h-3 w-px opacity-30" style={{ background: 'currentColor' }} />

          {/* Screen Picker */}
          <div className="flex items-center gap-1">
            {SCREEN_NAMES.map((s) => {
              const active = s === name
              return (
                <Link
                  key={s}
                  href={`/showcase?screen=${s}&theme=${theme}`}
                  className="rounded px-2 py-0.5 text-[11px] font-mono transition-colors"
                  style={{
                    background: active
                      ? (isApple ? 'rgba(0, 122, 255, 0.12)' : '#1d2a20')
                      : 'transparent',
                    color: active
                      ? (isApple ? '#007aff' : '#b7ed69')
                      : (isApple ? '#6e6e73' : '#9aa69e'),
                    fontWeight: active ? 600 : 400,
                  }}
                  title={SCREEN_META[s].title}
                >
                  {s.replace('chip-', '')}
                </Link>
              )
            })}
          </div>

          <span className="h-3 w-px opacity-30" style={{ background: 'currentColor' }} />

          {/* Theme Toggle Button */}
          <Link
            href={`/showcase?screen=${name}&theme=${isApple ? 'dark' : 'apple'}`}
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            title={`Switch to ${isApple ? 'Dark' : 'Apple Light'} mode`}
          >
            {isApple ? (
              <>
                <Sun className="size-3 text-amber-500" />
                <span className="text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="size-3 text-sky-400" />
                <span className="text-[11px]">Dark</span>
              </>
            )}
          </Link>
        </nav>
      </div>
    )
  }

  // Showcase Studio Index Gallery
  return (
    <main
      className="min-h-screen p-6 sm:p-10 transition-colors"
      style={{
        background: isApple ? '#f5f5f7' : '#0b0f0c',
        color: isApple ? '#1d1d1f' : '#edf4ee',
        fontFamily: isApple ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif' : undefined,
      }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Studio Top Header */}
        <header className="flex flex-col gap-4 border-b pb-8 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: isApple ? 'rgba(0,0,0,0.08)' : '#26322a' }}>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl shadow-xs" style={{ background: isApple ? '#ffffff' : '#151d17', border: `1px solid ${isApple ? 'rgba(0,0,0,0.08)' : '#26322a'}` }}>
              <Logo size={22} color={isApple ? '#007aff' : '#b7ed69'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Arbor Product Screens Studio</h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: isApple ? 'rgba(0, 122, 255, 0.10)' : '#1d2a20',
                    color: isApple ? '#007aff' : '#b7ed69',
                  }}
                >
                  {isApple ? 'Apple HIG Light' : 'Canopy Dark'}
                </span>
              </div>
              <p className="mt-0.5 text-[13px]" style={{ color: isApple ? '#6e6e73' : '#9aa69e' }}>
                Reproducible 1280x800 marketing shots, workbench panels, and component chips.
              </p>
            </div>
          </div>

          {/* Theme Switcher Segmented Control */}
          <div
            className="flex items-center rounded-full p-1 border shadow-xs"
            style={{
              borderColor: isApple ? 'rgba(0, 0, 0, 0.08)' : '#26322a',
              background: isApple ? '#ffffff' : '#151d17',
            }}
          >
            <Link
              href="/showcase?theme=apple"
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-all"
              style={{
                background: isApple ? '#007aff' : 'transparent',
                color: isApple ? '#ffffff' : '#9aa69e',
                boxShadow: isApple ? '0 1px 3px rgba(0, 122, 255, 0.3)' : undefined,
              }}
            >
              <Sun className="size-3.5" />
              <span>Apple Light</span>
            </Link>
            <Link
              href="/showcase?theme=dark"
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-all"
              style={{
                background: !isApple ? '#22302a' : 'transparent',
                color: !isApple ? '#edf4ee' : '#6e6e73',
              }}
            >
              <Moon className="size-3.5" />
              <span>Dark</span>
            </Link>
          </div>
        </header>

        {/* Screen Cards Grid */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Available Screens">
          {SCREEN_NAMES.map((s) => {
            const meta = SCREEN_META[s]
            const Icon = meta.icon

            return (
              <Link
                key={s}
                href={`/showcase?screen=${s}&theme=${theme}`}
                className="group relative flex flex-col justify-between rounded-2xl border p-5 transition-all hover:scale-[1.01]"
                style={{
                  borderColor: isApple ? 'rgba(0, 0, 0, 0.08)' : '#26322a',
                  background: isApple ? '#ffffff' : '#0f1511',
                  boxShadow: isApple ? '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)' : undefined,
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider"
                      style={{
                        background: isApple ? '#f2f2f7' : '#151d17',
                        color: isApple ? '#6e6e73' : '#9aa69e',
                      }}
                    >
                      {meta.category}
                    </span>
                    <Icon
                      className="size-4 transition-transform group-hover:scale-110"
                      style={{ color: isApple ? '#007aff' : '#b7ed69' }}
                    />
                  </div>

                  <h2 className="mt-4 text-[15px] font-semibold tracking-tight" style={{ color: isApple ? '#1d1d1f' : '#edf4ee' }}>
                    {meta.title}
                  </h2>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed line-clamp-2" style={{ color: isApple ? '#6e6e73' : '#9aa69e' }}>
                    {meta.desc}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t pt-3 text-[12px] font-mono" style={{ borderColor: isApple ? 'rgba(0,0,0,0.05)' : '#1b241e' }}>
                  <span style={{ color: isApple ? '#86868b' : '#66736b' }}>?screen={s}</span>
                  <span
                    className="flex items-center gap-1 font-sans font-medium transition-transform group-hover:translate-x-0.5"
                    style={{ color: isApple ? '#007aff' : '#b7ed69' }}
                  >
                    Inspect <ArrowRight className="size-3" />
                  </span>
                </div>
              </Link>
            )
          })}
        </section>

        {/* Footer info */}
        <footer className="mt-12 text-center text-[12px]" style={{ color: isApple ? '#86868b' : '#66736b' }}>
          Rendered via Next.js server components · 1280x800 viewport target · Apple HIG Light & Canopy Dark
        </footer>
      </div>
    </main>
  )
}
