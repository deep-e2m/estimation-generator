/**
 * Access level select for project sharing.
 * When sharing with a Developer, only read and edit_estimation are shown.
 */

import type { AccessLevel } from '@/types/rbac.types'
import type { UserRole } from '@/types/auth.types'

const ACCESS_LABELS: Record<AccessLevel, string> = {
  read: 'View only',
  edit_content: 'Edit project content',
  edit_estimation: 'Edit estimation only',
  edit_full: 'Edit content and estimation',
}

const ALL_ACCESS_LEVELS: AccessLevel[] = ['read', 'edit_content', 'edit_estimation', 'edit_full']
const DEV_ACCESS_LEVELS: AccessLevel[] = ['read', 'edit_estimation']

export function getAccessLevelsForRole(role: UserRole): AccessLevel[] {
  return role === 'dev' ? DEV_ACCESS_LEVELS : ALL_ACCESS_LEVELS
}

interface ShareAccessSelectProps {
  value: AccessLevel
  onChange: (value: AccessLevel) => void
  sharedWithRole?: UserRole
  disabled?: boolean
  className?: string
}

export function ShareAccessSelect({
  value,
  onChange,
  sharedWithRole,
  disabled,
  className,
}: ShareAccessSelectProps) {
  const options = sharedWithRole ? getAccessLevelsForRole(sharedWithRole) : ALL_ACCESS_LEVELS

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AccessLevel)}
      disabled={disabled}
      className={className}
      aria-label="Access level"
    >
      {options.map((level) => (
        <option key={level} value={level}>
          {ACCESS_LABELS[level]}
        </option>
      ))}
    </select>
  )
}

export { ACCESS_LABELS }
