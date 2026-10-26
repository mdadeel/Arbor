import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import Image from 'next/image'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { LandingNavbar } from '@/components/marketing/landing-navbar'
import { ProductRows, HowItWorks, WorkbenchBento } from '@/components/marketing/product-sections'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { LandingFooter } from '@/components/marketing/landing-footer'
import { Button, ButtonLabel } from '@/components/ui/createui/button'
import { ArrowRight, Github, LockKeyhole, GitBranch, Timer } from 'lucide-react'

export const revalidate = 3600

// Canonical is set per page: the root layout deliberately does not set one,
// because Next.js would otherwise inherit it onto every route.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const technologies = ['TypeScript', 'JavaScript', 'React', 'Next.js', 'Python', 'Go']

function TechnologyStrip() {
  return (
    <section className="border-y border-border" aria-label="Supported languages and tooling">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="shrink-0 text-sm text-muted-foreground">Languages and frameworks Arbor recognizes</p>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm text-foreground" aria-label="Supported technologies">
          {technologies.map((technology) => (
            <li key={technology}>{technology}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  const primaryHref = user ? '/dashboard' : '/login'
  const ctaLabel = user ? 'Open your workbench' : 'Analyze a repository'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
      <LandingNavbar user={user} />

      <main className="flex-1 space-y-24 pb-16 sm:space-y-32 sm:pb-24">
        <section className="relative isolate overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-graph-grid opacity-40" aria-hidden="true" />
          <div className="mx-auto max-w-[1400px] px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <p className="marketing-rise font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Architecture intelligence for GitHub
              </p>
              <h1 className="marketing-rise mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-foreground text-balance sm:text-6xl lg:text-[5.5rem]">
                <span className="block">See how your codebase</span>{' '}
                <span className="block">fits together.</span>
              </h1>
              <p className="marketing-rise mx-auto mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Arbor turns a GitHub repository into an inspectable map of modules, dependencies, and health, so you understand the system before you change it.
              </p>

              <div className="marketing-rise flex flex-col items-stretch justify-center gap-3 pt-9 sm:flex-row sm:items-center">
                <Button asChild variant="primary" size="lg" shape="pill" className="w-full sm:w-auto">
                  <Link href={primaryHref}>
                    {!user && <Github aria-hidden="true" />}
                    <ButtonLabel>{ctaLabel}</ButtonLabel>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="neutral-light" appearance="outline" size="lg" shape="pill" className="w-full sm:w-auto">
                  <a href="#findings">
                    <ButtonLabel>See the evidence</ButtonLabel>
                  </a>
                </Button>
              </div>

              <ul className="marketing-rise flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-xs text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <LockKeyhole className="size-3.5 text-primary" aria-hidden="true" />
                  Review GitHub permissions first
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Timer className="size-3.5 text-primary" aria-hidden="true" />
                  Audit time scales with repository size
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <GitBranch className="size-3.5 text-primary" aria-hidden="true" />
                  Temporary copy removed after analysis
                </li>
              </ul>
            </div>

            <div className="relative mx-auto mt-16 max-w-6xl sm:mt-20">
              <div className="marketing-rise overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/60">
                <Image
                  src="/marketing/architecture.webp"
                  alt="Import graph of a sample repository, with a circular import between orders and billing highlighted in amber."
                  width={1280}
                  height={800}
                  priority
                  sizes="(min-width: 1280px) 1152px, 92vw"
                  className="h-auto w-full"
                />
              </div>
              <div className="marketing-float absolute -right-6 -top-10 hidden w-[260px] lg:block" aria-hidden="true">
                <Image src="/marketing/chip-score.png" alt="" width={560} height={380} className="h-auto w-full drop-shadow-2xl" />
              </div>
              <div className="marketing-float absolute -bottom-10 -left-6 hidden w-[260px] lg:block" aria-hidden="true">
                <Image src="/marketing/chip-finding.png" alt="" width={560} height={380} className="h-auto w-full drop-shadow-2xl" />
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">Illustrative sample data, drawn from the product layout.</p>
            </div>
          </div>
        </section>

        <TechnologyStrip />
        <HowItWorks />
        <ProductRows />
        <WorkbenchBento />
        <PricingSection />
        <FaqSection />

        <section className="relative isolate overflow-hidden border-y border-border">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background-image:radial-gradient(#2c3b31_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-12 lg:gap-14 lg:px-8">
            <div className="lg:col-span-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">Start with one repository</p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground text-balance sm:text-5xl">
                Get the map before the next change.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                Connect a repository, run an audit, and inspect the architecture behind the score.
              </p>
              <div className="mt-8">
                <Button asChild variant="primary" size="lg" shape="pill">
                  <Link href={primaryHref}>
                    {!user && <Github aria-hidden="true" />}
                    <ButtonLabel>{ctaLabel}</ButtonLabel>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/60 lg:col-span-7">
              <Image
                src="/marketing/dashboard.webp"
                alt="Projects overview listing five sample repositories with health scores, trend lines, and finding counts."
                width={1280}
                height={800}
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
