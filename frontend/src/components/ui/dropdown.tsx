import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Dropdown Component
 * 
 * Uses centralized CSS classes from styles/components.css
 */

export interface DropdownOption {
  value: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  divider?: boolean
}

export interface DropdownProps {
  trigger: React.ReactNode
  options: DropdownOption[]
  onSelect: (value: string) => void
  align?: 'left' | 'right'
  className?: string
}

function Dropdown({ trigger, options, onSelect, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const handleSelect = (value: string) => {
    onSelect(value)
    setOpen(false)
  }

  return (
    <div ref={dropdownRef} className={cn('dropdown', className)}>
      <div 
        className="dropdown-trigger" 
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </div>

      {open && (
        <div 
          className="dropdown-content"
          style={{ [align === 'left' ? 'left' : 'right']: 0 }}
        >
          {options.map((option, index) => {
            if (option.divider) {
              return <div key={index} className="dropdown-divider" />
            }
            return (
              <button
                key={option.value}
                type="button"
                className={cn('dropdown-item', option.danger && 'dropdown-item-danger')}
                onClick={() => handleSelect(option.value)}
              >
                {option.icon && <span style={{ flexShrink: 0 }}>{option.icon}</span>}
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { Dropdown }
