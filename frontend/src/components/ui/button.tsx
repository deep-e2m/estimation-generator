import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

/**
 * Button Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg'
  asChild?: boolean
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    asChild = false, 
    isLoading, 
    leftIcon, 
    rightIcon, 
    children, 
    disabled, 
    ...props 
  }, ref) => {
    // Map variant to CSS class
    const variantClass = {
      default: 'btn-primary',
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      outline: 'btn-outline',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      success: 'btn-success',
      link: 'btn-link',
    }[variant]

    // Map size to CSS class
    const sizeClass = {
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
      xl: 'btn-xl',
      icon: 'btn-icon',
      'icon-sm': 'btn-icon-sm',
      'icon-lg': 'btn-icon-lg',
    }[size]

    const classes = cn('btn', variantClass, sizeClass, className)

    // When using asChild, use Slot
    if (asChild) {
      return (
        <Slot
          className={classes}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="animate-spin" style={{ width: 16, height: 16, flexShrink: 0 }} />
        ) : leftIcon ? (
          <span style={{ flexShrink: 0 }}>{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && <span style={{ flexShrink: 0 }}>{rightIcon}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }