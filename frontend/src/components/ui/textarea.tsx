import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Textarea Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  label?: string
  helperText?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, id, required, ...props }, ref) => {
    const generatedId = React.useId()
    const textareaId = id || generatedId

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            htmlFor={textareaId}
            className={cn('label', required && 'label-required')}
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn('textarea', error && 'textarea-error', className)}
          ref={ref}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="auth-error-text" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${textareaId}-helper`} className="text-sm text-gray-500 mt-2">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
