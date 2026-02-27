/**
 * Edit User Dialog – update full name, role, and active status (Admin only).
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usersService } from '@/services/users.service'
import { ROLES } from '@/constants/roles'
import type { User, UserRole } from '@/types/auth.types'
import { getErrorMessage } from '@/services/api'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: ROLES.ADMIN as UserRole, label: 'Administrator' },
  { value: ROLES.SUPER_PM as UserRole, label: 'Super PM' },
  { value: ROLES.PM as UserRole, label: 'PM' },
  { value: ROLES.DEV as UserRole, label: 'Dev' },
]

export interface EditUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  currentUserId,
}: EditUserDialogProps) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [isActive, setIsActive] = useState(true)

  const isSelf = user?.id === currentUserId

  useEffect(() => {
    if (user) {
      setFullName(user.full_name)
      setRole(user.role)
      setIsActive(user.is_active ?? true)
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: (payload: { full_name?: string; role?: UserRole; is_active?: boolean }) =>
      user ? usersService.update(user.id, payload) : Promise.reject(new Error('No user')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onOpenChange(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const payload: { full_name?: string; role?: UserRole; is_active?: boolean } = {}
    if (fullName.trim() !== user.full_name) payload.full_name = fullName.trim()
    if (role && role !== user.role) payload.role = role as UserRole
    if (!isSelf && (user.is_active ?? true) !== isActive) payload.is_active = isActive
    if (Object.keys(payload).length === 0) {
      onOpenChange(false)
      return
    }
    updateMutation.mutate(payload)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog" style={{ maxWidth: '28rem' }}>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                value={user.email}
                disabled
                style={{ marginTop: 'var(--space-1)' }}
              />
            </div>
            <div>
              <Label htmlFor="edit-user-name">Full name</Label>
              <Input
                id="edit-user-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                minLength={2}
                maxLength={100}
                style={{ marginTop: 'var(--space-1)' }}
              />
            </div>
            <div>
              <Label htmlFor="edit-user-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserRole)}
                disabled={isSelf}
              >
                <SelectTrigger id="edit-user-role" style={{ marginTop: 'var(--space-1)' }}>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginTop: 'var(--space-1)' }}>
                  You cannot change your own role.
                </p>
              )}
            </div>
            {!isSelf && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-user-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <Label htmlFor="edit-user-active">Active</Label>
              </div>
            )}
          </div>
          {updateMutation.isError && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error-600)', marginTop: 'var(--space-2)' }}>
              {getErrorMessage(updateMutation.error)}
            </p>
          )}
          <DialogFooter style={{ marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
