'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  FolderGit2,
  LayoutDashboard,
  Network,
  Plus,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreBadge } from '@/components/dashboard/score-badge'
import { CommandProject } from '@/components/dashboard/command-menu'
import { UserMenu } from '@/components/dashboard/user-menu'

import { Logo } from '@/components/ui/logo'

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
  { href: '/systems', label: 'Systems', icon: Network },
  { href: '/admin', label: 'Admin Panel', icon: Shield },
]

export function Sidebar({ user, projects = [], className, onNavigate }: SidebarProps) {
  const pathname = usePathname()

  // Deduplicate projects by ID to guarantee unique React keys across renders
  const uniqueProjects = Array.from(new Map(projects.map((p) => [p.id, p])).values())

  // Determine if we are inside a specific project
  const match = pathname.match(/^\/projects\/([^/]+)/)
  const isInsideProject = Boolean(match && match[1] !== 'new')
  const currentSlug = isInsideProject && match ? match[1] : null
  const currentProject = uniqueProjects.find((p) => p.slug === currentSlug)

  const handleLinkClick = () => {
    onNavigate?.()
  }

  return (
    <aside
      suppressHydrationWarning
      className={cn(
        'sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-md overflow-hidden text-foreground select-none',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <Link href="/" onClick={handleLinkClick} className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <Logo size="sm" showWordmark />
        </Link>
      </div>

      {/* Navigation Content */}
      <div className="flex flex-1 flex-col overflow-y-auto p-3 min-h-0 space-y-4">
        {/* Global Navigation Links (Always Accessible) */}
        <nav className="space-y-1">
          {GLOBAL_NAV.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : item.href === '/projects'
                  ? pathname === '/projects' || (!isInsideProject && pathname.startsWith('/projects'))
                  : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-label-secondary transition-all duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-label-primary cursor-pointer active:scale-[0.98]',
                  isActive &&
                    'bg-primary text-primary-foreground font-semibold shadow-[0_1px_3px_rgba(0,122,255,0.3),inset_0_0.5px_0_rgba(255,255,255,0.3)] hover:bg-primary/90 hover:text-primary-foreground'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-foreground' : 'text-label-tertiary')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {isInsideProject ? (
          /* Context-Aware: Inside Project */
          <div className="space-y-4 border-t border-border pt-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                Active Project
              </span>
              <Link
                href="/projects"
                onClick={handleLinkClick}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Back</span>
              </Link>
            </div>

            {/* Current Project Card in Sidebar (Clickable to jump to project root) */}
            <Link
              href={`/projects/${currentSlug}`}
              onClick={handleLinkClick}
              className="group block rounded-lg border border-border bg-secondary/70 p-2.5 shadow-xs transition-all duration-150 hover:bg-secondary hover:border-border-strong cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-semibold text-xs text-label-primary group-hover:text-primary transition-colors truncate">
                  {currentProject?.name ?? currentSlug}
                </span>
                {currentProject && (
                  <ScoreBadge
                    score={
                      (currentProject.latestScores as { overall?: number } | null)?.overall ??
                      (currentProject.healthData as { score?: number } | null)?.score
                    }
                    size="sm"
                  />
                )}
              </div>
              {currentProject?.repoFullName && (
                <p className="mt-1 truncate font-mono text-[10px] text-label-tertiary">
                  {currentProject.repoFullName}
                </p>
              )}
            </Link>

            {/* Other Projects for Fast Switching */}
            {projects.filter((p) => p.slug !== currentSlug).length > 0 && (
              <div className="pt-1">
                <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                  Switch Project
                </div>
                <nav className="mt-1 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {uniqueProjects
                    .filter((p) => p.slug !== currentSlug)
                    .map((p) => {
                      const scores = p.latestScores as { overall?: number } | null
                      const health = p.healthData as { score?: number } | null
                      const effectiveScore = scores?.overall ?? health?.score
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.slug}`}
                          onClick={handleLinkClick}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-label-secondary transition-all duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-label-primary cursor-pointer active:scale-[0.98]"
                        >
                          <span className="truncate">{p.name}</span>
                          <ScoreBadge score={effectiveScore} size="sm" />
                        </Link>
                      )
                    })}
                </nav>
              </div>
            )}
          </div>
        ) : (
          /* Global View: Projects List */
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
              <span>Projects</span>
              <Link
                href="/projects/new"
                onClick={handleLinkClick}
                className="p-1 rounded-md text-label-tertiary hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-label-primary transition-colors cursor-pointer"
                title="Add project"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </div>

            <nav className="mt-1 space-y-1">
              {uniqueProjects.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-label-tertiary">
                  No projects connected yet.
                </p>
              ) : (
                uniqueProjects.slice(0, 8).map((p) => {
                  const isActive = pathname === `/projects/${p.slug}`
                  const scores = p.latestScores as { overall?: number } | null
                  const health = p.healthData as { score?: number } | null
                  const effectiveScore = scores?.overall ?? health?.score

                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.slug}`}
                      onClick={handleLinkClick}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-label-secondary transition-all duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-label-primary cursor-pointer active:scale-[0.98]',
                        isActive &&
                          'bg-primary text-primary-foreground font-semibold shadow-[0_1px_3px_rgba(0,122,255,0.3)] hover:bg-primary/90 hover:text-primary-foreground'
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                      <ScoreBadge score={effectiveScore} size="sm" />
                    </Link>
                  )
                })
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Footer: user menu (avatar with settings + sign out) */}
      <div className="border-t border-border p-3 shrink-0">
        <UserMenu user={user} showDetails />
      </div>
    </aside>
  )
}
