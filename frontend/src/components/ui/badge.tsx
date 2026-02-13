import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Badge Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'active' | 'completed' | 'archived' | 'draft'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  // Map variant to CSS class
  const variantClass = {
    default: 'badge-default',
    secondary: 'badge-secondary',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    outline: 'badge-outline',
    active: 'badge-status badge-active',
    completed: 'badge-status badge-completed',
    archived: 'badge-status badge-archived',
    draft: 'badge-status badge-draft',
  }[variant]

  return (
    <span className={cn('badge', variantClass, className)} {...props} />
  )
}

export { Badge }
