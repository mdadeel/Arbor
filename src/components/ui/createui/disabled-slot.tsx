'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

type DisabledSlotProps = React.ComponentPropsWithoutRef<typeof Slot>

const DisabledSlot = React.forwardRef<HTMLElement, DisabledSlotProps>(
  ({ children, ...props }, ref) => {
    const inertChild = React.isValidElement(children)
      ? React.cloneElement(children, { onClick: undefined, 'aria-disabled': true, tabIndex: -1 } as any)
      : children

    return (
      <Slot
        {...props}
        ref={ref}
        aria-disabled="true"
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {inertChild}
      </Slot>
    )
  }
)

DisabledSlot.displayName = 'CreateUIDisabledSlot'

export { DisabledSlot }
