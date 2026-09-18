import { Suspense } from 'react'
import Link from 'next/link'
import { githubConfigured } from '@/lib/env'
import { GithubSignInButton } from '@/components/auth/github-sign-in-button'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { ArrowLeft, GitBranch, ShieldCheck, Zap } from 'lucide-react'

export const metadata = {
  title: 'Sign In — Arbor',
  description: 'Sign in to Arbor with GitHub to analyze repositories and generate automated architectural audits.',
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-background text-foreground">
      {/* Ambient Radial Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-b from-[#65DCD5]/10 via-[#43637E]/10 to-transparent blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-gradient-to-t from-primary/5 to-transparent blur-[100px]" />

      {/* Subtle Background Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Arbor</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Centered Auth Card */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <Link href="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
              <Logo size="lg" showWordmark />
            </Link>
            <div className="space-y-1.5 pt-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Welcome to Arbor
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Connect your GitHub account to access repository audits, architecture graphs, and code health reports.
              </p>
            </div>
          </div>

          {/* Card Container */}
          <div className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-black/5 space-y-6">
            <Suspense fallback={<div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading sign in...</div>}>
              <GithubSignInButton configured={githubConfigured} />
            </Suspense>

            {/* Feature Pills */}
            <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-5 text-[11px] text-muted-foreground">
              <div className="flex flex-col items-center text-center gap-1">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>30s AST Pass</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Zero Code Saved</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <GitBranch className="h-3.5 w-3.5 text-[#65DCD5]" />
                <span>Read-Only</span>
              </div>
            </div>
          </div>

          {/* Footer Notes */}
          <div className="text-center text-xs text-muted-foreground/70 space-y-1.5">
            <p className="text-[11px]">
              By signing in, you agree to Arbor&apos;s standard terms and privacy principles.
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              Single-developer workbench mode · Ephemeral analysis · Secure OAuth
            </p>
          </div>
        </div>
      </main>

      {/* Symmetrical Bottom Spacer */}
      <footer className="relative z-10 py-4 text-center text-[11px] text-muted-foreground/40">
        Arbor · Automated Repository Intelligence
      </footer>
    </div>
  )
}