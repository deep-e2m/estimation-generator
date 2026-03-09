/**
 * Edit User Panel – side panel for updating email, password, full name, role, active status.
 * Filters stay visible; no modal overlay.
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usersService, type UserUpdatePayload } from '@/services/users.service'
import { ROLES } from '@/constants/roles'
import type { User, UserRole } from '@/types/auth.types'
import { getErrorMessage } from '@/services/api'
import { PASSWORD_RULES } from '@/types/auth.types'

function validatePasswordRealtime(pwd: string): {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
} {
  return {
    minLength: pwd.length >= PASSWORD_RULES.minLength,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
  }
}

function isPasswordValid(checks: ReturnType<typeof validatePasswordRealtime>): boolean {
  return checks.minLength && checks.uppercase && checks.lowercase && checks.number && checks.special
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: ROLES.ADMIN as UserRole, label: 'Administrator' },
  { value: ROLES.SUPER_PM as UserRole, label: 'Super PM' },
  { value: ROLES.PM as UserRole, label: 'PM' },
  { value: ROLES.DEV as UserRole, label: 'Dev' },
]

export interface EditUserPanelProps {
  user: User | null
  onClose: () => void
  currentUserId: string
}

export function EditUserPanel({ user, onClose, currentUserId }: EditUserPanelProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [isActive, setIsActive] = useState(true)

  const isSelf = user?.id === currentUserId

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setPassword('')
      setFullName(user.full_name)
      setRole(user.role)
      setIsActive(user.is_active ?? true)
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UserUpdatePayload }) =>
      usersService.update(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
  })

  const passwordChecks = validatePasswordRealtime(password)
  const hasInvalidPassword = password.trim().length > 0 && !isPasswordValid(passwordChecks)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (hasInvalidPassword) return
    const payload: UserUpdatePayload = {}
    if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
      payload.email = email.trim().toLowerCase()
    }
    if (password.trim()) {
      payload.password = password
    }
    if (fullName.trim() !== user.full_name) payload.full_name = fullName.trim()
    if (role && role !== user.role) payload.role = role as UserRole
    if (!isSelf && (user.is_active ?? true) !== isActive) payload.is_active = isActive
    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }
    updateMutation.mutate({ userId: user.id, payload })
  }

  if (!user) return null

  return (
    <div className="edit-user-panel">
      <div className="edit-user-panel-header">
        <h2 className="edit-user-panel-title">Edit user</h2>
        <button
          type="button"
          onClick={onClose}
          className="edit-user-panel-close"
          aria-label="Close"
        >
          <X className="icon-sm" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="edit-user-form edit-user-panel-form">
        <div className="edit-user-fields">
          <div className="edit-user-field">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="edit-user-input"
            />
          </div>
          <div className="edit-user-field edit-user-field-password">
            <Label htmlFor="edit-user-password">New password</Label>
            {/* Password suggestion/rules UI disabled - validation still enforced on submit */}
            <PasswordInput
              id="edit-user-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore
              aria-invalid={hasInvalidPassword}
              className={`edit-user-input ${hasInvalidPassword ? 'edit-user-input-invalid' : ''}`}
            />
          </div>
          <div className="edit-user-field">
            <Label htmlFor="edit-user-name">Full name</Label>
            <Input
              id="edit-user-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              minLength={2}
              maxLength={100}
              required
              className="edit-user-input"
            />
          </div>
          <div className="edit-user-field">
            <Label htmlFor="edit-user-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              disabled={isSelf}
            >
              <SelectTrigger id="edit-user-role" className="edit-user-input">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="select-content-in-modal" position="popper" sideOffset={4}>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="edit-user-hint">You cannot change your own role.</p>
            )}
          </div>
          {!isSelf && (
            <label className="edit-user-checkbox" htmlFor="edit-user-active">
              <input
                type="checkbox"
                id="edit-user-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="edit-user-checkbox-input"
              />
              <span className="edit-user-checkbox-label">Active</span>
            </label>
          )}
        </div>
        {updateMutation.isError && (
          <p className="edit-user-error">{getErrorMessage(updateMutation.error)}</p>
        )}
        <div className="edit-user-footer edit-user-panel-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending || hasInvalidPassword}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
