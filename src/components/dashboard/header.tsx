'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandMenu, CommandProject } from '@/components/dashboard/command-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from '@/components/dashboard/sidebar'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { Logo } from '@/components/ui/logo'

interface HeaderProps {
  projects?: CommandProject[]
  user?: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function Header({ projects = [], user }: HeaderProps) {
  const pathname = usePathname()
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Derive breadcrumb segments
  const segments = pathname.split('/').filter(Boolean)
  const isDashboard = pathname === '/dashboard' || segments.length === 0

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 sm:px-6 gap-3 sm:gap-6">
        {/* Left: Mobile hamburger & Dynamic Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="h-8 w-8 md:hidden text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}

          {/* Dynamic Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground font-medium"
            >
              <Logo size="xs" />
              <span className="font-semibold text-foreground">Arbor</span>
            </Link>

            {!isDashboard && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                {segments[0] === 'projects' && (
                  <Link
                    href="/projects"
                    className={segments.length === 1 ? 'text-foreground font-semibold' : 'hover:text-foreground'}
                  >
                    Projects
                  </Link>
                )}
                {segments[0] === 'projects' && segments[1] === 'new' && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="font-semibold text-foreground">New</span>
                  </>
                )}
                {segments[0] === 'projects' && segments[1] && segments[1] !== 'new' && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="font-mono font-semibold text-foreground truncate max-w-[120px] sm:max-w-[180px]">
                      {segments[1]}
                    </span>
                  </>
                )}
                {segments[0] === 'settings' && (
                  <span className="font-semibold text-foreground">Settings</span>
                )}
                {segments[0] === 'admin' && (
                  <span className="font-semibold text-foreground">Admin Panel</span>
                )}
              </>
            )}

            {isDashboard && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <span className="font-semibold text-foreground">Dashboard</span>
              </>
            )}
          </nav>
        </div>

        {/* Center: Search Command Trigger */}
        <div className="flex flex-1 items-center justify-center max-w-xs sm:max-w-sm md:max-w-md mx-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommandOpen(true)}
            className="h-8 w-full justify-between border-border/80 bg-muted/30 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Search repositories, findings...</span>
            </div>
            <kbd className="pointer-events-none hidden rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block shrink-0">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* Right: Actions (ThemeToggle + Settings Icon) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ThemeToggle />

          <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Settings">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

    {/* Mobile Navigation Drawer */}
    {user && (
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-card border-r border-border">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar
            user={user}
            projects={projects}
            onNavigate={() => setMobileNavOpen(false)}
            className="flex w-full h-full border-r-0"
          />
        </SheetContent>
      </Sheet>
    )}

    <CommandMenu
      open={commandOpen}
      onOpenChange={setCommandOpen}
      projects={projects}
    />
    </>
  )
}
