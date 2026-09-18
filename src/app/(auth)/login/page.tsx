import { Suspense } from 'react'
import Link from 'next/link'
import { githubConfigured } from '@/lib/env'
import { GithubSignInButton } from '@/components/auth/github-sign-in-button'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Code2,
  GitBranch,
  Network,
  ShieldCheck,
  Zap,
} from 'lucide-react'

export const metadata = {
  title: 'Sign In — Arbor',
  description: 'Sign in to Arbor to analyze your GitHub repositories and generate automated architectural audits.',
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen grid lg:grid-cols-2 overflow-hidden bg-background text-foreground">
      {/* Left Showcase Column (Desktop) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border bg-card/40 backdrop-blur-md overflow-hidden">
        {/* Ambient Gradient Glow */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-primary/15 to-transparent blur-[120px]" />

        {/* Brand Header */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Logo size="lg" showWordmark />
          </Link>
          <p className="text-xs text-muted-foreground mt-2 max-w-sm leading-relaxed">
            Automated architectural audits, visual dependency graphs, and repository health scores directly from your GitHub repos.
          </p>
        </div>

        {/* Center Live Preview Simulation Card */}
        <div className="relative z-10 my-8 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-display font-black text-lg">
                  88
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    mdadeel/etuitionhub-frontend
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-primary" /> main · 30s AST pass
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> Excellent
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Architecture</span>
                <span className="text-emerald-400 font-bold">85/100</span>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Tech Debt</span>
                <span className="text-emerald-400 font-bold">92/100</span>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <span className="text-muted-foreground block text-[9px] uppercase">Security</span>
                <span className="text-emerald-400 font-bold">86/100</span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-foreground font-sans">
                  <Network className="h-3.5 w-3.5 text-primary" /> Dependency DAG
                </span>
                <span className="text-emerald-400 font-bold">0 cycles</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-foreground font-sans">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> Leaked Secrets
                </span>
                <span className="text-emerald-400 font-bold">Clean</span>
              </div>
            </div>
          </div>

          {/* Social Proof Quote */}
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1.5 shadow-sm">
            <p className="italic leading-relaxed">
              &ldquo;Arbor replaced hours of outdated Confluence architecture wikis with 30-second automated AST reports.&rdquo;
            </p>
            <div className="text-[11px] font-medium text-foreground">
              — Senior Platform Engineer
            </div>
          </div>
        </div>

        {/* Security Disclosures */}
        <div className="relative z-10 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>30-second AST analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <Boxes className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>Interactive graph viewer</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Zero code saved to disk</span>
          </div>
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span>No AI hallucinations</span>
          </div>
        </div>
      </div>

      {/* Right Auth Column */}
      <div className="relative flex flex-col justify-between p-6 sm:p-12">
        {/* Top Navbar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Arbor</span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Centered Sign-In Box */}
        <div className="mx-auto w-full max-w-md py-12 space-y-8">
          <div className="space-y-3 text-center sm:text-left">
            <div className="lg:hidden inline-flex justify-center mb-2">
              <Logo size="lg" showWordmark />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome to Arbor
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Connect your GitHub account to access your repositories, automated architectural audits, and health scoreboards.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">
            <Suspense fallback={null}>
              <GithubSignInButton configured={githubConfigured} />
            </Suspense>
          </div>

          <div className="text-center text-xs text-muted-foreground/80 space-y-1">
            <p>
              By continuing, you agree to Arbor&apos;s standard terms and privacy principles.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Single-developer workbench mode · Cloud PostgreSQL &amp; Redis
            </p>
          </div>
        </div>

        {/* Empty bottom spacer for symmetrical alignment */}
        <div className="hidden sm:block" />
      </div>
    </div>
  )
}