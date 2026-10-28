import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { Button, ButtonLabel } from '@/components/ui/createui/button'

export interface PricingSectionProps {
  isSignedIn?: boolean
}

export function PricingSection({ isSignedIn = false }: PricingSectionProps) {
  const freeHref = isSignedIn ? '/dashboard' : '/login'
  const teamsHref = isSignedIn
    ? '/settings?tab=workspaces'
    : '/login?callbackUrl=%2Fsettings%3Ftab%3Dworkspaces'

  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-10 max-w-2xl space-y-4 text-center sm:mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Per-workspace pricing — never per seat
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
          Start free. Upgrade a workspace when your team grows.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Audit individual repositories and small workspaces at no cost. Upgrade any workspace to
          Teams for higher scan quotas, larger member limits, and more scheduled syncs at one flat
          monthly rate.
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl divide-y divide-border border-y border-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <article className="relative flex flex-col justify-between gap-8 py-10 lg:pr-12">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Free forever
          </p>
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Free
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-foreground">$0</span>
                <span className="text-sm text-muted-foreground">/ forever</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                For solo developers, open-source maintainers, and small project workspaces.
              </p>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Included
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Up to 10 repository or system audits per hour</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Up to 5 members per workspace &amp; 3 active scheduled scans</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Interactive dependency graph, AST health report &amp; shareable A4 PDF export</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Technical debt, circular import, supply-chain &amp; secret checks</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-7">
            <Button
              asChild
              variant="neutral-light"
              appearance="outline"
              size="lg"
              shape="pill"
              className="w-full"
            >
              <Link href={freeHref}>
                <ButtonLabel>{isSignedIn ? 'Open dashboard' : 'Start free with GitHub'}</ButtonLabel>
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>

        <article className="relative flex flex-col justify-between gap-8 py-10 lg:pl-12">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Flat per workspace
          </p>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Teams
                </span>
                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  NOT PER SEAT
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-foreground">$15</span>
                <span className="text-sm text-muted-foreground">/ month per workspace</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                One predictable monthly price for the entire workspace, billed via Lemon Squeezy
                (merchant of record) and managed by the workspace owner.
              </p>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Everything in Free, plus
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Up to 60 repository or system audits per hour per workspace</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Up to 50 workspace members with Owner, Admin, Member &amp; Viewer RBAC</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Up to 50 active daily or weekly scheduled repository scans</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Self-serve customer billing portal, tax invoices &amp; instant cancellation</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-7">
            <Button asChild variant="primary" size="lg" shape="pill" className="w-full">
              <Link href={teamsHref}>
                <ButtonLabel>
                  {isSignedIn ? 'Upgrade a workspace' : 'Sign in to upgrade workspace'}
                </ButtonLabel>
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>
      </div>
    </section>
  )
}
