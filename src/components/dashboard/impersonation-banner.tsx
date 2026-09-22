'use client'

import { Eye, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImpersonationBannerProps {
  targetName?: string | null
  targetEmail?: string | null
  operatorEmail?: string | null
}

export function ImpersonationBanner({
  targetName,
  targetEmail,
  operatorEmail,
}: ImpersonationBannerProps) {
  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-amber-300">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="flex items-center gap-1.5 font-medium">
            <Eye className="h-3.5 w-3.5 text-amber-400" />
            <span>Viewing Arbor as:</span>
            <span className="font-semibold text-foreground bg-amber-400/20 px-1.5 py-0.5 rounded text-[11px]">
              {targetName || targetEmail || 'Developer'}
            </span>
            {targetEmail && targetName && (
              <span className="text-muted-foreground">({targetEmail})</span>
            )}
          </div>
          <span className="hidden md:inline text-muted-foreground">·</span>
          <span className="hidden md:flex items-center gap-1 text-muted-foreground">
            <ShieldAlert className="h-3 w-3" />
            Operator: {operatorEmail || 'Administrator'} (Admin operations barred)
          </span>
        </div>

        <a href="/api/admin/impersonate/exit">
          <Button
            size="sm"
            variant="default"
            className="h-7 px-3 text-[11px] font-semibold gap-1.5"
          >
            <span>Exit View As</span>
          </Button>
        </a>
      </div>
    </div>
  )
}
