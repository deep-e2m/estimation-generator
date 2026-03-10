/**
 * Approval Requests page (Super PM / Admin).
 * Lists approval requests assigned to the current user; allows approve/disapprove.
 * Grid/list view toggle and PM info (avatar, name, email) like User Management.
 */

import { useState, useEffect } from 'react'
import { Inbox, LayoutGrid, List } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { approvalsService } from '@/services/approvals.service'
import { ApprovalRequestCard } from '@/components/approval/ApprovalRequestCard'
import { ApprovalDecisionDialog } from '@/components/approval/ApprovalDecisionDialog'
import type { ApprovalRequest } from '@/types/rbac.types'
import { getErrorMessage } from '@/services/api'

type ViewMode = 'grid' | 'list'

export default function ApprovalRequestsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decideDialogOpen, setDecideDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

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
    <div className="projects-page approval-requests-page">
      {/* Page Header - same structure and position as Projects */}
      <div className="projects-page-header">
        <div className="projects-page-header-left">
          <div className="projects-page-title-row">
            <h1 className="projects-page-title">Approval Requests</h1>
            {!loading && <span className="projects-page-count">{requests.length}</span>}
          </div>
          <p className="projects-page-subtitle">
            Projects sent to you for estimation approval. Approve or disapprove with a reason.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="projects-loading">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="projects-error-card">
          <p className="text-error">{error}</p>
          <Button
            variant="outline"
            onClick={() => load()}
            style={{ marginTop: 'var(--space-4)' }}
          >
            Retry
          </Button>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="approval-requests-empty-card">
          <div className="projects-empty">
            <div className="projects-empty-icon">
              <Inbox style={{ width: 48, height: 48, color: 'var(--color-primary-500)' }} />
            </div>
            <h3 className="projects-empty-title">No pending approval requests</h3>
            <p className="projects-empty-description">
              Projects sent to you for estimation approval will appear here. Approve or disapprove with a reason.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card className="approval-requests-toolbar-card">
            <div className="approval-requests-search-row">
              <div className="approval-requests-search-spacer" aria-hidden />
              <div className="approval-requests-view-toggle">
                <button
                  type="button"
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <List className="icon-sm" />
                </button>
                <button
                  type="button"
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="icon-sm" />
                </button>
              </div>
            </div>
          </Card>

          <div className="approval-requests-content">
            {viewMode === 'grid' ? (
              <div className="approval-requests-grid">
                {requests.map((req) => (
                  <ApprovalRequestCard
                    key={req.id}
                    request={req}
                    viewMode="grid"
                    showDecideButton
                    onDecide={handleDecide}
                  />
                ))}
              </div>
            ) : (
              <div className="approval-requests-list-wrap">
                <table className="approval-requests-table">
                  <thead>
                    <tr>
                      <th>Requested by</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Requested</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <ApprovalRequestCard
                        key={req.id}
                        request={req}
                        viewMode="list"
                        showDecideButton
                        onDecide={handleDecide}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
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
