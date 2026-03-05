/**
 * Dialog to send project for approval to a Superior PM.
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
import { approvalsService } from '@/services/approvals.service'
import { usersService } from '@/services/users.service'
import type { User } from '@/types/auth.types'
import { getErrorMessage } from '@/services/api'

interface SendForApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSent?: () => void
}

export function SendForApprovalDialog({
  open,
  onOpenChange,
  projectId,
  onSent,
}: SendForApprovalDialogProps) {
  const [superPms, setSuperPms] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedUserId('')
    const load = async () => {
      setLoading(true)
      try {
        const list = await usersService.list({ role: 'super_pm' })
        setSuperPms(list)
        if (list.length > 0) setSelectedUserId(list[0].id)
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return
    setSubmitting(true)
    setError(null)
    try {
      await approvalsService.create(projectId, { assigned_to: selectedUserId })
      onSent?.()
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
          <DialogTitle>Send for approval</DialogTitle>
          <DialogDescription>
            Send this project estimation to a Superior PM for approval.
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
              <label className="block text-sm font-medium mb-1">Superior PM</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                disabled={loading}
              >
                <option value="">Select Superior PM...</option>
                {superPms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
              {!loading && superPms.length === 0 && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                  No Superior PMs in the system. Contact an admin to add a user with the Superior PM role.
                </p>
              )}
              {loading && (
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedUserId || submitting || superPms.length === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
