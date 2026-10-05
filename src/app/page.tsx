import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LandingNavbar } from '@/components/marketing/landing-navbar'
import { HeroPreviewCard } from '@/components/marketing/hero-preview-card'
import { WhatOthersMiss } from '@/components/marketing/what-others-miss'
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
  Network,
  ShieldCheck,
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
  const vscodeHref = '/icons/vscode.svg'
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-5">
        <p className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
          Reads the code you already ship
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
          {stackLogos.map(({ slug, label, href }) => (
            <img
              key={slug}
              src={href}
              alt={label}
              height={24}
              width={24}
              loading="lazy"
              className="h-6 w-6 opacity-75 hover:opacity-100 transition-opacity"
            />
          ))}
          <img
            src={vscodeHref}
            alt="Visual Studio Code"
            height={24}
            width={24}
            loading="lazy"
            className="h-6 w-6 opacity-75 hover:opacity-100 transition-opacity"
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
    <div className="relative min-h-screen bg-background text-foreground flex flex-col selection:bg-muted selection:text-foreground">
      {/* Sticky Marketing Header */}
      <LandingNavbar user={user} />

      <main className="flex-1 space-y-24 sm:space-y-32 lg:space-y-36 pb-20">
        
        {/* Hero Section: Graph-Paper Grid Coordinate Backdrop */}
        <section className="relative pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
          
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Direction Eyebrow */}
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-acid">
              RECOMMENDED DIRECTION / QUIET PRECISION
            </p>

            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance text-foreground leading-[0.98]">
              Make Arbor feel like evidence, not marketing.
            </h1>

            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-balance">
              Lead with the dependency graph and health score. Turn &ldquo;deterministic&rdquo; into something
              visitors can inspect. Use one sharp green accent, technical annotation, and enough restraint
              to let the product carry the page.
            </p>

            {/* Design Principles Row */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 font-mono text-[11px]" aria-label="Design principles">
              <span className="border border-border dark:border-line-strong bg-card px-3 py-1 font-semibold text-foreground">
                PRODUCT UI FIRST
              </span>
              <span className="border border-border dark:border-line-strong bg-card px-3 py-1 font-semibold text-foreground">
                MECHANISM OVER CLAIMS
              </span>
              <span className="border border-border dark:border-line-strong bg-card px-3 py-1 font-semibold text-foreground">
                ONE ACCENT
              </span>
            </div>

            {/* Call to Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-3">
              <Button asChild size="lg" className="rounded-none border border-foreground/30 h-11 px-7 gap-2.5 font-mono font-semibold shadow-xs">
                <Link href={user ? '/dashboard' : '/login'}>
                  <Github className="h-4 w-4" />
                  <span>{user ? 'Open Developer Dashboard' : 'Analyze your repo free'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-none border border-border dark:border-line-strong h-11 px-6 gap-2 font-mono font-medium">
                <Link href="#architecture">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span>Explore architecture DAG</span>
                </Link>
              </Button>
            </div>

            {/* Immediate Trust Invariants */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-muted-foreground pt-1">
              {[
                { icon: CreditCard, label: 'No credit card required' },
                { icon: Timer, label: '< 30s audit time' },
                { icon: ShieldCheck, label: 'Read-only access · 0 bytes retained' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 font-medium">
                  <Icon className="h-3.5 w-3.5 text-foreground" />
                  <span>{label}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Product Frame Hero Canvas with 28px Graph Grid */}
          <div className="pt-4 sm:pt-6 bg-graph-grid border border-border/80 dark:border-line p-4 sm:p-8 lg:p-10">
            <HeroPreviewCard />
          </div>
        </section>

        {/* Stack Logo Row */}
        <div className="border-y border-border dark:border-line py-10 bg-muted/10">
          <LogoRow />
        </div>

        {/* 01 / THESIS: A credible developer tool should show its work */}
        <section id="thesis" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] lg:grid-cols-[260px_1fr] gap-6 sm:gap-10 mb-10 pb-8 border-b border-border dark:border-line">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-acid">
                01 / THESIS
              </span>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground font-display text-balance leading-[1.08]">
                A credible developer tool should show its work.
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed text-balance">
                The redesign should not add more spectacle. It should make Arbor&apos;s strongest facts impossible to miss:
                a fast audit, a visible graph, and deterministic mechanisms that can be explained.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
            {/* Card KEEP */}
            <article className="border border-border dark:border-line-strong bg-emerald-600/10 dark:bg-acid/10 p-6 sm:p-10 flex flex-col justify-between space-y-8">
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-acid tracking-wider">
                  KEEP
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans mt-3">
                  The numbers, the graph, the score.
                </h3>
                <p className="text-sm text-muted-foreground font-sans mt-3 leading-relaxed">
                  The product already has the right raw material. Promote the quantified proof row into the hero
                  and enlarge the actual dashboard until it becomes the undeniable visual anchor of the page.
                </p>
              </div>
              <div className="text-xs text-emerald-600 dark:text-acid font-semibold pt-4 border-t border-emerald-500/20">
                100% deterministic AST · Zero hallucinations
              </div>
            </article>

            {/* Card REMOVE */}
            <article className="border border-border dark:border-line-strong bg-card p-6 sm:p-10 flex flex-col justify-between space-y-8">
              <div>
                <span className="text-xs font-bold text-muted-foreground tracking-wider">
                  REMOVE
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans mt-3">
                  Generic cards and anonymous trust.
                </h3>
                <p className="text-sm text-muted-foreground font-sans mt-3 leading-relaxed">
                  Feature tiles flatten the story. Anonymous aggregate reviews dilute technical credibility.
                  Replace invented social proof with auditable, reproducible AST inspection mechanisms.
                </p>
              </div>
              <div className="text-xs text-muted-foreground font-semibold pt-4 border-t border-border dark:border-line">
                Authentic developer engineering · No synthetic ratings
              </div>
            </article>
          </div>
        </section>

        {/* 03 / SIGNATURE MODULE: What Others Miss / What Arbor Shows */}
        <WhatOthersMiss />

        {/* 04 / SYSTEM TOPOLOGY & HEALTH: Feature Deep Dives */}
        <FeatureSections />

        {/* 05 / EVIDENCE MATRIX: Comparison Table */}
        <ComparisonTable />

        {/* Future Subscription / Pricing Teaser */}
        <PricingSection />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Pre-Footer Call to Action Banner: The Build Brief */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] border border-border dark:border-line-strong bg-card overflow-hidden">
            <div className="p-8 sm:p-14 space-y-6">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-acid">
                THE BUILD BRIEF
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance text-foreground font-display">
                One decisive redesign, not a cosmetic pass.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-sans max-w-xl">
                Recompose the page around the real product, move quantified proof next to the first action,
                and make a deterministic audit comparison the signature section. Everything else supports that story.
              </p>
              <div className="pt-2">
                <Button asChild size="lg" className="rounded-none border border-foreground/30 h-11 px-8 gap-2.5 font-mono font-semibold shadow-xs">
                  <Link href={user ? '/dashboard' : '/login'}>
                    <Github className="h-4 w-4" />
                    <span>{user ? 'Open Developer Dashboard' : 'Analyze your repo free'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="p-8 sm:p-12 bg-emerald-600 dark:bg-acid text-[#11170f] font-mono flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block mb-4">
                  CORE PRINCIPLES
                </span>
                <ol className="space-y-3 text-xs font-semibold list-decimal list-inside leading-relaxed">
                  <li>Build the hero from real product UI.</li>
                  <li>Lead with &lt;30s, 100% AST, 7 dimensions, 0 bytes.</li>
                  <li>Replace feature cards with proof demo.</li>
                  <li>Rewrite comparison cells as mechanisms.</li>
                  <li>Zero synthetic ratings or invented reviews.</li>
                </ol>
              </div>
              <div className="pt-4 border-t border-[#11170f]/20 text-[11px] font-bold">
                Arbor Architecture Intelligence · 2026
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