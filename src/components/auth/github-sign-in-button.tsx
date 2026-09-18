'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Github,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GithubSignInButton({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [username, setUsername] = useState('adeel')
  const [password, setPassword] = useState('')
  const [adminError, setAdminError] = useState<string | null>(null)

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

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminLoading(true)
    setAdminError(null)

    try {
      const res = await signIn('credentials', {
        redirect: false,
        username: username.trim(),
        password: password.trim(),
        callbackUrl: callbackUrl || '/admin',
      })

      if (res?.error) {
        setAdminError('Invalid admin credentials. Please enter valid username & password.')
        setAdminLoading(false)
      } else {
        window.location.href = res?.url || '/admin'
      }
    } catch {
      setAdminError('An unexpected error occurred during admin sign-in.')
      setAdminLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>Authentication Error</span>
          </div>
          <p className="text-[11px] text-red-200/90 leading-relaxed">
            {getErrorMessage(error)}
          </p>
        </div>
      )}

      {/* Primary OAuth Button */}
      {configured ? (
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-12 gap-3 font-semibold text-sm shadow-xl shadow-primary/10 transition-all hover:shadow-primary/20"
            onClick={handleSignIn}
            disabled={loading || adminLoading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            <span>Continue with GitHub</span>
            <ArrowRight className="h-4 w-4 ml-auto opacity-70" />
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
            <Lock className="h-3 w-3 text-emerald-400" />
            <span>Read-only user profile &amp; repository clone access</span>
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
            <code className="font-mono text-foreground">.env</code> file or Vercel dashboard.
          </p>
        </div>
      )}

      {/* Admin Credentials Divider */}
      <div className="relative flex items-center justify-center my-4">
        <div className="border-t border-border w-full" />
        <span className="bg-card px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-[#65DCD5]" /> Or Admin Sign In
        </span>
        <div className="border-t border-border w-full" />
      </div>

      {/* Admin Credentials Form */}
      <form onSubmit={handleAdminSignIn} className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <KeyRound className="h-3.5 w-3.5 text-[#65DCD5]" />
            <span>Admin Portal Login</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">Credentials</span>
        </div>

        {adminError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
            {adminError}
          </div>
        )}

        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Username</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              disabled={adminLoading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65DCD5] disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              <span>Password</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={adminLoading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65DCD5] disabled:opacity-50"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={adminLoading || loading}
          className="w-full h-10 font-bold text-xs gap-2 bg-[#65DCD5] text-[#1a0f26] hover:bg-[#321E48] hover:text-[#65DCD5] transition-all shadow-sm"
        >
          {adminLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Verifying credentials...</span>
            </>
          ) : (
            <>
              <Shield className="h-3.5 w-3.5" />
              <span>Sign In as Admin</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-70" />
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>Zero repository code stored · Ephemeral AST clones</span>
      </div>
    </div>
  )
}