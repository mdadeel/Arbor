'use client'

import React from 'react'
import { Users, GitCommit, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { ContributorSummary, CommitCategory } from '@/server/services/commits'

const CATEGORY_COLORS: Record<CommitCategory, string> = {
  feat: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20',
  fix: 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20',
  refactor: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20',
  perf: 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20',
  docs: 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/20',
  test: 'bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 border-yellow-500/20',
  chore: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
  style: 'bg-pink-500/10 text-pink-500 dark:text-pink-400 border-pink-500/20',
  ci: 'bg-orange-500/10 text-orange-500 dark:text-orange-400 border-orange-500/20',
  build: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20',
  other: 'bg-muted text-muted-foreground border-border',
}

interface ContributorSummaryBarProps {
  contributors: ContributorSummary[]
  selectedAuthor: string | null
  onSelectAuthor: (author: string | null) => void
}

export function ContributorSummaryBar({
  contributors,
  selectedAuthor,
  onSelectAuthor,
}: ContributorSummaryBarProps) {
  if (contributors.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span>Team Activity &amp; Impact (&ldquo;Who Did What&rdquo;)</span>
        </h4>
        {selectedAuthor && (
          <button
            onClick={() => onSelectAuthor(null)}
            className="text-[11px] text-primary hover:underline font-medium"
          >
            Clear Author Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contributors.map((c) => {
          const isSelected = selectedAuthor === (c.login || c.name)
          const primaryStyle = CATEGORY_COLORS[c.primaryFocus] || CATEGORY_COLORS.other

          // Top 3 categories for this contributor
          const topCats = Object.entries(c.categories)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3) as [CommitCategory, number][]

          return (
            <Card
              key={c.login || c.name}
              onClick={() =>
                onSelectAuthor(isSelected ? null : c.login || c.name)
              }
              className={`cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? 'border-primary ring-1 ring-primary bg-primary/5'
                  : 'border-border hover:border-border/80 hover:bg-muted/30'
              }`}
            >
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-7 w-7 rounded-md border border-border shrink-0">
                      <AvatarImage src={c.avatarUrl} alt={c.name} />
                      <AvatarFallback className="rounded-md text-[10px] font-semibold">
                        {c.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {c.name}
                      </p>
                      {c.login && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          @{c.login}
                        </p>
                      )}
                    </div>
                  </div>

                  <Badge variant="secondary" className="font-mono text-[10px] shrink-0 gap-1">
                    <GitCommit className="h-3 w-3 text-muted-foreground" />
                    <span>{c.commitCount}</span>
                  </Badge>
                </div>

                {/* Primary Focus & Category Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium py-0 px-1.5 gap-1 uppercase tracking-wider ${primaryStyle}`}
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    <span>{c.primaryFocus}</span>
                  </Badge>

                  {topCats.map(([cat, count]) => (
                    <span
                      key={cat}
                      className="text-[10px] text-muted-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded"
                    >
                      {cat}: {count}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
