import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * Dropdown Component
 *
 * Uses centralized CSS classes from styles/components.css.
 * Renders menu in a portal when open so it is not clipped by overflow containers,
 * and flips above the trigger when there is not enough space below.
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

const DROPDOWN_MENU_GAP = 8
const DROPDOWN_MENU_MIN_HEIGHT = 120

function Dropdown({ trigger, options, onSelect, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({ visibility: 'hidden' })
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Position menu in viewport (portal) and flip above when near bottom
  React.useLayoutEffect(() => {
    if (!open || !dropdownRef.current || !menuRef.current) return

    const triggerEl = dropdownRef.current
    const menuEl = menuRef.current
    const rect = triggerEl.getBoundingClientRect()
    const menuHeight = menuEl.offsetHeight || DROPDOWN_MENU_MIN_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight + DROPDOWN_MENU_GAP

    const top = openUp ? rect.top - menuHeight - DROPDOWN_MENU_GAP : rect.bottom + DROPDOWN_MENU_GAP

    setMenuStyle({
      position: 'fixed',
      top,
      left: align === 'left' ? rect.left : undefined,
      right: align === 'right' ? window.innerWidth - rect.right : undefined,
      minWidth: 180,
      zIndex: 50,
      visibility: 'visible',
    })
  }, [open, align, options.length])

  React.useEffect(() => {
    if (!open) setMenuStyle({ visibility: 'hidden' })
  }, [open])

  // Close on click outside (trigger is in page, menu is in portal)
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        dropdownRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return
      setOpen(false)
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

  const menuContent = open && (
    <div
      ref={menuRef}
      className="dropdown-content dropdown-content-portal"
      style={menuStyle}
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
  )

  return (
    <div ref={dropdownRef} className={cn('dropdown', className)}>
      <div
        className="dropdown-trigger"
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </div>
      {typeof document !== 'undefined' && createPortal(menuContent, document.body)}
    </div>
  )
}

export { Dropdown }
