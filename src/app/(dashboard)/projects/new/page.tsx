'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  GitFork,
  Github,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { GitHubRepo } from '@/server/services/github'

export default function NewProjectPage() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [query, setQuery] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  // Accounts query
  const accounts = trpc.github.listAccounts.useQuery()

  // Selected account or default
  const activeAccountId =
    selectedAccountId ??
    accounts.data?.find((a) => a.isDefault)?.id ??
    accounts.data?.[0]?.id

  // Repos query parameterized by activeAccountId
  const repos = trpc.github.listRepos.useQuery(
    { accountId: activeAccountId },
    { enabled: Boolean(accounts.data && accounts.data.length > 0) }
  )

  const create = trpc.project.create.useMutation({
    onSuccess: (project) => router.push(`/projects/${project.slug}`),
  })

  const [error, setError] = useState<string | null>(null)
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)

  // Quick connect PAT modal
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [patToken, setPatToken] = useState('')
  const [patLabel, setPatLabel] = useState('')
  const [showPat, setShowPat] = useState(false)
  const [patError, setPatError] = useState<string | null>(null)

  const addAccountMutation = trpc.github.addAccount.useMutation({
    onSuccess: (newAcc) => {
      utils.github.listAccounts.invalidate()
      utils.github.listRepos.invalidate()
      setSelectedAccountId(newAcc.id)
      setIsConnectModalOpen(false)
      setPatToken('')
      setPatLabel('')
      setPatError(null)
    },
    onError: (err) => {
      setPatError(err.message)
    },
  })

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return (repos.data ?? []).filter(
      (r) => r.name.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q)
    )
  }, [repos.data, query])

  async function addRepo(repo: GitHubRepo) {
    setError(null)
    setSelectedRepoId(repo.id)
    create.mutate(
      {
        name: repo.name,
        description: repo.description ?? undefined,
        repoFullName: repo.fullName,
        repoUrl: repo.url,
        defaultBranch: repo.defaultBranch,
        repoPrivate: repo.private,
      },
      {
        onError: (e) => {
          setError(e.message)
          setSelectedRepoId(null)
        },
      }
    )
  }

  const handleQuickConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPatError(null)
    if (!patToken.trim()) {
      setPatError('Access token is required')
      return
    }
    addAccountMutation.mutate({
      token: patToken.trim(),
      accountName: patLabel.trim() || undefined,
    })
  }

  const activeAccount = accounts.data?.find((a) => a.id === activeAccountId)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Projects</span>
          </Link>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Connect a Repository
          </h1>
          <p className="text-xs text-muted-foreground">
            Select a GitHub repository to add to your DevHub workspace for automated audits.
          </p>
        </div>

        {/* Account Selector */}
        {accounts.data && accounts.data.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">Account:</span>
            <Select
              value={activeAccountId ?? ''}
              onValueChange={(val) => {
                if (val === '__add_new__') {
                  setIsConnectModalOpen(true)
                } else {
                  setSelectedAccountId(val)
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs font-mono w-[200px]">
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.data.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} className="text-xs font-mono">
                    @{acc.username} {acc.accountName ? `(${acc.accountName})` : ''} {acc.isDefault ? '★' : ''}
                  </SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-xs text-primary font-medium">
                  + Add another GitHub account
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Quick Connect Token Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Connect GitHub Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter a GitHub Personal Access Token (PAT) with repository permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickConnectSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="quickAccountLabel" className="text-xs font-medium">
                Account Label (Optional)
              </Label>
              <Input
                id="quickAccountLabel"
                placeholder="e.g. Work, Personal, or Org Name"
                value={patLabel}
                onChange={(e) => setPatLabel(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quickPatToken" className="text-xs font-medium">
                Personal Access Token (PAT)
              </Label>
              <div className="relative">
                <Input
                  id="quickPatToken"
                  type={showPat ? 'text' : 'password'}
                  placeholder="ghp_... or github_pat_..."
                  value={patToken}
                  onChange={(e) => setPatToken(e.target.value)}
                  className="h-8 pr-9 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPat(!showPat)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPat ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Requires <code className="font-mono text-[10px]">repo</code> and{' '}
                <code className="font-mono text-[10px]">read:user</code> scopes. Encrypted with AES-256-GCM.
              </p>
            </div>

            {patError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{patError}</span>
              </div>
            )}

            <div className="rounded-md border border-border/70 bg-muted/20 p-2.5 text-xs flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Generate a token on GitHub:</span>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=DevHub"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                Create token
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConnectModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories by name..."
            className="h-9 pl-9 text-xs"
          />
        </div>

        {repos.data && (
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} of {repos.data.length} repos
            {activeAccount ? ` (@${activeAccount.username})` : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* No Accounts Connected State */}
      {!accounts.isLoading && (!accounts.data || accounts.data.length === 0) && (
        <Card className="border-border">
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Github className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No GitHub Account Connected</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Please connect your GitHub account using a Personal Access Token or re-authenticate via OAuth.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => setIsConnectModalOpen(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Key className="h-3.5 w-3.5" />
                Connect with Token
              </Button>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="text-xs h-8">
                  Open Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repos Loading Skeleton */}
      {repos.isLoading && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Repos Error / Token Expired State */}
      {repos.isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Unable to Fetch Repositories
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {repos.error?.message ?? 'GitHub token is expired, invalid, or permissions are insufficient.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => setIsConnectModalOpen(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Key className="h-3.5 w-3.5" />
                Update Access Token
              </Button>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="text-xs h-8">
                  Manage in Settings
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => repos.refetch()}
                className="text-xs h-8 gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty Filter State */}
      {repos.data && filtered.length === 0 && (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No repositories found matching &quot;{query}&quot;.
        </div>
      )}

      {/* Repositories List */}
      <div className="space-y-2">
        {filtered.map((repo) => {
          const isPending = create.isPending && selectedRepoId === repo.id

          return (
            <Card
              key={repo.id}
              className="border-border/80 transition-colors hover:border-border hover:bg-card/70"
            >
              <CardHeader className="flex-row items-center justify-between space-y-0 p-3.5">
                <div className="min-w-0 pr-4">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold">
                    <GitFork className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono">{repo.fullName}</span>
                    {repo.private && (
                      <Badge variant="outline" className="text-[10px] gap-1 py-0 h-4 font-normal">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Private
                      </Badge>
                    )}
                  </CardTitle>
                  {repo.description && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{repo.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                    {repo.language && <span>{repo.language}</span>}
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.defaultBranch}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={create.isPending}
                  onClick={() => addRepo(repo)}
                  className="h-8 shrink-0 text-xs gap-1.5 px-3"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>Connect</span>
                </Button>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}