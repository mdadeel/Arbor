'use client'

import Link from 'next/link'
import { Bell, CheckCheck, CircleDot } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/createui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function NotificationCenter() {
  const utils = trpc.useUtils()
  const notifications = trpc.notifications.list.useQuery({ limit: 8 }, { refetchInterval: 30_000 })
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  })
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  })
  const unreadCount = notifications.data?.unreadCount ?? 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="neutral-light" appearance="ghost" size="sm" iconOnly className="relative h-8 w-8 text-muted-foreground" aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}>
          <Bell className="size-4" />
          {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[9px] font-semibold text-primary-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-xs">Notifications{unreadCount > 0 ? ` · ${unreadCount} unread` : ''}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="neutral-light" appearance="ghost" size="xs" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <CheckCheck className="size-3" /> Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        {notifications.isLoading ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading notifications…</p>
        ) : notifications.error ? (
          <p className="px-3 py-6 text-center text-xs text-destructive">{notifications.error.message}</p>
        ) : notifications.data?.items.length ? (
          <div className="max-h-[min(26rem,70vh)] overflow-y-auto">
            {notifications.data.items.map((item) => (
              <DropdownMenuItem key={item.id} asChild className="cursor-pointer items-start whitespace-normal px-3 py-2.5 focus:bg-muted/70">
                <Link href={item.project?.slug ? `/projects/${encodeURIComponent(item.project.slug)}` : '/settings?tab=notifications'} onClick={() => { if (!item.readAt) markRead.mutate({ id: item.id }) }}>
                  <span className="mt-0.5 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                    {item.readAt ? <Bell className="h-3 w-3 text-muted-foreground" /> : <CircleDot className="h-3 w-3 text-primary" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-foreground">{item.title}</span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{item.body}</span>
                    <span className="mt-1 block text-[9px] text-muted-foreground/80">{item.project?.name ? `${item.project.name} · ` : ''}{new Date(item.createdAt).toLocaleString()}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">You’re all caught up. Scan and regression alerts appear here.</p>
        )}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="cursor-pointer justify-center text-xs">
          <Link href="/settings?tab=notifications">Notification settings</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
