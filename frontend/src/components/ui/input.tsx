import * as React from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Input Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, helperText, id, required, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn('label', required && 'label-required')}
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn('input', error && 'input-error', className)}
          ref={ref}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="auth-error-text" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-sm text-gray-500 mt-2">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

// Password input with visibility toggle
export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  showStrength?: boolean
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength: _showStrength, label, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        {label && (
          <label className={cn('label', props.required && 'label-required')}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          <Input
            type={showPassword ? 'text' : 'password'}
            className={className}
            ref={ref}
            style={{ paddingRight: '48px' }}
            {...props}
            label={undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="btn-ghost"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '4px',
              borderRadius: '8px',
              width: 'auto',
              height: 'auto',
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff style={{ width: 20, height: 20, color: 'var(--color-gray-400)' }} />
            ) : (
              <Eye style={{ width: 20, height: 20, color: 'var(--color-gray-400)' }} />
            )}
          </button>
        </div>
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'

export { Input, PasswordInput }
