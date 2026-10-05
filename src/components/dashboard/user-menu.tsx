'use client'

import * as React from 'react'
import { signOut } from 'next-auth/react'
import { trpc } from '@/lib/trpc'
import { Building2, FileText, LogOut, Settings, Shield, User } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type AuthUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

interface MenuItem {
  label: string
  value?: string
  href: string
  icon: React.ReactNode
}

interface UserMenuProps {
  user: AuthUser
  /** Renders name/email inline next to the avatar (sidebar footer layout). */
  showDetails?: boolean
}

export function UserMenu({ user, showDetails = false }: UserMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const initial = (user.name ?? user.email ?? 'D')[0].toUpperCase()

  const { data: adminStatus } = trpc.admin.checkStatus.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  })

  const menuItems: MenuItem[] = [
    ...(adminStatus?.isAdmin
      ? [
          {
            label: 'Admin Panel',
            href: '/admin',
            icon: <Shield className="h-4 w-4 shrink-0 text-primary" />,
          },
        ]
      : []),
    {
      label: 'Profile & Settings',
      href: '/settings',
      icon: <Settings className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Workspaces & Team',
      href: '/settings?tab=workspaces',
      icon: <Building2 className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Integrations & AI',
      href: '/settings?tab=connections',
      icon: <User className="h-4 w-4 shrink-0" />,
    },
  ]

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <div className="group relative w-full">
        <DropdownMenuTrigger className="w-full outline-none focus-visible:ring-0 focus-visible:ring-transparent cursor-pointer">
          <div
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-150',
              'border-border/60 bg-muted/30 hover:border-border hover:bg-muted/70 hover:shadow-xs cursor-pointer',
              isOpen && 'border-border bg-muted/70 shadow-xs'
            )}
          >
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-full border border-border/80 bg-muted/40 p-0.5">
                <div className="h-full w-full overflow-hidden rounded-full bg-card">
                  <Avatar className="h-full w-full">
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={user.name ?? 'Avatar'}
                    />
                    <AvatarFallback className="bg-transparent text-xs font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
            {showDetails && (
              <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="truncate text-xs font-medium leading-tight tracking-tight text-foreground">
                  {user.name ?? 'Developer'}
                </span>
                <span className="max-w-[150px] truncate text-[10px] leading-tight tracking-tight text-muted-foreground">
                  {user.email}
                </span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>

        {/* Bending line indicator */}
        <div
          className={cn(
            'pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 transition-all duration-150',
            isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          )}
          aria-hidden="true"
        >
          <svg
            width="12"
            height="24"
            viewBox="0 0 12 24"
            fill="none"
            className={cn(
              'transition-all duration-150',
              isOpen ? 'scale-110 text-primary' : 'text-muted-foreground/50'
            )}
          >
            <path
              d="M2 4C6 8 6 16 2 20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg"
      >
        <div className="space-y-1">
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.label} asChild>
              <Link
                href={item.href}
                className="flex items-center rounded-lg border border-transparent p-2.5 text-xs transition-all duration-150 hover:border-border/60 hover:bg-accent/80 cursor-pointer"
              >
                <div className="flex flex-1 items-center gap-2.5">
                  {item.icon}
                  <span className="whitespace-nowrap text-xs font-medium text-foreground">
                    {item.label}
                  </span>
                </div>
                {item.value && (
                  <span className="ml-auto shrink-0 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-primary">
                    {item.value}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="my-1.5 bg-border" />

        <DropdownMenuItem
          className="group rounded-lg border border-transparent bg-destructive/10 p-2.5 text-xs transition-all duration-150 hover:border-destructive/30 hover:bg-destructive/20 cursor-pointer"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4 shrink-0 text-destructive group-hover:text-destructive" />
          <span className="ml-2 font-medium text-destructive">
            Sign Out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
