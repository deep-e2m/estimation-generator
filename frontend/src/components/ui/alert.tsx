import * as React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react'

/**
 * Alert Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

const iconMap = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error'
  dismissible?: boolean
  onDismiss?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', dismissible, onDismiss, children, ...props }, ref) => {
    const Icon = iconMap[variant]

    // Map variant to CSS class
    const variantClass = {
      default: 'alert-default',
      info: 'alert-info',
      success: 'alert-success',
      warning: 'alert-warning',
      error: 'alert-error',
    }[variant]

    return (
      <div
        ref={ref}
        role="alert"
        className={cn('alert', variantClass, className)}
        {...props}
      >
        <Icon className="alert-icon" style={{ width: 20, height: 20 }} />
        <div className="alert-content">{children}</div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="alert-dismiss"
            aria-label="Dismiss"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>
    )
  }
)
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('alert-title', className)}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('alert-description', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
