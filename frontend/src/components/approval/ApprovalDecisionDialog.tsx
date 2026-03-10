/**
 * Dialog for Superior PM to approve or disapprove an approval request.
 * Disapprove requires a reason. Shows request context and clear decision options.
 */

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, FileText, User } from 'lucide-react'
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
      <DialogContent className="approval-decision-dialog max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve or disapprove</DialogTitle>
          <DialogDescription>
            {request
              ? 'Review the request below and choose to approve or disapprove the estimation.'
              : 'Select your decision.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="approval-decision-dialog__form">
          {request && (
            <div className="approval-decision-dialog__context">
              <div className="approval-decision-dialog__context-row">
                <FileText className="approval-decision-dialog__context-icon" aria-hidden />
                <span className="approval-decision-dialog__context-label">Project</span>
                <span className="approval-decision-dialog__context-value">
                  {request.project_name || `Project ${request.project_id.slice(0, 8)}…`}
                </span>
              </div>
              <div className="approval-decision-dialog__context-row">
                <User className="approval-decision-dialog__context-icon" aria-hidden />
                <span className="approval-decision-dialog__context-label">Requested by</span>
                <span className="approval-decision-dialog__context-value">
                  {request.requested_by.full_name}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="approval-decision-dialog__error" role="alert">
              {error}
            </div>
          )}

          <div className="approval-decision-dialog__section">
            <span className="approval-decision-dialog__section-label">Your decision</span>
            <div className="approval-decision-dialog__options" role="radiogroup" aria-label="Approve or disapprove">
              <label
                className={`approval-decision-dialog__option ${approved ? 'approval-decision-dialog__option--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  checked={approved}
                  onChange={() => setApproved(true)}
                  className="sr-only"
                  aria-label="Approve"
                />
                <CheckCircle2 className="approval-decision-dialog__option-icon" aria-hidden />
                <span className="approval-decision-dialog__option-label">Approve</span>
                <span className="approval-decision-dialog__option-desc">Accept the estimation as-is</span>
              </label>
              <label
                className={`approval-decision-dialog__option ${!approved ? 'approval-decision-dialog__option--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  checked={!approved}
                  onChange={() => setApproved(false)}
                  className="sr-only"
                  aria-label="Disapprove"
                />
                <XCircle className="approval-decision-dialog__option-icon" aria-hidden />
                <span className="approval-decision-dialog__option-label">Disapprove</span>
                <span className="approval-decision-dialog__option-desc">Request changes with feedback</span>
              </label>
            </div>
          </div>

          {!approved && (
            <div className="approval-decision-dialog__section">
              <label htmlFor="approval-reason" className="approval-decision-dialog__section-label">
                Reason for disapproval <span className="approval-decision-dialog__required">(required)</span>
              </label>
              <Textarea
                id="approval-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain what needs to be changed or improved..."
                rows={4}
                className="approval-decision-dialog__reason"
                required={!approved}
                aria-required="true"
              />
            </div>
          )}

          <DialogFooter className="approval-decision-dialog__footer">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || (!approved && !reason.trim())}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
