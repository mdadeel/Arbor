'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, GitFork, Loader2, Search, ShieldCheck } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { GitHubRepo } from '@/server/services/github'

export default function NewProjectPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const repos = trpc.github.listRepos.useQuery()
  const create = trpc.project.create.useMutation({
    onSuccess: (project) => router.push(`/projects/${project.slug}`),
  })
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return (repos.data ?? []).filter(
      (r) => r.name.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q)
    )
  }, [repos.data, query])

  async function addRepo(repo: GitHubRepo) {
    setError(null)
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
        onError: (e) => setError(e.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Add a project</h1>
        <p className="text-sm text-muted-foreground">
          Pick a GitHub repository to add to your workspace.
        </p>
      </div>

      <div className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories..."
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {repos.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {repos.isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Could not load repositories. Make sure your GitHub account is connected.
          </CardContent>
        </Card>
      )}

      {repos.data && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No repositories match &quot;{query}&quot;.
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((repo) => (
          <Card key={repo.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <GitFork className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono">{repo.fullName}</span>
                  {repo.private && (
                    <Badge variant="outline">
                      <ShieldCheck className="h-3 w-3" />
                      Private
                    </Badge>
                  )}
                </CardTitle>
                {repo.description && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{repo.description}</p>
                )}
                <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{repo.language ?? 'Unknown'}</span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {repo.defaultBranch}
                  </span>
                </p>
              </div>
              <Button
                size="sm"
                disabled={create.isPending}
                onClick={() => addRepo(repo)}
                className="shrink-0"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}