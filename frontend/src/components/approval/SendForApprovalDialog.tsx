/**
 * Dialog to send project for approval to one or more Superior PMs.
 * Multi-select with checkboxes; bulk create; toast on success.
 */

import { useState, useEffect } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Alert,
  AlertDescription,
} from '@/components/ui'
import { Button } from '@/components/ui/button'
import { approvalsService } from '@/services/approvals.service'
import { usersService } from '@/services/users.service'
import type { User } from '@/types/auth.types'
import type { ApprovalRequest } from '@/types/rbac.types'
import { getErrorMessage } from '@/services/api'

interface SendForApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Existing approval requests for this project (to disable already-pending Super PMs). */
  existingApprovals?: ApprovalRequest[]
  onSent?: () => void
}

export function SendForApprovalDialog({
  open,
  onOpenChange,
  projectId,
  existingApprovals = [],
  onSent,
}: SendForApprovalDialogProps) {
  const [superPms, setSuperPms] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pendingAssigneeIds = new Set(
    existingApprovals.filter((r) => r.status === 'pending').map((r) => r.assigned_to.id)
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedUserIds([])
    const load = async () => {
      setLoading(true)
      try {
        const list = await usersService.list({ role: 'super_pm' })
        setSuperPms(list)
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, projectId])

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const selectAllAvailable = () => {
    const available = superPms.filter((u) => !pendingAssigneeIds.has(u.id)).map((u) => u.id)
    setSelectedUserIds(available)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedUserIds.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await approvalsService.createBulk(projectId, {
        assigned_to: selectedUserIds,
      })
      const n = created.length
      if (n === 1) {
        toast.success('Project sent for approval')
      } else {
        toast.success(`Sent to ${n} Super PMs`)
      }
      onSent?.()
      onOpenChange(false)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const availableCount = superPms.filter((u) => !pendingAssigneeIds.has(u.id)).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="send-for-approval-dialog"
        wrapperClassName="send-for-approval-dialog-root"
      >
        <DialogHeader className="send-for-approval-header">
          <DialogTitle className="send-for-approval-title">Send for approval</DialogTitle>
          <DialogDescription className="send-for-approval-description">
            Send this project estimation to one or more Superior PMs for approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="send-for-approval-form">
          {error && (
            <Alert variant="error" className="send-for-approval-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="send-for-approval-body">
            {loading && (
              <div className="send-for-approval-loading">
                <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                <span>Loading Superior PMs…</span>
              </div>
            )}
            {!loading && superPms.length === 0 && (
              <Alert variant="warning" className="send-for-approval-empty">
                <AlertDescription>
                  No Superior PMs in the system. Contact an admin to add a user with the Superior PM role.
                </AlertDescription>
              </Alert>
            )}
            {!loading && superPms.length > 0 && (
              <div className="send-for-approval-section">
                <div className="send-for-approval-section-header">
                  <span className="send-for-approval-section-label">Superior PMs</span>
                  {availableCount > 0 && (
                    <button
                      type="button"
                      className="send-for-approval-select-all"
                      onClick={selectAllAvailable}
                    >
                      Select all available
                    </button>
                  )}
                </div>
                <ul
                  className="send-for-approval-list"
                  role="group"
                  aria-label="Select Superior PMs"
                >
                  {superPms.map((u) => {
                    const hasPending = pendingAssigneeIds.has(u.id)
                    const isChecked = selectedUserIds.includes(u.id)
                    return (
                      <li key={u.id} className="send-for-approval-list-item">
                        <label className="send-for-approval-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={hasPending}
                            onChange={() => toggleUser(u.id)}
                            className="send-for-approval-checkbox"
                          />
                          <span className="send-for-approval-label-text">
                            {u.full_name}
                            <span className="send-for-approval-label-email"> ({u.email})</span>
                            {hasPending && (
                              <span className="send-for-approval-pending"> — Pending</span>
                            )}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter className="send-for-approval-footer">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selectedUserIds.length === 0 || submitting || superPms.length === 0}
              leftIcon={<Send style={{ width: 18, height: 18 }} />}
            >
              Send for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
