'use client'

import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Star,
  Trash2,
} from 'lucide-react'
import { signIn } from 'next-auth/react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function GitHubConnections() {
  const utils = trpc.useUtils()
  const accountsQuery = trpc.github.listAccounts.useQuery()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<Record<string, { valid: boolean; message?: string }>>({})

  const addAccountMutation = trpc.github.addAccount.useMutation({
    onSuccess: () => {
      utils.github.listAccounts.invalidate()
      utils.github.listRepos.invalidate()
      setIsAddOpen(false)
      setTokenInput('')
      setLabelInput('')
      setFormError(null)
    },
    onError: (err) => {
      setFormError(err.message)
    },
  })

  const removeAccountMutation = trpc.github.removeAccount.useMutation({
    onSuccess: () => {
      utils.github.listAccounts.invalidate()
      utils.github.listRepos.invalidate()
    },
  })

  const setDefaultMutation = trpc.github.setDefault.useMutation({
    onSuccess: () => {
      utils.github.listAccounts.invalidate()
      utils.github.listRepos.invalidate()
    },
  })

  const checkHealthMutation = trpc.github.checkHealth.useMutation({
    onSuccess: (data, variables) => {
      setHealthStatus((prev) => ({
        ...prev,
        [variables.accountId]: {
          valid: data.valid,
          message: data.valid
            ? `Verified (@${data.username})`
            : data.error ?? 'Connection failed',
        },
      }))
    },
  })

  const disconnectAllMutation = trpc.github.disconnectAll.useMutation({
    onSuccess: () => {
      utils.github.listAccounts.invalidate()
      utils.github.listRepos.invalidate()
    },
  })

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!tokenInput.trim()) {
      setFormError('Personal access token is required')
      return
    }
    addAccountMutation.mutate({
      token: tokenInput.trim(),
      accountName: labelInput.trim() || undefined,
    })
  }

  const accounts = accountsQuery.data ?? []

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Github className="h-4 w-4 text-foreground" />
              GitHub Accounts & Integrations
            </CardTitle>
            <CardDescription className="text-xs">
              Manage connected GitHub identities, Personal Access Tokens, and repository access.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="text-xs h-8 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Connect Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Connect GitHub Account
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Add a GitHub account using a Personal Access Token (PAT) or re-authenticate via OAuth.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="accountName" className="text-xs font-medium">
                      Account Label (Optional)
                    </Label>
                    <Input
                      id="accountName"
                      placeholder="e.g. Work, Personal, or Org Name"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="patToken" className="text-xs font-medium">
                      Personal Access Token (PAT)
                    </Label>
                    <div className="relative">
                      <Input
                        id="patToken"
                        type={showToken ? 'text' : 'password'}
                        placeholder="ghp_... or github_pat_..."
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        className="h-8 pr-9 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Requires <code className="font-mono text-[10px]">repo</code> and{' '}
                      <code className="font-mono text-[10px]">read:user</code> scopes. Tokens are encrypted using
                      AES-256-GCM.
                    </p>
                  </div>

                  {formError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="rounded-md border border-border/70 bg-muted/20 p-2.5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[11px]">Need to create a token?</span>
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=DevHub"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        Generate on GitHub
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => signIn('github', { callbackUrl: '/settings' })}
                      className="text-xs h-8 mr-auto"
                    >
                      <Github className="h-3.5 w-3.5 mr-1.5" />
                      Sign in with OAuth
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addAccountMutation.isPending}
                      className="text-xs h-8 gap-1.5"
                    >
                      {addAccountMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Validate & Connect
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {accounts.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm('Disconnect all GitHub accounts? Connected repositories will lose live sync.')) {
                    disconnectAllMutation.mutate()
                  }
                }}
                disabled={disconnectAllMutation.isPending}
                className="text-xs h-8 text-muted-foreground hover:text-destructive"
              >
                Disconnect All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {accountsQuery.isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2 text-primary" />
            Loading connected accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Github className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">No GitHub Accounts Connected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your personal or organization GitHub accounts to browse and audit repositories.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="text-xs h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Connect with PAT or OAuth
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const health = healthStatus[acc.id]
              const isChecking = checkHealthMutation.isPending && checkHealthMutation.variables?.accountId === acc.id

              return (
                <div
                  key={acc.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
                    acc.isDefault
                      ? 'border-primary/50 bg-primary/[0.02]'
                      : 'border-border hover:bg-card/70'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 border border-border shrink-0">
                      <AvatarImage src={acc.avatarUrl ?? undefined} alt={acc.username} />
                      <AvatarFallback className="font-mono text-xs font-bold">
                        {acc.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          @{acc.username}
                        </span>
                        {acc.accountName && (
                          <span className="text-[11px] text-muted-foreground">
                            ({acc.accountName})
                          </span>
                        )}
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {acc.tokenType}
                        </Badge>
                        {acc.isDefault && (
                          <Badge variant="secondary" className="text-[10px] gap-1 font-medium bg-primary/10 text-primary border-primary/20">
                            <Star className="h-2.5 w-2.5 fill-primary" />
                            Default
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {health ? (
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              health.valid ? 'text-emerald-400' : 'text-destructive'
                            }`}
                          >
                            {health.valid ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {health.message}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Connected
                          </span>
                        )}
                        {acc.scope && (
                          <span className="font-mono text-[10px] truncate max-w-[200px]">
                            Scopes: {acc.scope}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!acc.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDefaultMutation.mutate({ accountId: acc.id })}
                        disabled={setDefaultMutation.isPending}
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                      >
                        Set Default
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => checkHealthMutation.mutate({ accountId: acc.id })}
                      disabled={isChecking}
                      className="text-xs h-7 gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                      Test
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Disconnect @${acc.username}?`)) {
                          removeAccountMutation.mutate({ accountId: acc.id })
                        }
                      }}
                      disabled={removeAccountMutation.isPending}
                      className="text-xs h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-md border border-border/70 bg-card p-3 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <p>
            All OAuth tokens and Personal Access Tokens are encrypted using AES-256-GCM. Tokens are used solely to fetch repositories and perform shallow clones for automated audits.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
