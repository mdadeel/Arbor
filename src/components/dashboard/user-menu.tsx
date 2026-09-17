'use client'

import * as React from 'react'
import { signOut } from 'next-auth/react'
import { FileText, LogOut, Settings, User } from 'lucide-react'
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

  const menuItems: MenuItem[] = [
    {
      label: 'Profile',
      href: '/settings/profile',
      icon: <User className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: <Settings className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Terms & Policies',
      href: '/settings',
      icon: <FileText className="h-4 w-4 shrink-0" />,
    },
  ]

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <div className="group relative w-full">
        <DropdownMenuTrigger className="w-full outline-none focus-visible:ring-0 focus-visible:ring-transparent">
          <div
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-200',
              'border-border/60 bg-muted/30 hover:border-border hover:bg-muted/60 hover:shadow-sm',
              isOpen && 'border-border bg-muted/60 shadow-sm'
            )}
          >
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
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
            'pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 transition-all duration-200',
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
              'transition-all duration-200',
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
        className="w-64 rounded-2xl border-border/60 p-2 shadow-xl shadow-zinc-900/5"
      >
        <div className="space-y-1">
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.label} asChild>
              <Link
                href={item.href}
                className="flex items-center rounded-xl border border-transparent p-3 transition-all duration-200 hover:border-border/50 hover:bg-accent/80 hover:shadow-sm"
              >
                <div className="flex flex-1 items-center gap-2.5">
                  {item.icon}
                  <span className="whitespace-nowrap text-sm font-medium leading-tight tracking-tight text-foreground">
                    {item.label}
                  </span>
                </div>
                {item.value && (
                  <span className="ml-auto shrink-0 rounded-md border border-primary/10 bg-primary/10 px-2 py-1 text-xs font-medium tracking-tight text-primary">
                    {item.value}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="my-3 bg-gradient-to-r from-transparent via-border to-transparent" />

        <DropdownMenuItem
          className="group rounded-xl border border-transparent bg-destructive/10 transition-all duration-200 hover:border-destructive/30 hover:bg-destructive/20"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4 shrink-0 text-destructive group-hover:text-destructive" />
          <span className="ml-2 text-sm font-medium text-destructive">
            Sign Out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
