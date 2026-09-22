import { Suspense } from 'react'
import Link from 'next/link'
import { githubConfigured } from '@/lib/env'
import { GithubSignInButton } from '@/components/auth/github-sign-in-button'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Sign In — Arbor',
  description: 'Sign in to Arbor with GitHub to analyze repositories and generate automated architectural audits.',
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background text-foreground antialiased">
      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Arbor</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Centered Auth Card */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <Link href="/" className="inline-flex items-center hover:opacity-85 transition-opacity">
              <Logo size="lg" showWordmark />
            </Link>
            <div className="space-y-1 pt-1">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Sign in to Arbor
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your GitHub account to access repository audits and architecture graphs.
              </p>
            </div>
          </div>

          {/* Card Container */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs space-y-5">
            <Suspense fallback={<div className="h-14 flex items-center justify-center text-xs text-muted-foreground">Loading sign in...</div>}>
              <GithubSignInButton configured={githubConfigured} />
            </Suspense>

            <div className="border-t border-border/60 pt-4 text-center">
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Single-developer workbench mode · Ephemeral analysis · Zero source code stored
              </p>
            </div>
          </div>

          {/* Footer Terms */}
          <div className="text-center text-[11px] text-muted-foreground/60">
            By continuing, you agree to Arbor&apos;s standard terms and privacy principles.
          </div>
        </div>
      </main>

      {/* Bottom Spacer */}
      <footer className="relative z-10 py-5 text-center text-[11px] text-muted-foreground/40">
        Arbor · Automated Repository Intelligence
      </footer>
    </div>
  )
}