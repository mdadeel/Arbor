import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, ArrowRight, Boxes, KeyRound, ShieldCheck, Terminal, UserCog } from 'lucide-react'
import { AdminSignInForm } from '@/components/auth/admin-sign-in-form'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'

export const metadata = {
  title: 'Admin Sign In — Arbor',
  description: 'Restricted admin portal sign-in for Arbor platform metrics and operations.',
  robots: { index: false },
}

const adminPowers = [
  { icon: UserCog, label: 'Platform metrics & KPIs' },
  { icon: Boxes, label: 'Early access waitlist' },
  { icon: Terminal, label: 'User & system directory' },
]

export default function AdminLoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#321E48]/40 to-transparent blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#65DCD5]/10 to-transparent blur-[120px]" />

      {/* Top Navbar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Arbor</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Centered Auth Box */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#65DCD5]/30 bg-[#65DCD5]/10 text-[#65DCD5] shadow-lg shadow-[#65DCD5]/10">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Admin Portal
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
                Restricted access for Arbor platform operations. Authorized administrators only.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold text-foreground">Operator Sign In</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#65DCD5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#65DCD5] border border-[#65DCD5]/20">
                <ShieldCheck className="h-3 w-3" /> Credentials
              </span>
            </div>

            <Suspense fallback={null}>
              <AdminSignInForm />
            </Suspense>

            <div className="grid gap-1.5 border-t border-border pt-4">
              {adminPowers.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-[#65DCD5] shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground/80 space-y-2">
            <p>Not an administrator?</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-semibold text-[#65DCD5] hover:text-[#321E48] dark:hover:text-[#D9FFF4] transition-colors"
            >
              Sign in with GitHub as a user
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <div className="pt-1">
              <Logo size="sm" showWordmark className="mx-auto opacity-70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}