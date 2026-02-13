import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

/**
 * NativeSelect Component
 * 
 * A native HTML select with custom styling.
 * Uses centralized CSS classes from styles/components.css
 */

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
  icon?: React.ReactNode
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, label, error, options, placeholder, id, required, icon, ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = id || generatedId

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            htmlFor={selectId}
            className={cn('label', required && 'label-required')}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          {icon && (
            <div
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {icon}
            </div>
          )}
          <select
            id={selectId}
            ref={ref}
            className={cn('input', error && 'input-error', className)}
            style={{ 
              paddingLeft: icon ? '44px' : '16px',
              paddingRight: '40px',
              appearance: 'none',
              cursor: 'pointer',
            }}
            aria-invalid={error ? 'true' : 'false'}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown 
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              color: 'var(--color-gray-400)',
              pointerEvents: 'none',
            }}
          />
        </div>
        {error && (
          <p className="auth-error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
