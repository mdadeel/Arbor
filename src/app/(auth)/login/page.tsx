import { githubConfigured } from '@/lib/env'
import { GithubSignInButton } from '@/components/auth/github-sign-in-button'

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      {/* Subtle radial ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="relative z-10 w-full flex justify-center">
        <GithubSignInButton configured={githubConfigured} />
      </div>
    </main>
  )
}