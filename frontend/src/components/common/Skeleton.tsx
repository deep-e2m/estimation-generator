/**
 * Skeleton Component
 * 
 * Loading placeholder with shimmer animation.
 * Uses centralized CSS classes from styles/components.css
 */

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div className={cn('skeleton', className)} style={style} />
  )
}

// Pre-configured skeleton variants
export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{
            width: i === lines - 1 && lines > 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  )
}

export function SkeletonTitle({ className }: { className?: string }) {
  return <div className={cn('skeleton skeleton-title', className)} />
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 48, height: 48 },
    xl: { width: 64, height: 64 },
  }
  
  return (
    <div
      className="skeleton skeleton-avatar"
      style={sizes[size]}
    />
  )
}

export function SkeletonButton({ className }: { className?: string }) {
  return <div className={cn('skeleton skeleton-button', className)} />
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 'var(--space-6)' }}>
      <SkeletonTitle />
      <SkeletonText lines={3} className="mt-4" />
      <SkeletonButton className="mt-4" />
    </div>
  )
}
