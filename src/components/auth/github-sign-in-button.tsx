'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { AlertCircle, AlertTriangle, ArrowRight, Github, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GithubSignInButton({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false)

  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const callbackUrl = searchParams.get('callbackUrl')

  const getErrorMessage = (err: string) => {
    switch (err) {
      case 'OAuthCallback':
        return 'GitHub authorization failed. Verify your Client Secret and Authorization Callback URL in GitHub Developer Settings.'
      case 'OAuthSignin':
      case 'OAuthCreateAccount':
        return 'Could not initialize GitHub account connection. Please try again.'
      case 'Callback':
        return 'Database error while establishing user session. Verify your DATABASE_URL connection in Vercel.'
      case 'Configuration':
        return 'Server configuration issue. Verify NEXTAUTH_SECRET and NEXTAUTH_URL are set.'
      case 'AccessDenied':
        return 'Sign-in access was denied.'
      default:
        return 'An error occurred during authentication. Please try again.'
    }
  }

  const handleSignIn = async () => {
    setLoading(true)
    try {
      await signIn('github', { callbackUrl: callbackUrl || '/dashboard' })
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300 space-y-1 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>Authentication Error</span>
          </div>
          <p className="text-[11px] text-red-200/90 leading-relaxed">
            {getErrorMessage(error)}
          </p>
        </div>
      )}

      {configured ? (
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-11 gap-2.5 font-medium text-sm transition-all"
            onClick={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            <span>Continue with GitHub</span>
            <ArrowRight className="h-4 w-4 ml-auto opacity-60" />
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Lock className="h-3 w-3" />
            <span>Read-only GitHub access · No code stored</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>GitHub OAuth Credentials Required</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Set <code className="font-mono text-foreground">GITHUB_CLIENT_ID</code> and{' '}
            <code className="font-mono text-foreground">GITHUB_CLIENT_SECRET</code> in your{' '}
            <code className="font-mono text-foreground">.env</code> file or environment variables.
          </p>
        </div>
      )}
    </div>
  )
}