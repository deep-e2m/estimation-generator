/**
 * Dialog for Superior PM to approve or disapprove an approval request.
 * Disapprove requires a reason.
 */

import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { approvalsService } from '@/services/approvals.service'
import type { ApprovalRequest } from '@/types/rbac.types'
import { getErrorMessage } from '@/services/api'

interface ApprovalDecisionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: ApprovalRequest | null
  onDecided?: () => void
}

export function ApprovalDecisionDialog({
  open,
  onOpenChange,
  request,
  onDecided,
}: ApprovalDecisionDialogProps) {
  const [approved, setApproved] = useState<boolean>(true)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!request) return
    if (!approved && !reason.trim()) {
      setError('Please provide a reason for disapproval.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await approvalsService.decide(request.id, {
        approved,
        reason: approved ? undefined : reason.trim(),
      })
      onDecided?.()
      onOpenChange(false)
      setReason('')
      setApproved(true)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('')
      setApproved(true)
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve or disapprove</DialogTitle>
          <DialogDescription>
            {request
              ? `Respond to the approval request from ${request.requested_by.full_name}.`
              : 'Select your decision.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 text-sm mb-3">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  checked={approved}
                  onChange={() => setApproved(true)}
                />
                Approve
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="decision"
                  checked={!approved}
                  onChange={() => setApproved(false)}
                />
                Disapprove
              </label>
            </div>
            {!approved && (
              <div>
                <label className="block text-sm font-medium mb-1">Reason (required)</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why the estimation is disapproved..."
                  rows={3}
                  className="w-full"
                  required={!approved}
                />
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || (!approved && !reason.trim())}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
