import Link from 'next/link'
import {
  Boxes,
  Braces,
  Gauge,
  LayoutDashboard,
  Settings,
  TerminalSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, active: true },
  { href: '/architecture', label: 'Architecture', icon: Boxes, gated: true },
  { href: '/environments', label: 'Environments', icon: Braces, gated: true },
  { href: '/api', label: 'API Explorer', icon: TerminalSquare, gated: true },
  { href: '/docs', label: 'Docs', icon: Gauge, gated: true },
]

export function Sidebar({ user }: { user: { name?: string | null } }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="h-5 w-5 rounded bg-primary" />
        <span className="font-display text-sm font-semibold">DevHub</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              item.active && 'bg-accent text-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.gated && <Badge variant="outline" className="text-[10px]">v2</Badge>}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/settings/profile"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <p className="mt-2 px-3 text-xs text-muted-foreground/60">
          {user.name ?? 'Signed in'}
        </p>
      </div>
    </aside>
  )
}