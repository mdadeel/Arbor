'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Code2,
  FileCode,
  Github,
  Loader2,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GithubSignInButton({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    try {
      await signIn('github', { callbackUrl: '/dashboard' })
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25 font-mono text-xl font-bold text-primary-foreground">
          D
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Welcome to DevHub
        </h1>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          The developer portal that automatically understands your codebase. Zero configuration, deterministic AST analysis.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-6 shadow-xl backdrop-blur-sm space-y-5">
        {/* Value props */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>30s repo audits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Architecture graphs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Secret & debt checks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Environment matrix</span>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          {configured ? (
            <Button
              className="w-full h-10 gap-2.5 font-medium text-xs shadow-md"
              onClick={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              <span>Continue with GitHub</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-70" />
            </Button>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>GitHub OAuth required</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Set <code className="font-mono text-foreground">GITHUB_CLIENT_ID</code> and{' '}
                <code className="font-mono text-foreground">GITHUB_CLIENT_SECRET</code> in your{' '}
                <code className="font-mono text-foreground">.env</code> file, then restart DevHub.
              </p>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-muted-foreground/80">
          Single-developer workbench mode · Local PostgreSQL & Redis
        </div>
      </div>
    </div>
  )
}