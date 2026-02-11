import * as React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode
  error?: string
  helperText?: string
  showCharCount?: boolean
  maxLength?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, showCharCount, maxLength, id, value, ...props }, ref) => {
    const textareaId = id || React.useId()
    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            'w-full px-4 py-2.5 border rounded-lg text-sm resize-none',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
            'hover:border-gray-400',
            'transition-all duration-200 focus:scale-[1.01] focus:shadow-sm',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50',
            'placeholder:text-gray-400',
            error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500/30'
              : 'border-gray-300',
            className
          )}
          ref={ref}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...props}
        />

        {/* Error message or helper text */}
        <div className="flex items-start justify-between gap-2 mt-1.5">
          <div className="flex-1">
            {error && (
              <p id={`${textareaId}-error`} className="animate-slide-down text-sm text-error-600 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{error}</span>
              </p>
            )}
            {helperText && !error && (
              <p id={`${textareaId}-helper`} className="text-xs text-gray-500">
                {helperText}
              </p>
            )}
          </div>

          {/* Character count */}
          {showCharCount && maxLength && (
            <p className="text-xs text-gray-500 shrink-0">
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
