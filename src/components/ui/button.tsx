import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-neutral-950 text-white hover:bg-neutral-800 border border-neutral-950 dark:bg-white dark:text-neutral-950 dark:border-white/90 dark:hover:bg-neutral-100 font-medium shadow-sm dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.8)] active:scale-[0.98] transition-all',
        brand:
          'bg-neutral-950 text-white hover:bg-neutral-800 border border-neutral-950 dark:bg-white dark:text-neutral-950 dark:border-white/90 dark:hover:bg-neutral-100 font-medium shadow-sm dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.8)] active:scale-[0.98] transition-all',
        secondary:
          'border border-border/80 bg-background text-foreground hover:bg-muted/70 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-xs active:scale-[0.98] transition-all',
        outline:
          'border border-border/80 bg-background text-foreground hover:bg-muted/70 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-xs active:scale-[0.98] transition-all',
        destructive:
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white font-medium shadow-xs active:scale-[0.98] transition-all',
        ghost: 'hover:bg-muted/60 hover:text-foreground text-muted-foreground active:scale-[0.98] transition-colors',
        link: 'text-foreground underline-offset-4 hover:underline active:scale-[0.98]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }