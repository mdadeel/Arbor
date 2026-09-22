'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PricingSection() {
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [joinedWaitlist, setJoinedWaitlist] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail || !waitlistEmail.includes('@') || isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, source: 'pricing_pro' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to join waitlist')
      }

      setJoinedWaitlist(true)
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Transparent Pricing</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-display">
          Start Free. Scale as Your Team Grows.
        </h2>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Arbor is free forever for individual developers and open-source projects. Pro subscriptions launch soon for expanding teams and automated pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
        {/* Tier 1: Community Free */}
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col justify-between shadow-sm relative">
          <div className="absolute -top-3.5 left-6 rounded-full bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 border border-border px-3 py-1 text-[11px] font-bold shadow-md">
            FREE FOREVER
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Community Free
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-foreground font-display">$0</span>
                <span className="text-sm text-muted-foreground">/ forever</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ideal for solo builders, open source maintainers, and indie hackers.
              </p>
            </div>

            <div className="border-t border-border pt-6 space-y-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                What&apos;s included:
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#65DCD5] shrink-0" />
                  <span>Up to 3 active GitHub repositories</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#65DCD5] shrink-0" />
                  <span>Full AST architectural audits in ~30 seconds</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#65DCD5] shrink-0" />
                  <span>Interactive React Flow dependency graph</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#65DCD5] shrink-0" />
                  <span>Dynamic SVG README shields badges</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#65DCD5] shrink-0" />
                  <span>Tech debt, unused imports &amp; secret scanner</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8">
            <Button asChild variant="outline" className="w-full h-11 gap-2 shadow-xs">
              <Link href="/login">
                <span>Start Free with GitHub</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Tier 2: Pro (Premium Launching Soon) */}
        <div className="rounded-2xl border-2 border-foreground/30 bg-card p-8 flex flex-col justify-between shadow-xl relative">
          <div className="absolute -top-3.5 right-6 rounded-full bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-950 border border-border px-3 py-1 text-[11px] font-bold shadow-md">
            COMING SOON
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Pro &amp; Teams
                </span>
                <span className="rounded bg-muted text-foreground text-[10px] font-mono font-bold px-1.5 py-0.5 border border-border">
                  WAITLIST
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-foreground font-display">$15</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="text-xs text-muted-foreground">
                For growing engineering teams requiring automated audits, team workspaces, and CI/CD gates.
              </p>
            </div>

            <div className="border-t border-border pt-6 space-y-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Everything in Free, plus:
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-foreground shrink-0" />
                  <span className="text-foreground font-medium">Unlimited repositories &amp; analyses</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-foreground shrink-0" />
                  <span>Team Workspaces &amp; RBAC (Owner, Admin, Member)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-foreground shrink-0" />
                  <span>Scheduled automated repository health sync</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-foreground shrink-0" />
                  <span>GitHub Actions CI/CD audit blocker</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-foreground shrink-0" />
                  <span>Priority analysis worker queue</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 space-y-2">
            {joinedWaitlist ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-center text-xs text-foreground font-medium flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                <span>You&apos;re on the early access waitlist! We&apos;ll notify you first when subscriptions launch.</span>
              </div>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="Enter email for early access"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  required
                />
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 px-5 text-xs shrink-0 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Notify Me'}
                </Button>
              </form>
            )}
            {errorMessage && (
              <p className="text-xs text-destructive font-medium">{errorMessage}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}