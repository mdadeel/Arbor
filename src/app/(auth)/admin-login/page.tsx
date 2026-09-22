import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { AdminSignInForm } from '@/components/auth/admin-sign-in-form'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'

export const metadata = {
  title: 'Admin Sign In — Arbor',
  description: 'Restricted admin portal sign-in for Arbor platform metrics and operations.',
  robots: { index: false },
}

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background text-foreground antialiased">
      {/* Top Navbar */}
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

      {/* Centered Auth Box */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <Link href="/" className="inline-flex items-center hover:opacity-85 transition-opacity">
              <Logo size="lg" showWordmark />
            </Link>
            <div className="space-y-1 pt-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[10px] font-mono font-medium mb-1">
                <ShieldCheck className="h-3 w-3" />
                <span>OPERATOR ACCESS</span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Admin Portal
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sign in with platform administrator credentials.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs space-y-5">
            <Suspense fallback={<div className="h-14 flex items-center justify-center text-xs text-muted-foreground">Loading admin form...</div>}>
              <AdminSignInForm />
            </Suspense>

            <div className="border-t border-border/60 pt-4 text-center">
              <p className="text-[11px] text-muted-foreground/70">
                Restricted area. All authentication attempts are logged.
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground/70">
            <span>Not an administrator? </span>
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline transition-colors"
            >
              Sign in with GitHub
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 py-5 text-center text-[11px] text-muted-foreground/40">
        Arbor · Automated Repository Intelligence
      </footer>
    </div>
  )
}