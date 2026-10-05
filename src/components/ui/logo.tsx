import React from 'react'
import { cn } from '@/lib/utils'

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
  wordmarkClassName?: string
}

const SIZE_MAP = {
  xs: { box: 'h-4 w-4', text: 'text-xs' },
  sm: { box: 'h-5 w-5', text: 'text-sm' },
  md: { box: 'h-7 w-7', text: 'text-base' },
  lg: { box: 'h-10 w-10', text: 'text-xl' },
  xl: { box: 'h-14 w-14', text: 'text-2xl' },
}

export function Logo({
  size = 'md',
  showWordmark = false,
  wordmarkClassName,
  className,
  ...props
}: LogoProps) {
  const { box, text } = SIZE_MAP[size] || SIZE_MAP.md

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)} {...props}>
      {/* Visual Glyph Mark: AST Syntax Tree & "A" Monogram */}
      <div
        className={cn(
          'relative shrink-0 flex items-center justify-center border border-border dark:border-line-strong bg-card shadow-xs transition-transform duration-150 hover:scale-[1.02]',
          box
        )}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          {/* Canopy Background Frame */}
          <rect width="32" height="32" fill="#0B0F0C" />
          <rect x="0.5" y="0.5" width="31" height="31" stroke="#2D3930" strokeWidth="1" />

          {/* AST Edges: Outer "A" Legs */}
          <line x1="16" y1="7" x2="10" y2="16" stroke="#EDF4EE" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="16" y1="7" x2="22" y2="16" stroke="#EDF4EE" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="10" y1="16" x2="6" y2="25" stroke="#EDF4EE" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="22" y1="16" x2="26" y2="25" stroke="#EDF4EE" strokeWidth="1.8" strokeLinecap="round" />

          {/* AST Bridge Crossbar */}
          <line x1="10" y1="16" x2="22" y2="16" stroke="#EDF4EE" strokeWidth="1.8" strokeLinecap="round" />

          {/* Central AST Spine (Dashed Graph Edge) */}
          <line x1="16" y1="7" x2="16" y2="16" stroke="#B7ED69" strokeWidth="1.4" strokeDasharray="2 1.5" strokeLinecap="round" />
          <line x1="16" y1="16" x2="16" y2="25" stroke="#B7ED69" strokeWidth="1.4" strokeDasharray="2 1.5" strokeLinecap="round" />

          {/* Branch Vertices (Graph Nodes) */}
          <circle cx="10" cy="16" r="1.8" fill="#0B0F0C" stroke="#EDF4EE" strokeWidth="1.4" />
          <circle cx="16" cy="16" r="1.8" fill="#B7ED69" />
          <circle cx="22" cy="16" r="1.8" fill="#0B0F0C" stroke="#EDF4EE" strokeWidth="1.4" />

          {/* Apex Root AST Node (Accent) */}
          <circle cx="16" cy="7" r="2.2" fill="#B7ED69" />

          {/* Leaf Syntax Tokens (Terminal Square Nodes) */}
          <rect x="4.5" y="23.5" width="3" height="3" fill="#EDF4EE" />
          <rect x="14.5" y="23.5" width="3" height="3" fill="#B7ED69" />
          <rect x="24.5" y="23.5" width="3" height="3" fill="#EDF4EE" />
        </svg>
      </div>

      {/* Optional Wordmark */}
      {showWordmark && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-display font-extrabold tracking-tight text-foreground leading-none',
              text,
              wordmarkClassName
            )}
          >
            Arbor
          </span>
          <span className="border border-border dark:border-line-strong bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-600 dark:text-acid uppercase tracking-wider">
            DEV
          </span>
        </div>
      )}
    </div>
  )
}
