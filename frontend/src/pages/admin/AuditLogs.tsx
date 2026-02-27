import { useEffect, useState } from 'react'
import { FileText, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { auditLogsService, type AuditLogEntry, type AuditLogsListParams } from '@/services/audit-logs.service'
import { getActionLabel } from '@/constants/actionLabels'

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const perPage = 50

  const [filters, setFilters] = useState<AuditLogsListParams>({
    page: 1,
    per_page: perPage,
  })

  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [page])

  async function loadLogs() {
    try {
      setLoading(true)
      setError(null)
      const response = await auditLogsService.listLogs({
        ...filters,
        page,
        per_page: perPage,
      })

      if (response.success) {
        setLogs(response.data)
        setTotalPages(response.pagination.total_pages)
        setTotalItems(response.pagination.total_items)
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null
      setError(message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(key: keyof AuditLogsListParams, value: string | undefined) {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }))
  }

  function applyFilters() {
    setPage(1)
    loadLogs()
  }

  function clearFilters() {
    setFilters({
      page: 1,
      per_page: perPage,
    })
    setPage(1)
    setTimeout(loadLogs, 0)
  }

  function formatTimestamp(timestamp: string) {
    return format(new Date(timestamp), 'MMM d, yyyy HH:mm:ss')
  }

  function getOutcomeBadgeClass(outcome: string) {
    return outcome === 'success'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }

  const startItem = (page - 1) * perPage + 1
  const endItem = Math.min(page * perPage, totalItems)

  return (
    <div className="projects-page">
      {/* Page Header - same structure as Projects */}
      <div className="projects-page-header">
        <div className="projects-page-header-left">
          <div className="projects-page-title-row">
            <h1 className="projects-page-title">Activity Logs</h1>
            <span className="projects-page-header-icon" aria-hidden>
              <FileText style={{ width: 24, height: 24, color: 'var(--color-primary-600)' }} />
            </span>
          </div>
          <p className="projects-page-subtitle">
            System-wide activity and security audit trail
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Filter style={{ width: 18, height: 18 }} />}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {/* Filters row - when open */}
      {showFilters && (
        <div className="projects-toolbar admin-filters-row">
          <div className="admin-filters-grid">
            <div>
              <label className="admin-filter-label">Action</label>
              <input
                type="text"
                placeholder="e.g. auth.login"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="admin-filter-input"
              />
            </div>
            <div>
              <label className="admin-filter-label">Resource Type</label>
              <select
                value={filters.resource_type || ''}
                onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                className="admin-filter-select"
              >
                <option value="">All</option>
                <option value="project">Project</option>
                <option value="quote">Quote</option>
                <option value="user">User</option>
                <option value="share">Share</option>
                <option value="approval">Approval</option>
                <option value="document">Document</option>
              </select>
            </div>
            <div>
              <label className="admin-filter-label">Outcome</label>
              <select
                value={filters.outcome || ''}
                onChange={(e) => handleFilterChange('outcome', e.target.value)}
                className="admin-filter-select"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <Button variant="primary" size="md" onClick={applyFilters}>
              Apply Filters
            </Button>
            <Button variant="outline" size="md" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Content card - same list container as Projects */}
      <div className="projects-list">
        {error && (
          <div className="admin-inline-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="projects-loading">
            <Spinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon">
              <FileText style={{ width: 40, height: 40, color: 'var(--color-primary-500)' }} />
            </div>
            <p className="projects-empty-title">No audit logs found</p>
            <p className="projects-empty-description">
              Activity will appear here as users perform actions in the system.
            </p>
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-logs">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Project</th>
                    <th>Outcome</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="admin-table-cell-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td>
                        <div className="admin-table-cell-stack">
                          <span className="admin-table-cell-name">
                            {log.actor_name || 'Unknown'}
                          </span>
                          <span className="admin-table-cell-muted admin-table-cell-small">
                            {log.actor_email}
                          </span>
                          <span className="admin-table-cell-muted admin-table-cell-small">
                            ({log.actor_role})
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-table-cell-stack">
                          <span className="admin-table-cell-name">
                            {getActionLabel(log.action)}
                          </span>
                          <span className="admin-table-cell-muted admin-table-cell-small">
                            {log.action}
                          </span>
                        </div>
                      </td>
                      <td>
                        {log.resource_type && (
                          <div className="admin-table-cell-stack">
                            <span className="capitalize">{log.resource_type}</span>
                            <span className="admin-table-cell-muted admin-table-cell-small font-mono">
                              {log.resource_id?.slice(0, 8)}...
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {log.project_name && (
                          <div className="admin-table-cell-stack">
                            <span>{log.project_name}</span>
                            <span className="admin-table-cell-muted admin-table-cell-small font-mono">
                              {log.project_id?.slice(0, 8)}...
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOutcomeBadgeClass(log.outcome)}`}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="admin-table-cell-muted admin-table-cell-nowrap font-mono">
                        {log.ip_address || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="projects-pagination">
              <p className="projects-pagination-info">
                Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of{' '}
                <strong>{totalItems}</strong> entries
              </p>
              <div className="projects-pagination-controls">
                <button
                  type="button"
                  className="projects-pagination-btn projects-pagination-nav"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft style={{ width: 18, height: 18 }} />
                </button>
                <span className="admin-pagination-page">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="projects-pagination-btn projects-pagination-nav"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
