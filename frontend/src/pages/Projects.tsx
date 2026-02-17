/**
 * Projects Page - Stitch Design
 *
 * Professional full-width layout with status filter tabs,
 * colorful project cards, and proper pagination.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  FolderOpen,
  Clock,
  FileText,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trash2,
  Edit,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dropdown } from '@/components/ui/dropdown'
import { Spinner } from '@/components/ui/spinner'
import { NativeSelect } from '@/components/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { projectsService } from '@/services'
import { formatRelativeTime } from '@/lib/utils'
import type { ProjectStatus } from '@/types'
import type { ProjectSummary, ProjectUpdate } from '@/types/project'

// Status tabs configuration
const STATUS_TABS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'completed', label: 'Completed' },
] as const

type ProjectEditForm = {
  name: string
  description: string
}

// Folder icon colors - matching Stitch design
const FOLDER_COLORS = [
  { bg: '#dbeafe', color: '#2563eb' }, // Blue
  { bg: '#f3e8ff', color: '#9333ea' }, // Purple
  { bg: '#fef3c7', color: '#d97706' }, // Yellow/Orange
  { bg: '#fee2e2', color: '#dc2626' }, // Red
  { bg: '#d1fae5', color: '#059669' }, // Green
] as const

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variant = {
    active: 'active' as const,
    completed: 'completed' as const,
    archived: 'archived' as const,
  }[status] || 'secondary'

  return <Badge variant={variant}>{status.toUpperCase()}</Badge>
}

// Description truncation threshold (characters)
const DESCRIPTION_TRUNCATE_LENGTH = 120

// Project card component - Stitch Design
function ProjectCard({
  project,
  index,
  onClick,
  onSeeMore,
  onAction,
}: {
  project: ProjectSummary
  index: number
  onClick: () => void
  onSeeMore: () => void
  onAction: (action: string, project: ProjectSummary) => void
}) {
  const dropdownOptions = [
    { value: 'edit', label: 'Edit Project', icon: <Edit style={{ width: 16, height: 16 }} /> },
    { value: 'archive', label: 'Archive', icon: <Archive style={{ width: 16, height: 16 }} /> },
    { value: 'divider', label: '', divider: true },
    { value: 'delete', label: 'Delete', icon: <Trash2 style={{ width: 16, height: 16 }} />, danger: true },
  ]

  // Cycle through colors
  const colors = FOLDER_COLORS[index % FOLDER_COLORS.length]

  const description = project.description || ''
  const isTruncatable = description.length > DESCRIPTION_TRUNCATE_LENGTH

  return (
    <div className="projects-card" onClick={onClick}>
      {/* Folder icon */}
      <div className="projects-card-icon" style={{ backgroundColor: colors.bg }}>
        <FolderOpen style={{ width: 24, height: 24, color: colors.color }} />
      </div>

      {/* Project info */}
      <div className="projects-card-info">
        <div className="projects-card-title-row">
          <h3 className="projects-card-title">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>
        {description && (
          <p className="projects-card-description">
            {isTruncatable ? (
              <>
                {description.slice(0, DESCRIPTION_TRUNCATE_LENGTH).trimEnd()}...
                {' '}
                <button
                  type="button"
                  className="projects-card-description-toggle"
                  onClick={(e) => {
                    // Parent card click navigates to project detail;
                    // stopping propagation here prevents accidental navigation.
                    e.stopPropagation()
                    onSeeMore()
                  }}
                >
                  See more
                </button>
              </>
            ) : (
              description
            )}
          </p>
        )}
      </div>

      {/* Meta info */}
      <div className="projects-card-meta">
        <div className="projects-card-meta-item">
          <FileText style={{ width: 14, height: 14 }} />
          <span>{project.quotes_count || 0} quotes</span>
        </div>
        {project.platform && (
          <div className="projects-card-platform">{project.platform}</div>
        )}
        <div className="projects-card-meta-item">
          <Clock style={{ width: 14, height: 14 }} />
          <span>{formatRelativeTime(project.updated_at || project.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="projects-card-actions" onClick={(e) => e.stopPropagation()}>
        <Dropdown
          trigger={
            <button className="projects-card-actions-btn">
              <MoreVertical style={{ width: 18, height: 18 }} />
            </button>
          }
          options={dropdownOptions}
          onSelect={(action) => onAction(action, project)}
        />
      </div>
    </div>
  )
}

// Empty state component
function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <Card>
      <div className="projects-empty">
        <div className="projects-empty-icon">
          <FolderOpen style={{ width: 48, height: 48, color: 'var(--color-primary-500)' }} />
        </div>
        <h3 className="projects-empty-title">No projects yet</h3>
        <p className="projects-empty-description">
          Create your first project to start generating accurate AI-powered estimates.
        </p>
        <Button onClick={onCreateNew}>
          <Plus style={{ width: 20, height: 20, marginRight: '8px' }} />
          Create Project
        </Button>
      </div>
    </Card>
  )
}

