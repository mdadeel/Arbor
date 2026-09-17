import { githubConfigured } from '@/lib/env'
import { GithubSignInButton } from '@/components/auth/github-sign-in-button'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <GithubSignInButton configured={githubConfigured} />
    </main>
  )
}