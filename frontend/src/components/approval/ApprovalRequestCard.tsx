/**
 * Card (or table row) displaying a single approval request.
 * Supports grid and list view with PM avatar, name, and email.
 */

import { useNavigate } from 'react-router-dom'
import { FileText, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import type { ApprovalRequest } from '@/types/rbac.types'
import { formatRelativeTime } from '@/lib/utils'
import { getUserAvatarUrl } from '@/lib/placeholderAvatars'

interface ApprovalRequestCardProps {
  request: ApprovalRequest
  viewMode?: 'grid' | 'list'
  onDecide?: (request: ApprovalRequest) => void
  showDecideButton?: boolean
}

const statusVariant: Record<string, 'active' | 'success' | 'secondary'> = {
  pending: 'active',
  approved: 'success',
  disapproved: 'secondary',
}

function PmInfo({ request }: { request: ApprovalRequest }) {
  const pm = request.requested_by
  const avatarUrl = getUserAvatarUrl(pm.avatar_url ?? null, pm.full_name)
  return (
    <div className="approval-request-pm">
      <Avatar
        src={avatarUrl}
        alt={pm.full_name}
        size="sm"
        fallback={pm.full_name}
        className="approval-request-pm-avatar"
      />
      <div className="approval-request-pm-details">
        <span className="approval-request-pm-name">{pm.full_name}</span>
        <span className="approval-request-pm-email">{pm.email}</span>
      </div>
    </div>
  )
}

export function ApprovalRequestCard({
  request,
  viewMode = 'grid',
  onDecide,
  showDecideButton,
}: ApprovalRequestCardProps) {
  const navigate = useNavigate()
  const isPending = request.status === 'pending'
  const projectName = request.project_name || `Project ${request.project_id}`

  if (viewMode === 'list') {
    return (
      <tr className="approval-request-row">
        <td className="approval-request-cell-pm">
          <PmInfo request={request} />
        </td>
        <td className="approval-request-cell-project">
          <span className="approval-request-project-name">{projectName}</span>
        </td>
        <td>
          <Badge variant={statusVariant[request.status] ?? 'secondary'}>
            {request.status}
          </Badge>
        </td>
        <td className="approval-request-cell-time">
          <span className="text-muted">
            <Clock className="inline h-3 w-3 mr-0.5" />
            {formatRelativeTime(request.created_at)}
          </span>
        </td>
        <td className="approval-request-cell-actions">
          <div className="approval-request-actions">
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
        </td>
      </tr>
    )
  }

  return (
    <div className="approval-request-card approval-request-card-grid">
      <div className="approval-request-card-pm">
        <PmInfo request={request} />
      </div>
      <div className="approval-request-card-body">
        <div className="approval-request-card-meta">
          <Badge variant={statusVariant[request.status] ?? 'secondary'}>
            {request.status}
          </Badge>
          <span className="approval-request-card-time">
            <Clock className="inline h-3 w-3 mr-0.5" />
            {formatRelativeTime(request.created_at)}
          </span>
        </div>
        <p className="approval-request-card-project">
          <FileText className="h-3.5 w-3.5 inline mr-1" />
          {projectName}
        </p>
        {request.disapproval_reason && (
          <p className="approval-request-card-reason">
            Reason: {request.disapproval_reason}
          </p>
        )}
      </div>
      <div className="approval-request-card-footer">
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
  )
}
