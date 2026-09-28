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
      {/* Visual Glyph Mark */}
      <div
        className={cn(
          'relative shrink-0 flex items-center justify-center rounded-lg shadow-sm transition-transform duration-200 hover:scale-105',
          box
        )}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="arbor-brand-grad" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5E6AD2" />
              <stop offset="50%" stopColor="#00F2FE" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <linearGradient id="arbor-bg-glow" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5E6AD2" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Background Frame */}
          <rect width="32" height="32" rx="9" fill="#070809" />
          <rect width="32" height="32" rx="9" fill="url(#arbor-bg-glow)" />
          <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke="#ffffff" strokeOpacity="0.12" />

          {/* Stylized "A" Monogram + AST Tree Graph */}
          {/* Outer A Apex & Legs */}
          <path d="M7 25 L16 7 L25 25" stroke="url(#arbor-brand-grad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* AST Crossbar & Graph Bridge */}
          <path d="M11 17 H21" stroke="url(#arbor-brand-grad)" strokeWidth="2" strokeLinecap="round" />
          
          {/* Central AST Trunk */}
          <path d="M16 7 V17 M16 17 V25" stroke="url(#arbor-brand-grad)" strokeWidth="1.6" strokeDasharray="2.5 2" strokeLinecap="round" />

          {/* Micro Graph Nodes at Key Vertices */}
          <circle cx="16" cy="7" r="2.2" fill="#00F2FE" />
          <circle cx="11" cy="17" r="1.8" fill="#5E6AD2" />
          <circle cx="21" cy="17" r="1.8" fill="#10B981" />
          <circle cx="7" cy="25" r="1.8" fill="#5E6AD2" />
          <circle cx="25" cy="25" r="1.8" fill="#10B981" />
        </svg>
      </div>

      {/* Optional Wordmark */}
      {showWordmark && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-display font-extrabold tracking-tight text-foreground leading-none',
              text,
              wordmarkClassName
            )}
          >
            Arbor
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary border border-primary/20">
            DEV
          </span>
        </div>
      )}
    </div>
  )
}
