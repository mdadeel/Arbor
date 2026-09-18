'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  FolderGit2,
  Globe,
  Loader2,
  Network,
  Plus,
  Server,
  Trash2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProjectGroupRole } from '@prisma/client'

export default function NewSystemPage() {
  const router = useRouter()
  const projectsQuery = trpc.project.list.useQuery()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frontendProjectId, setFrontendProjectId] = useState<string>('')
  const [backendProjectId, setBackendProjectId] = useState<string>('')
  const [apiPrefix, setApiPrefix] = useState<string>('/api')
  const [error, setError] = useState<string | null>(null)

  const createSystem = trpc.system.create.useMutation({
    onSuccess: (newGroup) => {
      router.push(`/systems/${newGroup.slug}`)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const projects = projectsQuery.data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please provide a name for this system group.')
      return
    }

    if (!frontendProjectId || !backendProjectId) {
      setError('Please select both a Frontend and a Server repository.')
      return
    }

    if (frontendProjectId === backendProjectId) {
      setError('Frontend and Server must be different repositories.')
      return
    }

    createSystem.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      members: [
        {
          projectId: frontendProjectId,
          role: ProjectGroupRole.frontend,
          apiPrefix: apiPrefix.trim() || undefined,
        },
        {
          projectId: backendProjectId,
          role: ProjectGroupRole.backend,
        },
      ],
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="space-y-1">
        <Link
          href="/systems"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Systems</span>
        </Link>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Create Fullstack System Group
        </h1>
        <p className="text-xs text-muted-foreground">
          Group your frontend client and backend server repositories together to audit cross-service API contracts and fullstack architecture.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Group Details */}
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold">System Details</CardTitle>
            <CardDescription className="text-xs">
              Give your unified platform or fullstack product a name.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="groupName" className="text-xs font-medium">
                System Name
              </Label>
              <Input
                id="groupName"
                placeholder="e.g. eTuitionHub Platform, Acme Dashboard, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="groupDesc" className="text-xs font-medium">
                Description (Optional)
              </Label>
              <Input
                id="groupDesc"
                placeholder="e.g. Next.js web application paired with Express REST backend"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Member Repositories Assignment */}
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold">Repository Roles</CardTitle>
            <CardDescription className="text-xs">
              Assign member roles to your connected repositories.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Frontend / Client Role */}
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  1. Client / Frontend Repository
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The repository containing the user-facing UI, page components, and outbound API calls.
              </p>

              <Select value={frontendProjectId} onValueChange={setFrontendProjectId}>
                <SelectTrigger className="h-9 text-xs font-mono bg-card">
                  <SelectValue placeholder="Select client repository..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                      {p.name} ({p.repoFullName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Server / Backend Role */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Server className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  2. Server / Backend Repository
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The repository defining API routes, controllers, database models, and service business logic.
              </p>

              <Select value={backendProjectId} onValueChange={setBackendProjectId}>
                <SelectTrigger className="h-9 text-xs font-mono bg-card">
                  <SelectValue placeholder="Select server repository..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                      {p.name} ({p.repoFullName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Prefix Config */}
            <div className="pt-1 space-y-1.5">
              <Label htmlFor="apiPrefix" className="text-xs font-medium">
                API Base Path Prefix
              </Label>
              <Input
                id="apiPrefix"
                placeholder="/api or /v1"
                value={apiPrefix}
                onChange={(e) => setApiPrefix(e.target.value)}
                className="h-8 text-xs font-mono max-w-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Used to correlate frontend relative calls with backend route paths.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/systems">Cancel</Link>
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={createSystem.isPending || !name.trim() || !frontendProjectId || !backendProjectId}
            className="gap-1.5 text-xs font-medium"
          >
            {createSystem.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Network className="h-3.5 w-3.5" />
            )}
            <span>Create & Analyze System</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
