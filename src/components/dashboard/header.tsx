import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/dashboard/user-menu'

type AuthUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

export function Header({ user }: { user: AuthUser }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className="text-sm text-muted-foreground">
        Developer portal <span className="text-muted-foreground/50">/</span> workspace
      </div>
      <div className="flex items-center gap-3">
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  )
}