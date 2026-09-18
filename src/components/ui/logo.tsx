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
          className="h-full w-full drop-shadow-[0_1px_4px_rgba(16,185,129,0.25)]"
        >
          <defs>
            <linearGradient id="arbor-react-grad" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="arbor-react-glow" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Background container */}
          <rect width="32" height="32" rx="7" fill="#0d0f12" />
          <rect width="32" height="32" rx="7" fill="url(#arbor-react-glow)" />
          <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#27272a" strokeOpacity="0.85" />

          {/* Geometric AST Branching Tree */}
          {/* Main Trunk */}
          <line x1="16" y1="25" x2="16" y2="12" stroke="url(#arbor-react-grad)" strokeWidth="2.2" strokeLinecap="round" />

          {/* Left Branch */}
          <path d="M16 19 L10 13 L10 9" stroke="url(#arbor-react-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Right Branch */}
          <path d="M16 19 L22 13 L22 9" stroke="url(#arbor-react-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Top Center Stem */}
          <line x1="16" y1="12" x2="16" y2="7" stroke="url(#arbor-react-grad)" strokeWidth="2" strokeLinecap="round" />

          {/* Cross Syntactic Link */}
          <path d="M10 13 L16 16 L22 13" stroke="url(#arbor-react-grad)" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />

          {/* Node Terminals (AST Nodes) */}
          <circle cx="16" cy="6" r="2.2" fill="#38bdf8" />
          <circle cx="10" cy="8.5" r="2" fill="#10b981" />
          <circle cx="22" cy="8.5" r="2" fill="#60a5fa" />
          <circle cx="16" cy="25" r="1.8" fill="#059669" />
        </svg>
      </div>

      {/* Optional Wordmark */}
      {showWordmark && (
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-display font-bold tracking-tight text-foreground leading-none',
              text,
              wordmarkClassName
            )}
          >
            Arbor
          </span>
          <span className="rounded bg-emerald-500/10 px-1 py-0.2 font-mono text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
            DEV
          </span>
        </div>
      )}
    </div>
  )
}
