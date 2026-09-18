import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LandingNavbar } from '@/components/marketing/landing-navbar'
import { HeroPreviewCard } from '@/components/marketing/hero-preview-card'
import { FeatureSections } from '@/components/marketing/feature-sections'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { LandingFooter } from '@/components/marketing/landing-footer'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  CreditCard,
  Github,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react'

export const revalidate = 3600

const stackLogos = [
  { slug: 'react', label: 'React', href: 'https://cdn.simpleicons.org/react/61DAFB' },
  { slug: 'nextdotjs', label: 'Next.js', href: 'https://cdn.simpleicons.org/nextdotjs/000000/white' },
  { slug: 'typescript', label: 'TypeScript', href: 'https://cdn.simpleicons.org/typescript/3178C6' },
  { slug: 'python', label: 'Python', href: 'https://cdn.simpleicons.org/python/3776AB' },
  { slug: 'go', label: 'Go', href: 'https://cdn.simpleicons.org/go/00ADD8' },
  { slug: 'githubactions', label: 'GitHub Actions', href: 'https://cdn.simpleicons.org/githubactions/2088FF' },
  { slug: 'gitlab', label: 'GitLab', href: 'https://cdn.simpleicons.org/gitlab/FC6D26' },
]

/* eslint-disable @next/next/no-img-element */
function LogoRow() {
  const vscodeHref = 'https://cdn.simpleicons.org/visualstudiocode/007ACC'
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Reads the code you already ship
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
          {stackLogos.map(({ slug, label, href }) => (
            <img
              key={slug}
              src={href}
              alt={label}
              height={26}
              width={26}
              loading="lazy"
              className="h-6.5 w-6.5 transition-all duration-300 hover:scale-110"
            />
          ))}
          <img
            src={vscodeHref}
            alt="Visual Studio Code"
            height={26}
            width={26}
            loading="lazy"
            className="h-6.5 w-6.5 transition-all duration-300 hover:scale-110"
          />
        </div>
      </div>
    </div>
  )
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col selection:bg-[#65DCD5]/20 selection:text-[#65DCD5]">
      {/* Top Ambient Glow behind Hero */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-full max-w-7xl overflow-hidden">
        <div className="mx-auto h-[420px] w-[600px] sm:w-[840px] rounded-full bg-gradient-to-b from-[#43637E]/20 via-[#65DCD5]/10 to-transparent blur-[120px]" />
      </div>

      {/* Sticky Marketing Header */}
      <LandingNavbar user={user} />

      <main className="flex-1 space-y-24 sm:space-y-32 lg:space-y-40 pb-20">
        {/* Hero Section */}
        <section className="relative pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-9">
          <div className="space-y-5 max-w-4xl mx-auto">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-balance text-foreground leading-[1.05]">
              Arbor: Automated Codebase Intelligence in{' '}
              <span className="text-[#65DCD5]">
                30 Seconds.
              </span>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-balance">
              Deterministic AST parser turning any GitHub repository into an automated
              architectural audit, interactive dependency graph, and production health score —
              cutting code review and onboarding time from days to seconds.
            </p>
          </div>

          {/* High-Intent Conversion CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            {user ? (
              <Button asChild size="lg" className="h-12 px-7 gap-2.5 font-bold shadow-md text-sm bg-[#65DCD5] text-[#1a0f26] hover:bg-[#321E48] hover:text-[#65DCD5] transition-all">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-12 px-7 gap-2.5 font-bold shadow-md text-sm bg-[#65DCD5] text-[#1a0f26] hover:bg-[#321E48] hover:text-[#65DCD5] transition-all">
                <Link href="/login">
                  <Github className="h-4 w-4" />
                  <span>Start Analyzing Free with GitHub</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" size="lg" className="h-12 px-6 font-semibold text-sm border border-[#43637E]/50 hover:border-[#65DCD5] bg-card hover:bg-[#65DCD5]/10 text-foreground hover:text-[#65DCD5] transition-all">
              <a href="#features">
                Try Live Interactive Demo
              </a>
            </Button>
          </div>

          {/* Immediate Trust Architecture Signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground pt-1">
            {[
              { icon: CreditCard, label: 'No credit card required' },
              { icon: Timer, label: '30-second setup' },
              { icon: ShieldCheck, label: 'Read-only access' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-[#65DCD5]" />
                {label}
              </span>
            ))}
          </div>

          {/* Inline Framework & Integration Badges */}
          <div className="pt-2 flex flex-col items-center gap-2.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/80">
              Native Integrations & Framework Support
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                'GitHub Actions',
                'VS Code',
                'Next.js 14',
                'TypeScript',
                'Python',
                'Docker',
                'PostgreSQL',
              ].map((badge) => (
                <span
                  key={badge}
                  className="rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Hero Preview Mockup */}
          <div className="pt-4 sm:pt-8">
            <HeroPreviewCard />
          </div>
        </section>

        {/* Stack Logo Row */}
        <div className="border-y border-border/60 py-10">
          <LogoRow />
        </div>

        {/* Feature Deep Dives & Numbers */}
        <FeatureSections />

        {/* Comparison Matrix */}
        <ComparisonTable />

        {/* Future Subscription / Pricing Teaser */}
        <PricingSection />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Pre-Footer Call to Action Banner */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl border border-border bg-card p-8 sm:p-14 text-center overflow-hidden shadow-xl">
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[480px] rounded-full bg-gradient-to-b from-primary/15 via-emerald-500/10 to-transparent blur-[90px]" />
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance text-foreground font-display">
                Ready to Understand Any Codebase in 30 Seconds?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Connect a GitHub repository with read-only permissions and get a deterministic
                architectural audit, dependency graph, and health score — no credit card, no
                AI hallucination, no source code stored.
              </p>
              <div className="pt-2 flex justify-center">
                <Button asChild size="lg" className="h-12 px-8 gap-2.5 font-bold shadow-md bg-[#65DCD5] text-[#1a0f26] hover:bg-[#321E48] hover:text-[#65DCD5] transition-all">
                  <Link href={user ? '/dashboard' : '/login'}>
                    <Github className="h-4 w-4" />
                    <span>{user ? 'Open Dashboard' : 'Analyze Repo Free with GitHub'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <LandingFooter />
    </div>
  )
}