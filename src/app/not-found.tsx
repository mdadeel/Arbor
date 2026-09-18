import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-gradient-to-b from-[#43637E]/20 via-[#65DCD5]/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-gradient-to-b from-[#321E48]/30 to-transparent blur-3xl"
      />

      <div className="relative space-y-6">
        <Logo size="lg" />

        <div className="space-y-3">
          <p className="font-mono text-sm font-semibold tracking-wider text-[#65DCD5]">
            404 — MODULE NOT FOUND
          </p>
          <h1 className="font-display text-6xl sm:text-7xl font-black tracking-tight text-foreground">
            Page not found
          </h1>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            The path you followed doesn&apos;t resolve to a module in the dependency graph.
            Let&apos;s route you back to known territory.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-7 gap-2 font-bold bg-[#65DCD5] text-[#1a0f26] hover:bg-[#321E48] hover:text-[#65DCD5] transition-all">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-7 font-semibold border border-[#43637E]/50 hover:border-[#65DCD5] bg-card hover:bg-[#65DCD5]/10 text-foreground hover:text-[#65DCD5] transition-all">
            <Link href="/dashboard">
              <span>Go to Dashboard</span>
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}