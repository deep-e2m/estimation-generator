import * as React from 'react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

/**
 * Avatar Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallback?: string
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt = '', size = 'md', fallback, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)
    
    // Map size to CSS class
    const sizeClass = {
      sm: 'avatar-sm',
      md: 'avatar-md',
      lg: 'avatar-lg',
      xl: 'avatar-xl',
    }[size]

    const showFallback = !src || imageError
    const initials = fallback || (alt ? getInitials(alt) : '?')

    return (
      <div
        ref={ref}
        className={cn('avatar', sizeClass, className)}
        {...props}
      >
        {!showFallback ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImageError(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

export { Avatar }
