/**
 * Progress Bar Component
 */

interface ProgressBarProps {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  variant = 'default',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const variantColors = {
    default: 'var(--color-primary-500)',
    success: 'var(--color-success-500)',
    warning: 'var(--color-warning-500)',
    error: 'var(--color-error-500)',
  }

  return (
    <div className={className}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-medium text-gray-900">{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--color-gray-200)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: variantColors[variant],
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--transition-normal)',
          }}
        />
      </div>
    </div>
  )
}
