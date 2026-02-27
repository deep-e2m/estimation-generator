/**
 * Dialog to share a project with another user.
 * Fetches users list (filtered by role optional), allows selecting user and access level.
 */

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'
import { Button } from '@/components/ui/button'
import { ShareAccessSelect, getAccessLevelsForRole } from './ShareAccessSelect'
import { projectSharesService } from '@/services/project-shares.service'
import { usersService } from '@/services/users.service'
import type { User } from '@/types/auth.types'
import type { AccessLevel } from '@/types/rbac.types'
import { getErrorMessage } from '@/services/api'

interface ShareProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onShared?: () => void
}

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
  onShared,
}: ShareProjectDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('read')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedUserId('')
    setAccessLevel('read')
    const load = async () => {
      setLoadingUsers(true)
      try {
        const list = await usersService.list({})
        setUsers(list)
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoadingUsers(false)
      }
    }
    load()
  }, [open])

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const allowedLevels = selectedUser ? getAccessLevelsForRole(selectedUser.role) : []
  const effectiveAccess = allowedLevels.includes(accessLevel) ? accessLevel : (allowedLevels[0] ?? 'read')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return
    setSubmitting(true)
    setError(null)
    try {
      await projectSharesService.create(projectId, {
        shared_with_user_id: selectedUserId,
        access_level: effectiveAccess,
      })
      onShared?.()
      onOpenChange(false)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            Share this project with another user. Choose their access level.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 text-sm mb-3">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">User</label>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value)
                  const u = users.find((x) => x.id === e.target.value)
                  if (u) {
                    const levels = getAccessLevelsForRole(u.role)
                    setAccessLevel(levels.includes(accessLevel) ? accessLevel : levels[0])
                  }
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                disabled={loadingUsers}
              >
                <option value="">Select user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email}) – {u.role}
                  </option>
                ))}
              </select>
            </div>
            {selectedUserId && (
              <div>
                <label className="block text-sm font-medium mb-1">Access level</label>
                <ShareAccessSelect
                  value={effectiveAccess}
                  onChange={setAccessLevel}
                  sharedWithRole={selectedUser?.role}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedUserId || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Share
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
