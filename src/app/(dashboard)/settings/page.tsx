import { redirect } from 'next/navigation'
import { Building2, CheckCircle2, Github, Shield, Sliders, Sparkles, User } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { githubConfigured } from '@/lib/env'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { WorkspaceSettings } from '@/components/dashboard/settings/workspace-settings'
import { AuditLogTimeline } from '@/components/dashboard/audit/audit-log-timeline'
import { AiSettings } from '@/components/dashboard/settings/ai-settings'
import { GitHubConnections } from '@/components/dashboard/settings/github-connections'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user
  const defaultTab = searchParams?.tab || 'profile'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Manage your developer profile, teams, security audit logs, and AI preferences.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="profile" className="text-xs gap-1.5">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="workspaces" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Workspaces & Team
          </TabsTrigger>
          <TabsTrigger value="connections" className="text-xs gap-1.5">
            <Github className="h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI Integrations (BYOK)
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            Engine Limits
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">User Profile</CardTitle>
              <CardDescription className="text-xs">
                Your personal account details retrieved from GitHub OAuth.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-border">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? 'User'} />
                  <AvatarFallback className="font-mono text-base font-semibold">
                    {user.name?.slice(0, 2).toUpperCase() ?? 'DH'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{user.name ?? 'Developer'}</p>
                  <p className="text-xs text-muted-foreground">{user.email ?? 'No public email'}</p>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Solo Developer Mode
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border border-border/80 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Arbor is configured with v2 multi-tenant workspaces enabled. Switch or invite teammates under the Workspaces tab.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspaces Tab */}
        <TabsContent value="workspaces" className="space-y-4">
          <WorkspaceSettings />
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <GitHubConnections />
        </TabsContent>

        {/* AI Integrations (BYOK) Tab */}
        <TabsContent value="ai" className="space-y-4">
          <AiSettings />
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <AuditLogTimeline />
        </TabsContent>

        {/* Engine Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">Analysis Engine Specifications</CardTitle>
              <CardDescription className="text-xs">
                Resource limits and AST parser parameters currently enforced.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-md border border-border/70 p-3 space-y-1">
                  <span className="text-muted-foreground">Concurrency</span>
                  <p className="font-mono font-semibold text-foreground">1 (CPU-bound AST parse)</p>
                </div>
                <div className="rounded-md border border-border/70 p-3 space-y-1">
                  <span className="text-muted-foreground">Analysis Timeout</span>
                  <p className="font-mono font-semibold text-foreground">5 minutes max</p>
                </div>
                <div className="rounded-md border border-border/70 p-3 space-y-1">
                  <span className="text-muted-foreground">Clone Timeout</span>
                  <p className="font-mono font-semibold text-foreground">60 seconds (depth=1)</p>
                </div>
                <div className="rounded-md border border-border/70 p-3 space-y-1">
                  <span className="text-muted-foreground">Max Repo Size</span>
                  <p className="font-mono font-semibold text-foreground">500 MB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
