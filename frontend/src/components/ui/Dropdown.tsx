import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, AlertCircle, Loader2 } from 'lucide-react'

export interface DropdownOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
}

export interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  disabled?: boolean
  placeholder?: string
  isLoading?: boolean
  className?: string
}

export function Dropdown({
  options,
  value,
  onChange,
  label,
  error,
  disabled,
  placeholder = 'Select an option',
  isLoading,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled || isLoading) return

    switch (event.key) {
      case 'Escape':
        setIsOpen(false)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        setIsOpen(!isOpen)
        break
      case 'ArrowDown':
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          // Focus next option
          const currentIndex = options.findIndex((opt) => opt.value === value)
          const nextIndex = Math.min(currentIndex + 1, options.length - 1)
          if (nextIndex !== currentIndex) {
            onChange(options[nextIndex].value)
          }
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (isOpen) {
          // Focus previous option
          const currentIndex = options.findIndex((opt) => opt.value === value)
          const prevIndex = Math.max(currentIndex - 1, 0)
          if (prevIndex !== currentIndex) {
            onChange(options[prevIndex].value)
          }
        }
        break
    }
  }

  const handleOptionClick = (event: React.MouseEvent, optionValue: string) => {
    event.preventDefault()
    event.stopPropagation()
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Dropdown wrapper with relative positioning */}
      <div className="relative" ref={dropdownRef}>
        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 bg-white border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
            'transition-all duration-200 focus:scale-[1.01] focus:shadow-sm',
            error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500/30'
              : 'border-gray-300 hover:border-gray-400',
            (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          )}
          disabled={disabled || isLoading}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0" />
          ) : (
            selectedOption?.icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 shrink-0">
                {selectedOption.icon}
              </div>
            )
          )}
          <div className="text-left min-w-0 flex-1">
            {selectedOption ? (
              <>
                <span className="font-medium text-gray-900 block truncate">
                  {selectedOption.label}
                </span>
                {selectedOption.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {selectedOption.description}
                  </p>
                )}
              </>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-gray-400 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 animate-fade-in bg-black/5"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          />

          {/* Options list */}
          <div
            className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-slide-down max-h-80 overflow-y-auto"
            role="listbox"
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={(e) => handleOptionClick(e, option.value)}
                className={cn(
                  'w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3',
                  option.value === value && 'bg-primary-50',
                  index !== options.length - 1 && 'border-b border-gray-100',
                )}
              >
                {option.icon && (
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                      option.value === value ? 'bg-primary-100' : 'bg-gray-100',
                    )}
                  >
                    {option.icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'font-medium block truncate',
                      option.value === value ? 'text-primary-700' : 'text-gray-900',
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {option.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      </div>

      {/* Error message */}
      {error && (
        <p className="animate-slide-down mt-1.5 text-sm text-error-600 flex items-center gap-1" role="alert">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
