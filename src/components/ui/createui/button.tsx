import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { DisabledSlot } from './disabled-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-60 aria-busy:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'text-primary-foreground',
        'neutral-solid': 'text-background',
        'neutral-light': 'text-foreground',
        danger: 'text-destructive-foreground',
        success: 'text-white',
        'inverse-solid': 'text-background',
        'inverse-light': 'text-foreground',
      },
      appearance: {
        solid: 'border shadow-sm',
        outline: 'border bg-transparent shadow-none',
        soft: 'border border-transparent shadow-none',
        ghost: 'border border-transparent bg-transparent shadow-none',
      },
      size: {
        xs: 'h-6 gap-1 px-2 text-[11px] [&_svg]:size-3.5',
        sm: 'h-8 gap-1.5 px-3 text-xs [&_svg]:size-4',
        md: 'h-9 gap-1.5 px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-10 gap-2 px-4 text-sm [&_svg]:size-4',
        xl: 'h-12 gap-2 px-5 text-base [&_svg]:size-5',
      },
      shape: {
        rounded: 'rounded-md',
        pill: 'rounded-full',
        square: 'rounded-none',
      },
      iconOnly: {
        true: 'aspect-square !px-0',
        false: '',
      },
    },
    compoundVariants: [
      { variant: 'primary', appearance: 'solid', className: 'border-primary/80 bg-primary hover:bg-primary/90' },
      { variant: 'primary', appearance: 'outline', className: 'border-primary/40 text-primary hover:bg-primary/10' },
      { variant: 'primary', appearance: 'soft', className: 'bg-primary/10 text-primary hover:bg-primary/15' },
      { variant: 'primary', appearance: 'ghost', className: 'text-primary hover:bg-primary/10' },

      { variant: 'neutral-solid', appearance: 'solid', className: 'border-foreground/10 bg-foreground hover:bg-foreground/90' },
      { variant: 'neutral-solid', appearance: 'outline', className: 'border-border text-foreground hover:bg-muted' },
      { variant: 'neutral-solid', appearance: 'soft', className: 'bg-muted text-foreground hover:bg-muted/80' },
      { variant: 'neutral-solid', appearance: 'ghost', className: 'text-muted-foreground hover:bg-muted hover:text-foreground' },

      { variant: 'neutral-light', appearance: 'solid', className: 'border-border bg-card hover:bg-muted' },
      { variant: 'neutral-light', appearance: 'outline', className: 'border-border text-foreground hover:bg-muted' },
      { variant: 'neutral-light', appearance: 'soft', className: 'bg-muted/70 hover:bg-muted' },
      { variant: 'neutral-light', appearance: 'ghost', className: 'text-muted-foreground hover:bg-muted hover:text-foreground' },

      { variant: 'danger', appearance: 'solid', className: 'border-destructive/80 bg-destructive hover:bg-destructive/90' },
      { variant: 'danger', appearance: 'outline', className: 'border-destructive/40 text-destructive hover:bg-destructive/10' },
      { variant: 'danger', appearance: 'soft', className: 'bg-destructive/10 text-destructive hover:bg-destructive/15' },
      { variant: 'danger', appearance: 'ghost', className: 'text-destructive hover:bg-destructive/10' },

      { variant: 'success', appearance: 'solid', className: 'border-emerald-700 bg-emerald-600 hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400' },
      { variant: 'success', appearance: 'outline', className: 'border-emerald-600/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300' },
      { variant: 'success', appearance: 'soft', className: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300' },
      { variant: 'success', appearance: 'ghost', className: 'text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300' },

      { variant: 'inverse-solid', appearance: 'solid', className: 'border-background/10 bg-background hover:bg-background/90' },
      { variant: 'inverse-solid', appearance: 'outline', className: 'border-background/30 text-background hover:bg-background/10' },
      { variant: 'inverse-solid', appearance: 'soft', className: 'bg-background/10 text-background hover:bg-background/15' },
      { variant: 'inverse-solid', appearance: 'ghost', className: 'text-background hover:bg-background/10' },

      { variant: 'inverse-light', appearance: 'solid', className: 'border-foreground/10 bg-foreground/10 text-foreground hover:bg-foreground/15' },
      { variant: 'inverse-light', appearance: 'outline', className: 'border-foreground/30 text-foreground hover:bg-foreground/10' },
      { variant: 'inverse-light', appearance: 'soft', className: 'bg-foreground/10 text-foreground hover:bg-foreground/15' },
      { variant: 'inverse-light', appearance: 'ghost', className: 'text-foreground hover:bg-foreground/10' },
    ],
    defaultVariants: {
      variant: 'primary',
      appearance: 'solid',
      size: 'lg',
      shape: 'rounded',
      iconOnly: false,
    },
  }
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      className,
      variant,
      appearance,
      size,
      shape,
      iconOnly = false,
      loading = false,
      disabled = false,
      type = 'button',
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const ariaDisabled = props['aria-disabled']
    const isUnavailable = disabled || loading || ariaDisabled === true || ariaDisabled === 'true'
    const sharedProps = {
      ...props,
      ref,
      className: cn(buttonVariants({ variant, appearance, size, shape, iconOnly }), className),
      'data-slot': 'button',
      'data-variant': variant ?? 'primary',
      'data-appearance': appearance ?? 'solid',
      'data-size': size ?? 'lg',
      'data-shape': shape ?? 'rounded',
      'aria-busy': loading || props['aria-busy'] || undefined,
    }
    const renderedChildren = (
      <>
        {loading && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
        {children}
      </>
    )

    if (asChild) {
      const slotProps = {
        ...sharedProps,
        'aria-disabled': isUnavailable || undefined,
        tabIndex: isUnavailable ? -1 : sharedProps.tabIndex,
      }

      if (isUnavailable) {
        return (
          <DisabledSlot {...slotProps}>
            {children}
          </DisabledSlot>
        )
      }

      return (
        <Slot
          {...slotProps}
          {...(onClick ? { onClick: onClick as React.MouseEventHandler<HTMLElement> } : {})}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        {...sharedProps}
        ref={ref}
        type={type}
        disabled={isUnavailable}
        onClick={onClick}
      >
        {renderedChildren}
      </button>
    )
  }
)
Button.displayName = 'CreateUIButton'

const ButtonLabel = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} data-slot="button-label" className={cn('min-w-0', className)} {...props} />
  )
)
ButtonLabel.displayName = 'CreateUIButtonLabel'

export { Button, ButtonLabel, buttonVariants }
