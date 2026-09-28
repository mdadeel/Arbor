import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[transform,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:opacity-95 border border-primary/20 shadow-md shadow-primary/20',
        brand:
          'bg-gradient-to-r from-[#5E6AD2] to-[#00F2FE] text-white hover:opacity-95 border border-white/20 shadow-md shadow-indigo-500/25',
        secondary:
          'border border-border/80 bg-secondary/80 text-foreground hover:bg-secondary hover:border-border shadow-xs',
        outline:
          'border border-border/80 bg-background/50 text-foreground hover:bg-muted/60 hover:border-primary/40 shadow-xs',
        destructive:
          'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white shadow-xs',
        ghost: 'hover:bg-muted/60 hover:text-foreground text-muted-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-full px-3.5 text-xs',
        lg: 'h-10 rounded-full px-7 text-sm',
        icon: 'h-9 w-9 rounded-full',
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