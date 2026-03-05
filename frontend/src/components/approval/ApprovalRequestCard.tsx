/**
 * Card displaying a single approval request (for list/detail views).
 */

import { useNavigate } from 'react-router-dom'
import { FileText, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ApprovalRequest } from '@/types/rbac.types'
import { formatRelativeTime } from '@/lib/utils'

interface ApprovalRequestCardProps {
  request: ApprovalRequest
  onDecide?: (request: ApprovalRequest) => void
  showDecideButton?: boolean
}

const statusVariant: Record<string, 'active' | 'success' | 'secondary'> = {
  pending: 'active',
  approved: 'success',
  disapproved: 'secondary',
}

export function ApprovalRequestCard({
  request,
  onDecide,
  showDecideButton,
}: ApprovalRequestCardProps) {
  const navigate = useNavigate()
  const isPending = request.status === 'pending'

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant[request.status] ?? 'secondary'}>
              {request.status}
            </Badge>
            <span className="text-xs text-gray-500">
              <Clock className="inline h-3 w-3 mr-0.5" />
              {formatRelativeTime(request.created_at)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            Requested by {request.requested_by.full_name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {request.project_name || `Project ${request.project_id}`}
          </p>
          {request.disapproval_reason && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
              Reason: {request.disapproval_reason}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/projects/${request.project_id}`)}
          >
            View project
          </Button>
          {showDecideButton && isPending && onDecide && (
            <Button size="sm" onClick={() => onDecide(request)}>
              Approve / Disapprove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
