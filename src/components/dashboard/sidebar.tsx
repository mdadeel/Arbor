'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  FolderGit2,
  LayoutDashboard,
  Plus,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { CommandProject } from '@/components/dashboard/command-menu'
import { UserMenu } from '@/components/dashboard/user-menu'

interface SidebarProps {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  projects?: CommandProject[]
  className?: string
  onNavigate?: () => void
}

const GLOBAL_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderGit2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ user, projects = [], className, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  // Determine if we are inside a specific project
  const match = pathname.match(/^\/projects\/([^/]+)/)
  const isInsideProject = Boolean(match && match[1] !== 'new')
  const currentSlug = isInsideProject && match ? match[1] : null
  const currentProject = projects.find((p) => p.slug === currentSlug)

  const handleLinkClick = () => {
    onNavigate?.()
  }

  return (
    <aside className={cn('flex w-60 shrink-0 flex-col border-r border-border bg-card/40', className)}>
        {/* Logo header */}
        <div className="flex h-12 items-center border-b border-border px-4">
          <Link href="/dashboard" onClick={handleLinkClick} className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary font-mono text-[11px] font-bold text-primary-foreground">
              D
            </div>
            <span className="font-display text-sm font-semibold tracking-tight">
              DevHub
            </span>
          </Link>
        </div>

        {/* Navigation Content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-3">
          {isInsideProject ? (
            /* Context-Aware: Inside Project */
            <div className="space-y-4">
              <div>
                <Link
                  href="/projects"
                  onClick={handleLinkClick}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>All Projects</span>
                </Link>
              </div>

              {/* Current Project Card in Sidebar */}
              <div className="rounded-md border border-border/80 bg-accent/30 p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-xs text-foreground truncate">
                    {currentProject?.name ?? currentSlug}
                  </span>
                  {currentProject && (
                    <ScoreBadge
                      score={
                        (currentProject.latestScores as { overall?: number } | null)
                          ?.overall
                      }
                      size="sm"
                    />
                  )}
                </div>
                {currentProject?.repoFullName && (
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {currentProject.repoFullName}
                  </p>
                )}
              </div>

              {/* Other Projects for Fast Switching */}
              {projects.filter((p) => p.slug !== currentSlug).length > 0 && (
                <div className="pt-2">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Other Projects
                  </div>
                  <nav className="mt-1 space-y-0.5">
                    {projects
                      .filter((p) => p.slug !== currentSlug)
                      .slice(0, 6)
                      .map((p) => {
                        const scores = p.latestScores as { overall?: number } | null
                        return (
                          <Link
                            key={p.id}
                            href={`/projects/${p.slug}`}
                            onClick={handleLinkClick}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <span className="truncate">{p.name}</span>
                            <ScoreBadge score={scores?.overall} size="sm" />
                          </Link>
                        )
                      })}
                  </nav>
                </div>
              )}
            </div>
          ) : (
            /* Global View Navigation */
            <div className="space-y-5">
              <nav className="space-y-1">
                {GLOBAL_NAV.map((item) => {
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-accent font-semibold text-accent-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Projects Quick Access */}
              <div>
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Projects</span>
                  <Link
                    href="/projects/new"
                    onClick={handleLinkClick}
                    className="text-muted-foreground hover:text-foreground"
                    title="Add project"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <nav className="mt-1 space-y-0.5">
                  {projects.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground">
                      No projects connected yet.
                    </p>
                  ) : (
                    projects.slice(0, 8).map((p) => {
                      const isActive = pathname === `/projects/${p.slug}`
                      const scores = p.latestScores as { overall?: number } | null

                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.slug}`}
                          onClick={handleLinkClick}
                          className={cn(
                            'flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                            isActive && 'bg-accent font-medium text-accent-foreground'
                          )}
                        >
                          <span className="truncate">{p.name}</span>
                          <ScoreBadge score={scores?.overall} size="sm" />
                        </Link>
                      )
                    })
                  )}
                </nav>
              </div>
            </div>
          )}
        </div>

        {/* Footer: user menu (avatar with settings + sign out) */}
        <div className="border-t border-border p-3">
          <UserMenu user={user} showDetails />
        </div>
      </aside>
  )
}
