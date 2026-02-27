/**
 * Approval Requests page (Super PM / Admin).
 * Lists approval requests assigned to the current user; allows approve/disapprove.
 */

import { useState, useEffect } from 'react'
import { Loader2, Inbox } from 'lucide-react'
import { approvalsService } from '@/services/approvals.service'
import { ApprovalRequestCard } from '@/components/approval/ApprovalRequestCard'
import { ApprovalDecisionDialog } from '@/components/approval/ApprovalDecisionDialog'
import type { ApprovalRequest } from '@/types/rbac.types'
import { getErrorMessage } from '@/services/api'

export default function ApprovalRequestsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decideDialogOpen, setDecideDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await approvalsService.list('pending')
      setRequests(list)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDecide = (request: ApprovalRequest) => {
    setSelectedRequest(request)
    setDecideDialogOpen(true)
  }

  const handleDecided = () => {
    load()
    setSelectedRequest(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Approval requests</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Projects sent to you for estimation approval. Approve or disapprove with a reason.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3">
          {error}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center">
          <Inbox className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No pending approval requests.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id}>
              <ApprovalRequestCard
                request={req}
                showDecideButton
                onDecide={handleDecide}
              />
            </li>
          ))}
        </ul>
      )}

      <ApprovalDecisionDialog
        open={decideDialogOpen}
        onOpenChange={setDecideDialogOpen}
        request={selectedRequest}
        onDecided={handleDecided}
      />
    </div>
  )
}
