'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ArrowUpRight, LayoutDashboard, LogOut, Shield } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AdminNavbarProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  counts?: {
    users?: number
    waitlist?: number
    emails?: number
    workspaces?: number
  }
}

export function AdminNavbar({ user, counts }: AdminNavbarProps) {
  const pathname = usePathname()

  const navLinks = [
    { href: '/admin', label: 'Overview', exact: true },
    {
      href: '/admin/users',
      label: counts?.users !== undefined ? `Users (${counts.users})` : 'Users',
      exact: false,
    },
    {
      href: '/admin/workspaces',
      label: counts?.workspaces !== undefined ? `Workspaces (${counts.workspaces})` : 'Workspaces',
      exact: false,
    },
    {
      href: '/admin/waitlist',
      label: counts?.waitlist !== undefined ? `Waitlist (${counts.waitlist})` : 'Waitlist',
      exact: false,
    },
    {
      href: '/admin/audit',
      label: 'Audit Trail',
      exact: false,
    },
    {
      href: '/admin/emails',
      label: counts?.emails !== undefined ? `Broadcasts (${counts.emails})` : 'Broadcasts',
      exact: false,
    },
    {
      href: '/admin/roles',
      label: 'Roles & Permissions',
      exact: false,
    },
    { href: '/admin/system', label: 'System & Controls', exact: false },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Left: Brand + Admin Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/admin" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <Logo size="sm" showWordmark />
          </Link>
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
            <Shield className="h-3 w-3" />
            ADMIN
          </span>
        </div>

        {/* Center: Top Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
          {navLinks.map((link) => {
            const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: Actions & User Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Switch to Developer Dashboard */}
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium border-border/80">
            <Link href="/dashboard">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">User Dashboard</span>
              <span className="sm:hidden">App</span>
            </Link>
          </Button>

          <ThemeToggle />

          {/* Admin User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="h-8 w-8 border border-border">
                  {user.image && <AvatarImage src={user.image} alt={user.name || 'Admin'} />}
                  <AvatarFallback className="text-[11px] font-semibold bg-muted">
                    {(user.name || user.email || 'A').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <DropdownMenuLabel className="font-normal py-2">
                <div className="font-semibold text-foreground truncate">{user.name || 'Administrator'}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                  <span>Go to User Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/" className="cursor-pointer">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-2" />
                  <span>Public Landing Page</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-500 focus:text-red-500"
                onClick={() => signOut({ callbackUrl: '/admin-login' })}
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
