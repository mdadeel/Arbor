import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { LandingNavbar } from '@/components/marketing/landing-navbar'
import { HeroPreviewCard } from '@/components/marketing/hero-preview-card'
import { WhatOthersMiss } from '@/components/marketing/what-others-miss'
import { FeatureSections } from '@/components/marketing/feature-sections'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { LandingFooter } from '@/components/marketing/landing-footer'
import { Button, ButtonLabel } from '@/components/ui/createui/button'
import { Badge } from '@/components/ui/createui/badge'
import {
  ArrowRight,
  ClipboardCheck,
  GitBranch,
  Github,
  LockKeyhole,
  Timer,
} from 'lucide-react'

export const revalidate = 3600

const technologies = ['TypeScript', 'JavaScript', 'Python', 'Go', 'React', 'Next.js', 'GitHub Actions', 'GitLab']

const workflow = [
  {
    number: '01',
    icon: Github,
    title: 'Connect a repository',
    description: 'Choose a GitHub repository and review the requested permissions before connecting. No workflow file or local setup is required.',
  },
  {
    number: '02',
    icon: GitBranch,
    title: 'Map the code',
    description: 'Arbor parses source structure and import relationships to build an inspectable architecture map.',
  },
  {
    number: '03',
    icon: ClipboardCheck,
    title: 'Review the evidence',
    description: 'Open health dimensions and findings with the file paths and checks behind each result.',
  },
]

function TechnologyStrip() {
  return (
    <section className="border-y border-border bg-card/40" aria-label="Supported languages and tooling">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="shrink-0 text-xs font-medium text-muted-foreground">
          Works with the code and tooling you already use
        </p>
        <ul className="flex flex-wrap items-center gap-2" aria-label="Supported technologies">
          {technologies.map((technology) => (
            <li key={technology}>
              <Badge variant="neutral" appearance="outline" size="xs">{technology}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl space-y-3">
        <Badge variant="primary" appearance="soft" size="xs">A clear path from repo to insight</Badge>
        <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground text-balance sm:text-4xl">
          Useful architecture context, without a setup project.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Start with a repository you already own. Arbor does the first pass and leaves you with a map you can inspect and share.
        </p>
      </div>

      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {workflow.map(({ number, icon: Icon, title, description }) => (
          <li key={number} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{number}</span>
              <Icon className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  const primaryHref = user ? '/dashboard' : '/login'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
      <LandingNavbar user={user} />

      <main className="flex-1 space-y-20 pb-16 sm:space-y-28 sm:pb-24">
        <section className="relative isolate overflow-hidden border-b border-border/70">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-graph-grid opacity-60" aria-hidden="true" />
          <div className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pt-24">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <Badge variant="verified" appearance="soft" shape="pill" leading={<span className="size-1.5 rounded-full bg-primary" />}>
                Architecture intelligence for GitHub
              </Badge>

              <h1 className="font-display text-4xl font-semibold leading-[1.04] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl">
                See how your codebase fits together.
              </h1>

              <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Arbor turns a GitHub repository into an inspectable map of modules, dependencies, and health—so you can understand the system before you change it.
              </p>

              <div className="flex flex-col items-stretch justify-center gap-3 pt-2 sm:flex-row sm:items-center">
                <Button asChild variant="primary" size="lg" shape="pill" className="w-full sm:w-auto">
                  <Link href={primaryHref}>
                    {!user && <Github aria-hidden="true" />}
                    <ButtonLabel>{user ? 'Open your workbench' : 'Analyze a repository'}</ButtonLabel>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="neutral-light" appearance="outline" size="lg" shape="pill" className="w-full sm:w-auto">
                  <a href="#security">
                    <ButtonLabel>Explore an example</ButtonLabel>
                  </a>
                </Button>
              </div>

              <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <LockKeyhole className="size-3.5 text-primary" aria-hidden="true" />
                  Review GitHub permissions first
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Timer className="size-3.5 text-primary" aria-hidden="true" />
                  About 30 seconds per audit
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <GitBranch className="size-3.5 text-primary" aria-hidden="true" />
                  Temporary copy removed after analysis
                </li>
              </ul>
            </div>

            <div className="mt-10 sm:mt-14">
              <HeroPreviewCard />
            </div>
          </div>
        </section>

        <TechnologyStrip />
        <HowItWorks />
        <WhatOthersMiss />
        <FeatureSections />
        <PricingSection />
        <FaqSection />

        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-10 lg:p-14">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-graph-grid opacity-60 lg:block" aria-hidden="true" />
            <div className="relative max-w-2xl space-y-5">
              <Badge variant="success" appearance="soft" size="xs">Start with one repository</Badge>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground text-balance sm:text-4xl">
                Get the map before the next change.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Connect a repo, run an audit, and inspect the architecture behind the score.
              </p>
              <Button asChild variant="primary" size="lg" shape="pill">
                <Link href={primaryHref}>
                  {!user && <Github aria-hidden="true" />}
                  <ButtonLabel>{user ? 'Open your workbench' : 'Analyze a repository'}</ButtonLabel>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
