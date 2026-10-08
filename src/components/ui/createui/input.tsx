import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export type InputSize = 'xs' | 'sm' | 'md'

const inputShellVariants = cva(
  'group/input-shell flex w-full min-w-0 items-center gap-2 border bg-background text-foreground transition-[border-color,box-shadow,background-color] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
  {
    variants: {
      size: {
        xs: 'h-8 rounded-md px-2 text-xs',
        sm: 'h-9 rounded-lg px-3 text-sm',
        md: 'h-10 rounded-lg px-3.5 text-sm',
      },
      invalid: {
        true: 'border-destructive focus-within:ring-destructive/40',
        false: 'border-input',
      },
      disabled: {
        true: 'cursor-not-allowed opacity-60',
        false: '',
      },
      loading: {
        true: 'pointer-events-none border-primary/40',
        false: '',
      },
    },
    defaultVariants: {
      size: 'sm',
      invalid: false,
      disabled: false,
      loading: false,
    },
  }
)

export interface InputShellProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: InputSize
  invalid?: boolean
  disabled?: boolean
  loading?: boolean
}

const InputShell = React.forwardRef<HTMLDivElement, InputShellProps>(
  ({ className, size, invalid, disabled, loading, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="input-shell"
      data-size={size ?? 'sm'}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(inputShellVariants({ size, invalid, disabled, loading }), className)}
      {...props}
    />
  )
)
InputShell.displayName = 'CreateUIInputShell'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize
  invalid?: boolean
  loading?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'sm', invalid, loading = false, disabled = false, 'aria-invalid': ariaInvalid, ...props }, ref) => (
    <InputShell size={size} invalid={invalid ?? Boolean(ariaInvalid)} disabled={disabled || loading} loading={loading}>
      {loading && <Loader2 className="size-4 shrink-0 text-primary motion-safe:animate-spin" aria-hidden="true" />}
      <input
        ref={ref}
        data-slot="input"
        data-size={size}
        aria-invalid={invalid ?? ariaInvalid}
        disabled={disabled || loading}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
        {...props}
      />
    </InputShell>
  )
)
Input.displayName = 'CreateUIInput'

export { Input, InputShell }
