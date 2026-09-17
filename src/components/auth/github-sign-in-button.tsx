'use client'

import { signIn } from 'next-auth/react'
import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function GithubSignInButton({ configured }: { configured: boolean }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 h-10 w-10 rounded-lg bg-primary" />
        <CardTitle>DevHub</CardTitle>
        <CardDescription>
          Connect your GitHub account to get a full audit of your repositories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {configured ? (
          <Button className="w-full" onClick={() => signIn('github', { callbackUrl: '/dashboard' })}>
            <Github className="h-4 w-4" />
            Sign in with GitHub
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            GitHub OAuth is not configured yet. Set <code className="font-mono">GITHUB_CLIENT_ID</code>{' '}
            and <code className="font-mono">GITHUB_CLIENT_SECRET</code> in <code className="font-mono">.env</code>,
            then restart the server.
          </p>
        )}
      </CardContent>
    </Card>
  )
}