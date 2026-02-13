import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Spinner Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'primary' | 'white'
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', variant = 'primary', ...props }, ref) => {
    // Map size to CSS class
    const sizeClass = {
      sm: 'spinner-sm',
      md: 'spinner-md',
      lg: 'spinner-lg',
      xl: 'spinner-xl',
    }[size]

    const variantClass = variant === 'white' ? 'spinner-white' : 'spinner-primary'

    return (
      <div
        ref={ref}
        className={cn('spinner', sizeClass, variantClass, className)}
        role="status"
        aria-label="Loading"
        {...props}
      />
    )
  }
)
Spinner.displayName = 'Spinner'

// Full page spinner
const PageSpinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  (props, ref) => (
    <div ref={ref} className="page-spinner">
      <Spinner size="lg" {...props} />
    </div>
  )
)
PageSpinner.displayName = 'PageSpinner'

export { Spinner, PageSpinner }
