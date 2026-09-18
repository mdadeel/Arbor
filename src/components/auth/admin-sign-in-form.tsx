'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ArrowRight, KeyRound, Loader2, Lock, Shield, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AdminSignInForm() {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await signIn('credentials', {
        redirect: false,
        username: username.trim(),
        password: password.trim(),
        callbackUrl: callbackUrl || '/admin',
      })

      if (res?.error) {
        setError('Invalid admin credentials. Please enter valid username & password.')
        setLoading(false)
      } else {
        window.location.href = res?.url || '/admin'
      }
    } catch {
      setError('An unexpected error occurred during admin sign-in.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
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
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Admin username"
            disabled={loading}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#65DCD5] disabled:opacity-50"
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            disabled={loading}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#65DCD5] disabled:opacity-50"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-sm gap-2 font-bold bg-[#65DCD5] text-[#1a0f26] hover:bg-[#321E48] hover:text-[#65DCD5] transition-all"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verifying credentials...</span>
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" />
            <span>Sign In to Admin Portal</span>
            <ArrowRight className="h-4 w-4 ml-auto opacity-70" />
          </>
        )}
      </Button>
    </form>
  )
}