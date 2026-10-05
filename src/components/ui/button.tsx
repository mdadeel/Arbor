import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/85 dark:hover:brightness-110 border border-primary/30 shadow-xs hover:border-primary',
        brand:
          'bg-foreground text-background hover:bg-foreground/90 border border-foreground/30 shadow-xs',
        secondary:
          'border border-border/80 bg-secondary/80 text-foreground hover:bg-muted hover:border-foreground/30 shadow-xs',
        outline:
          'border border-border dark:border-line-strong bg-card text-foreground hover:bg-muted/80 hover:border-foreground/50 shadow-xs',
        destructive:
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white shadow-xs',
        ghost: 'hover:bg-muted/70 hover:text-foreground text-muted-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-10 px-7 text-sm',
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