// Pagination component - Stitch Design with ellipsis
function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  // Generate page numbers to show with ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 5) {
      // Show all pages if 5 or fewer
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push('ellipsis')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }
      
      // Always show last page
      pages.push(totalPages)
    }
    
    return pages
  }

  return (
    <div className="projects-pagination">
      <p className="projects-pagination-info">
        Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalItems}</strong> results
      </p>

      <div className="projects-pagination-controls">
        <button
          className="projects-pagination-btn projects-pagination-nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft style={{ width: 18, height: 18 }} />
        </button>

        {getPageNumbers().map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="projects-pagination-ellipsis">...</span>
          ) : (
            <button
              key={page}
              className={`projects-pagination-btn ${currentPage === page ? 'projects-pagination-btn-active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}

        <button
          className="projects-pagination-btn projects-pagination-nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  )
}

export default function Projects() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const urlSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(urlSearch)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [itemsPerPage, setItemsPerPage] = useState<number>(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogProject, setDialogProject] = useState<ProjectSummary | null>(null)
  const [editForm, setEditForm] = useState<ProjectEditForm | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync URL search param into state (e.g. from global header search)
  useEffect(() => {
    setSearch(urlSearch)
    setPage(1)
  }, [urlSearch])

  // Handle items per page change
  const handleItemsPerPageChange = (newSize: number) => {
    setItemsPerPage(newSize)
    setPage(1) // Reset to first page
  }

  // Delete project mutation (cascade deletes quotes in DB; invalidate dashboard so stats/lists refresh)
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => projectsService.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-quotes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  // Archive project mutation
  const archiveMutation = useMutation({
    mutationFn: (projectId: string) => projectsService.archive(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  // Update project mutation (for inline dialog edits)
  const updateMutation = useMutation({
    mutationFn: (payload: { projectId: string; data: ProjectUpdate }) =>
      projectsService.update(payload.projectId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const isSaving = updateMutation.isPending

  // Handle dropdown actions
  const handleProjectAction = async (action: string, project: ProjectSummary) => {
    switch (action) {
      case 'edit':
        handleOpenDialog(project)
        break
      case 'archive':
        try {
          await archiveMutation.mutateAsync(project.id)
        } catch (err) {
          console.error('Failed to archive project:', err)
        }
        break
      case 'delete':
        if (window.confirm(`Are you sure you want to delete "${project.name}"?\n\nThis will permanently delete the project and all associated quotes, estimates, and chat history. This action cannot be undone.`)) {
          try {
            await deleteMutation.mutateAsync(project.id)
          } catch (err) {
            console.error('Failed to delete project:', err)
          }
        }
        break
    }
  }

  const handleOpenDialog = (project: ProjectSummary) => {
    setDialogProject(project)
    setEditForm({
      name: project.name,
      description: project.description || '',
    })
    setSaveError(null)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setDialogProject(null)
    setEditForm(null)
    setSaveError(null)
  }

  const handleEditFieldChange = (field: keyof ProjectEditForm, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSaveProject = async () => {
    if (!dialogProject || !editForm) return

    const trimmedName = editForm.name.trim()
    if (!trimmedName) {
      setSaveError('Project name is required.')
      return
    }

    const payload: ProjectUpdate = {
      name: trimmedName,
      description: editForm.description.trim() || undefined,
    }

    setSaveError(null)

    try {
      await updateMutation.mutateAsync({
        projectId: dialogProject.id,
        data: payload,
      })
      handleCloseDialog()
    } catch (err) {
      console.error('Failed to update project:', err)
      setSaveError('Failed to save changes. Please try again.')
    }
  }

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', page, search, statusFilter, itemsPerPage],
    queryFn: () =>
      projectsService.list(
        {
          search: search || undefined,
          status: statusFilter !== 'all' ? (statusFilter as ProjectStatus) : undefined,
        },
        page,
        itemsPerPage
      ),
  })

  const projects = data?.data || []
  const totalItems = data?.pagination?.total_count || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  // Handle status tab change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  return (
    <div className="projects-page">
      {/* Page Header - Stitch Design */}
      <div className="projects-page-header">
        <div className="projects-page-header-left">
          <div className="projects-page-title-row">
            <h1 className="projects-page-title">Projects</h1>
            <span className="projects-page-count">{totalItems}</span>
          </div>
          <p className="projects-page-subtitle">
            Manage your projects and generate professional quotes seamlessly.
          </p>
        </div>
        <Button onClick={() => navigate('/projects/new')} size="lg">
          <Plus style={{ width: 20, height: 20, marginRight: '8px' }} />
          New Project
        </Button>
      </div>

      {/* Search and Filters Row */}
      <div className="projects-toolbar">
        {/* Search */}
        <div className="projects-search-box">
          <Search style={{ width: 18, height: 18, color: 'var(--color-gray-400)', flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => {
              const value = e.target.value
              setSearch(value)
              setPage(1)
              const next = new URLSearchParams(searchParams)
              if (value) next.set('search', value)
              else next.delete('search')
              setSearchParams(next)
            }}
          />
        </div>

        {/* Status Tabs */}
        <div className="projects-status-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`projects-status-tab ${statusFilter === tab.value ? 'projects-status-tab-active' : ''}`}
              onClick={() => handleStatusChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Per-Page Selector */}
        <div className="projects-per-page">
          <span className="projects-per-page-label">Show</span>
          <NativeSelect
            value={String(itemsPerPage)}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
            className="projects-per-page-select"
          />
          <span className="projects-per-page-suffix">per page</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="projects-loading">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="projects-error-card">
          <p className="text-error">Failed to load projects. Please try again.</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            style={{ marginTop: 'var(--space-4)' }}
          >
            Retry
          </Button>
        </Card>
      ) : projects.length === 0 && !search && statusFilter === 'all' ? (
        <EmptyState onCreateNew={() => navigate('/projects/new')} />
      ) : projects.length === 0 ? (
        <Card className="projects-no-results">
          <FolderOpen style={{ width: 40, height: 40, color: 'var(--color-gray-300)', marginBottom: 'var(--space-4)' }} />
          <p>No projects found{search ? ` matching "${search}"` : ''}</p>
          {statusFilter !== 'all' && (
            <button 
              className="projects-clear-filter"
              onClick={() => {
                setStatusFilter('all')
                setSearch('')
              }}
            >
              Clear filters
            </button>
          )}
        </Card>
      ) : (
        <>
          {/* Projects List */}
          <div className="projects-list">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                onClick={() => navigate(`/projects/${project.id}`)}
                onSeeMore={() => handleOpenDialog(project)}
                onAction={handleProjectAction}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Project details dialog (opened from "See more") */}
      <Dialog
        open={dialogOpen && !!dialogProject}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog()
          } else if (dialogProject) {
            setDialogOpen(true)
          }
        }}
      >
        <DialogContent className="projects-detail-dialog">
          <DialogHeader>
            <DialogTitle className="projects-detail-dialog-title">
              {dialogProject?.name ?? 'Project'}
            </DialogTitle>
            {dialogProject && (
              <DialogDescription className="projects-detail-dialog-desc">
                View and edit the full project brief and client details without leaving the projects list.
              </DialogDescription>
            )}
          </DialogHeader>

          {dialogProject && editForm && (
            <div className="projects-detail-dialog-body">
              <div className="projects-detail-dialog-meta">
                <span className="projects-detail-dialog-status">
                  <span className="projects-detail-dialog-status-label">Status</span>
                  <span
                    className={`projects-detail-dialog-status-value projects-detail-dialog-status-${dialogProject.status}`}
                  >
                    {dialogProject.status.toUpperCase()}
                  </span>
                </span>
                {dialogProject.platform && (
                  <span className="projects-detail-dialog-chip">
                    {dialogProject.platform}
                  </span>
                )}
                <span className="projects-detail-dialog-chip">
                  {dialogProject.quotes_count} {dialogProject.quotes_count === 1 ? 'quote' : 'quotes'}
                </span>
              </div>

              <div className="projects-detail-dialog-field">
                <label className="projects-detail-dialog-label" htmlFor="project-name-input">
                  Project name
                </label>
                <input
                  id="project-name-input"
                  className="projects-detail-dialog-input"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => handleEditFieldChange('name', e.target.value)}
                />
              </div>

              <div className="projects-detail-dialog-field">
                <label className="projects-detail-dialog-label" htmlFor="project-description-input">
                  Project brief / description
                </label>
                <textarea
                  id="project-description-input"
                  className="projects-detail-dialog-textarea"
                  rows={8}
                  value={editForm.description}
                  onChange={(e) => handleEditFieldChange('description', e.target.value)}
                />
                <p className="projects-detail-dialog-hint">
                  Long briefs are best viewed here so the projects list stays compact.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="projects-detail-dialog-footer">
            <div className="projects-detail-dialog-footer-left">
              {saveError && <p className="projects-detail-dialog-error">{saveError}</p>}
            </div>
            <div className="projects-detail-dialog-footer-right">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveProject}
                disabled={isSaving || !dialogProject}
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
