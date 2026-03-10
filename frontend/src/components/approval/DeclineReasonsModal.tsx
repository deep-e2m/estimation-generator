/**
 * Modal that shows assignee name + full disapproval reason for each declined request.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui'
import type { ApprovalRequest } from '@/types/rbac.types'

interface DeclineReasonsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Only declined requests (status === 'disapproved'). */
  declinedRequests: ApprovalRequest[]
}

export function DeclineReasonsModal({
  open,
  onOpenChange,
  declinedRequests,
}: DeclineReasonsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="decline-reasons-modal" wrapperClassName="decline-reasons-modal-root">
        <DialogHeader>
          <DialogTitle>Decline reasons</DialogTitle>
          <DialogDescription>
            Feedback from Superior PMs who declined this project.
          </DialogDescription>
        </DialogHeader>
        <div className="decline-reasons-list">
          {declinedRequests.map((r) => (
            <div key={r.id} className="decline-reasons-item">
              <div className="decline-reasons-item-name">
                {r.assigned_to?.full_name ?? r.assigned_to?.email ?? 'Unknown'}
              </div>
              <div className="decline-reasons-item-reason">
                {r.disapproval_reason || 'No reason provided.'}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
