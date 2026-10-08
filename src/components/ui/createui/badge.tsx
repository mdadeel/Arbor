import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 select-none items-center justify-center gap-1.5 border font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        primary: 'text-primary',
        neutral: 'text-muted-foreground',
        danger: 'text-destructive',
        success: 'text-emerald-700 dark:text-emerald-300',
        warning: 'text-amber-700 dark:text-amber-300',
        info: 'text-sky-700 dark:text-sky-300',
        verified: 'text-primary',
        highlighted: 'text-foreground',
        away: 'text-muted-foreground',
        inverse: 'text-background',
      },
      appearance: {
        solid: 'border-transparent',
        outline: 'bg-transparent',
        soft: 'border-transparent',
        ghost: 'border-transparent bg-transparent',
      },
      size: {
        xs: 'h-5 gap-1 px-1.5 text-[10px] [&_svg]:size-3',
        sm: 'h-6 px-2 text-[11px] [&_svg]:size-3.5',
        md: 'h-7 px-2.5 text-xs [&_svg]:size-4',
      },
      shape: {
        rounded: 'rounded-md',
        pill: 'rounded-full',
      },
      iconOnly: {
        true: 'aspect-square !px-0',
        false: '',
      },
      numberOnly: {
        true: 'min-w-6 tabular-nums',
        false: '',
      },
    },
    compoundVariants: [
      { variant: 'primary', appearance: 'solid', className: 'bg-primary text-primary-foreground' },
      { variant: 'primary', appearance: 'outline', className: 'border-primary/35' },
      { variant: 'primary', appearance: 'soft', className: 'bg-primary/10' },
      { variant: 'primary', appearance: 'ghost', className: 'text-primary' },
      { variant: 'neutral', appearance: 'solid', className: 'bg-foreground text-background' },
      { variant: 'neutral', appearance: 'outline', className: 'border-border text-foreground' },
      { variant: 'neutral', appearance: 'soft', className: 'bg-muted text-foreground' },
      { variant: 'neutral', appearance: 'ghost', className: 'text-muted-foreground' },
      { variant: 'danger', appearance: 'solid', className: 'bg-destructive text-destructive-foreground' },
      { variant: 'danger', appearance: 'outline', className: 'border-destructive/35' },
      { variant: 'danger', appearance: 'soft', className: 'bg-destructive/10' },
      { variant: 'danger', appearance: 'ghost', className: 'text-destructive' },
      { variant: 'success', appearance: 'solid', className: 'bg-emerald-600 text-white dark:bg-emerald-500' },
      { variant: 'success', appearance: 'outline', className: 'border-emerald-600/35' },
      { variant: 'success', appearance: 'soft', className: 'bg-emerald-500/10' },
      { variant: 'success', appearance: 'ghost', className: 'text-emerald-700 dark:text-emerald-300' },
      { variant: 'warning', appearance: 'solid', className: 'bg-amber-500 text-neutral-950' },
      { variant: 'warning', appearance: 'outline', className: 'border-amber-500/35' },
      { variant: 'warning', appearance: 'soft', className: 'bg-amber-500/10' },
      { variant: 'warning', appearance: 'ghost', className: 'text-amber-700 dark:text-amber-300' },
      { variant: 'info', appearance: 'solid', className: 'bg-sky-600 text-white' },
      { variant: 'info', appearance: 'outline', className: 'border-sky-500/35' },
      { variant: 'info', appearance: 'soft', className: 'bg-sky-500/10' },
      { variant: 'info', appearance: 'ghost', className: 'text-sky-700 dark:text-sky-300' },
      { variant: 'verified', appearance: 'solid', className: 'bg-primary text-primary-foreground' },
      { variant: 'verified', appearance: 'outline', className: 'border-primary/35' },
      { variant: 'verified', appearance: 'soft', className: 'bg-primary/10' },
      { variant: 'verified', appearance: 'ghost', className: 'text-primary' },
      { variant: 'highlighted', appearance: 'solid', className: 'bg-foreground text-background' },
      { variant: 'highlighted', appearance: 'outline', className: 'border-foreground/25' },
      { variant: 'highlighted', appearance: 'soft', className: 'bg-foreground/10' },
      { variant: 'highlighted', appearance: 'ghost', className: 'text-foreground' },
      { variant: 'away', appearance: 'solid', className: 'bg-muted-foreground text-background' },
      { variant: 'away', appearance: 'outline', className: 'border-border' },
      { variant: 'away', appearance: 'soft', className: 'bg-muted' },
      { variant: 'away', appearance: 'ghost', className: 'text-muted-foreground' },
      { variant: 'inverse', appearance: 'solid', className: 'bg-background text-foreground' },
      { variant: 'inverse', appearance: 'outline', className: 'border-background/35' },
      { variant: 'inverse', appearance: 'soft', className: 'bg-background/10 text-background' },
      { variant: 'inverse', appearance: 'ghost', className: 'text-background' },
    ],
    defaultVariants: {
      variant: 'neutral',
      appearance: 'soft',
      size: 'sm',
      shape: 'rounded',
      iconOnly: false,
      numberOnly: false,
    },
  }
)

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      asChild = false,
      className,
      variant,
      appearance,
      size,
      shape,
      iconOnly = false,
      numberOnly = false,
      leading,
      trailing,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : 'span'
    const sharedProps = {
      ...props,
      ref,
      className: cn(badgeVariants({ variant, appearance, size, shape, iconOnly, numberOnly }), className),
      'data-slot': 'badge',
      'data-variant': variant ?? 'neutral',
      'data-appearance': appearance ?? 'soft',
      'data-size': size ?? 'sm',
    }

    return (
      <Component {...sharedProps}>
        {iconOnly || numberOnly ? (
          children
        ) : (
          <>
            {leading && <span data-slot="badge-icon" data-position="leading" className="inline-flex [&_svg]:size-full">{leading}</span>}
            <span data-slot="badge-label" className="min-w-0">{children}</span>
            {trailing && <span data-slot="badge-icon" data-position="trailing" className="inline-flex [&_svg]:size-full">{trailing}</span>}
          </>
        )}
      </Component>
    )
  }
)
Badge.displayName = 'CreateUIBadge'

export { Badge, badgeVariants }
