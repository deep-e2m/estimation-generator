import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

/**
 * Label Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('label', required && 'label-required', className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }