'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CheckCircle2, Sparkles } from 'lucide-react'
import { Button, ButtonLabel } from '@/components/ui/createui/button'
import { Input } from '@/components/ui/createui/input'

export function PricingSection() {
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [joinedWaitlist, setJoinedWaitlist] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleJoinWaitlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = waitlistEmail.trim()
    if (!email || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'pricing_pro' }),
      })

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null)
        const message =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Could not join the waitlist. Please try again.'
        throw new Error(message)
      }

      setJoinedWaitlist(true)
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-10 max-w-2xl space-y-4 text-center sm:mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Straightforward plans
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
          Start free. Add team workflows when you need them.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Use Arbor for individual repositories at no cost. Team features are in development; join the list if you want an update when they are ready.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:items-stretch">
        <article className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="absolute -top-3 left-6 rounded-full border border-border bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground">
            Free forever
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Community</span>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-foreground">$0</span>
                <span className="text-sm text-muted-foreground">/ forever</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">For solo developers, maintainers, and small projects.</p>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Included</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Up to 3 active GitHub repositories</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Architecture and health audits in about 30 seconds</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Interactive dependency graph and repository report</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Technical debt, import, and secret checks</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-7">
            <Button asChild variant="neutral-light" appearance="outline" size="lg" shape="pill" className="w-full">
              <Link href="/login">
                <ButtonLabel>Start free with GitHub</ButtonLabel>
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>

        <article className="relative flex flex-col justify-between rounded-2xl border border-primary/40 bg-primary/[0.04] p-6 shadow-sm sm:p-8">
          <div className="absolute -top-3 right-6 rounded-full border border-primary/30 bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            In development
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Teams</span>
                <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">WAITLIST</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-foreground">$15</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">For teams planning shared workspaces and scheduled repository checks.</p>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Planned additions</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Shared team workspaces and role-based access</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Scheduled repository health sync</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>CI checks and priority analysis queue</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-7">
            {joinedWaitlist ? (
              <div role="status" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-center text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>You&apos;re on the early-access list.</span>
              </div>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="space-y-2" aria-busy={isSubmitting}>
                <label htmlFor="teams-waitlist-email" className="sr-only">Email for team plan updates</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="teams-waitlist-email"
                    size="md"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@company.com"
                    value={waitlistEmail}
                    onChange={(event) => {
                      setWaitlistEmail(event.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                    disabled={isSubmitting}
                    invalid={Boolean(errorMessage)}
                    aria-describedby={errorMessage ? 'teams-waitlist-error' : undefined}
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    shape="pill"
                    loading={isSubmitting}
                    disabled={!waitlistEmail.trim()}
                    className="shrink-0"
                  >
                    <ButtonLabel>{isSubmitting ? 'Saving' : 'Notify me'}</ButtonLabel>
                  </Button>
                </div>
                {errorMessage && (
                  <p id="teams-waitlist-error" role="alert" className="text-sm font-medium text-destructive">
                    {errorMessage}
                  </p>
                )}
              </form>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
