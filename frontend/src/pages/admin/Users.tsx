/**
 * Admin User Management
 *
 * Stitch-style UI: tabs (All / Admins / Members), search + filters in one row,
 * grid/list view, user cards with actions (Edit, Activate/Deactivate, Delete, View Profile),
 * role and status filters, pagination.
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Users,
  LayoutGrid,
  List,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Filter,
  UserCircle,
} from 'lucide-react'
import { Dropdown } from '@/components/ui/dropdown'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { usersService } from '@/services/users.service'
import { ROLES, ADMIN_ROLES } from '@/constants/roles'
import type { User, UserRole } from '@/types/auth.types'
import { getErrorMessage } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { getUserAvatarUrl } from '@/lib/placeholderAvatars'
import { EditUserPanel } from './EditUserPanel'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: ROLES.ADMIN as UserRole, label: 'Administrator' },
  { value: ROLES.SUPER_PM as UserRole, label: 'Super PM' },
  { value: ROLES.PM as UserRole, label: 'PM' },
  { value: ROLES.DEV as UserRole, label: 'Dev' },
]

const PAGE_SIZE = 8

type TabId = 'all' | 'admins' | 'members'
type StatusFilter = 'all' | 'active' | 'inactive'
type ViewMode = 'grid' | 'list'

function getRoleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role
}

function roleBelongsToTab(role: UserRole, tab: TabId): boolean {
  if (tab === 'all') return true
  if (tab === 'admins') return (ADMIN_ROLES as readonly string[]).includes(role) || role === ROLES.SUPER_PM
  return role === ROLES.PM || role === ROLES.DEV
}

export default function UsersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()

  const [tab, setTab] = useState<TabId>('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const isActiveParam =
    statusFilter === 'all' ? undefined : statusFilter === 'active'

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-users', tab, search, roleFilter, statusFilter],
    queryFn: () =>
      usersService.list({
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(search.trim() && { search: search.trim() }),
        ...(statusFilter !== 'all' && { is_active: statusFilter === 'active' }),
      }),
    staleTime: 30000,
  })

  const filteredByTab = useMemo(() => {
    return users.filter((u) => roleBelongsToTab(u.role, tab))
  }, [users, tab])

  const total = filteredByTab.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages || 1)
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredByTab.slice(start, start + PAGE_SIZE)
  }, [filteredByTab, safePage])

  const updateMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      usersService.update(userId, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeleteUser(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => usersService.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeleteUser(null)
    },
  })

  const handleActivateDeactivate = (user: User) => {
    const next = !(user.is_active ?? true)
    updateMutation.mutate({ userId: user.id, is_active: next })
  }

  const handleDeleteConfirm = () => {
    if (deleteUser) deleteMutation.mutate(deleteUser.id)
  }

  const openEdit = (user: User) => setEditUser(user)

  return (
    <div className="user-management-page user-management-split">
      <div className="user-management-main">
      <div className="user-management-header">
        <div className="user-management-header-left">
          <h1 className="user-management-title">User Management</h1>
          <p className="user-management-subtitle">
            Manage and monitor system access and roles across the organization.
          </p>
        </div>
        <Button
          className="user-management-add-btn"
          onClick={() => navigate('/auth/register')}
        >
          <UserPlus className="icon-sm" />
          Add User
        </Button>
      </div>

      <div className="user-management-card">
        <div className="user-management-tabs">
          <button
            type="button"
            className={`user-management-tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            All Users
          </button>
          <button
            type="button"
            className={`user-management-tab ${tab === 'admins' ? 'active' : ''}`}
            onClick={() => setTab('admins')}
          >
            Admins
          </button>
          <button
            type="button"
            className={`user-management-tab ${tab === 'members' ? 'active' : ''}`}
            onClick={() => setTab('members')}
          >
            Members
          </button>
        </div>

        <div className="user-management-search-row">
          <div className="user-management-search-wrap">
            <Search className="user-management-search-icon" />
            <input
              type="search"
              placeholder="Search by name, email or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="user-management-search-input"
              aria-label="Search users"
            />
          </div>
          <div className="user-management-view-toggle">
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

        <div className="user-management-filters">
          <div className="user-management-filter-dropdown">
            <Filter className="filter-icon" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
              className="user-management-filter-select"
              aria-label="Filter by role"
            >
              <option value="all">Role: All</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Role: {opt.label}
                </option>
              ))}
            </select>
            <ChevronRight className="filter-chevron" style={{ transform: 'rotate(-90deg)' }} />
          </div>
          <div className="user-management-filter-dropdown">
            <UserCircle className="filter-icon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="user-management-filter-select"
              aria-label="Filter by status"
            >
              <option value="all">Status: All</option>
              <option value="active">Status: Active</option>
              <option value="inactive">Status: Inactive</option>
            </select>
            <ChevronRight className="filter-chevron" style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>
      </div>

      <div className="user-management-content">
        {updateMutation.isError && (
          <div className="admin-inline-error">
            {getErrorMessage(updateMutation.error)}
          </div>
        )}
        {deleteMutation.isError && (
          <div className="admin-inline-error">
            {getErrorMessage(deleteMutation.error)}
          </div>
        )}

        {isLoading ? (
          <div className="user-management-loading">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="admin-inline-error">{getErrorMessage(error)}</div>
        ) : filteredByTab.length === 0 ? (
          <div className="user-management-empty">
            <Users className="empty-icon" />
            <p className="empty-title">No users found</p>
            <p className="empty-desc">Try adjusting the search or filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="user-management-grid">
            {paginated.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                currentUserId={currentUser?.id ?? ''}
                onEdit={() => openEdit(user)}
                onActivateDeactivate={() => handleActivateDeactivate(user)}
                onDelete={() => setDeleteUser(user)}
                onViewProfile={() => openEdit(user)}
              />
            ))}
          </div>
        ) : (
          <div className="user-management-list-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={currentUser?.id ?? ''}
                    onEdit={() => openEdit(user)}
                    onActivateDeactivate={() => handleActivateDeactivate(user)}
                    onDelete={() => setDeleteUser(user)}
                    onViewProfile={() => openEdit(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredByTab.length > 0 && (
        <div className="user-management-pagination">
          <p className="pagination-summary">
            Showing {(safePage - 1) * PAGE_SIZE + 1} to{' '}
            {Math.min(safePage * PAGE_SIZE, total)} of {total} users
          </p>
          <div className="pagination-buttons">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="icon-sm" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={`pagination-btn ${p === safePage ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="icon-sm" />
            </button>
          </div>
        </div>
      )}

      </div>

      {editUser && (
        <div className="edit-user-panel-wrap">
          <EditUserPanel
            user={editUser}
            onClose={() => setEditUser(null)}
            currentUserId={currentUser?.id ?? ''}
          />
        </div>
      )}

      {deleteUser && (
        <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <DialogContent className="dialog max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete user?</DialogTitle>
            </DialogHeader>
            <p className="dialog-description">
              {deleteUser.full_name} ({deleteUser.email}) will be deactivated and cannot sign in.
              You can reactivate them later from Edit.
            </p>
            <DialogFooter style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => setDeleteUser(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function UserCard({
  user,
  currentUserId,
  onEdit,
  onActivateDeactivate,
  onDelete,
  onViewProfile,
}: {
  user: User
  currentUserId: string
  onEdit: () => void
  onActivateDeactivate: () => void
  onDelete: () => void
  onViewProfile: () => void
}) {
  const isActive = user.is_active ?? true
  const isSelf = user.id === currentUserId

  const menuOptions = [
    { value: 'view', label: 'View Profile', icon: <UserCircle className="icon-xs" /> },
    { value: 'edit', label: 'Edit', icon: null },
    {
      value: 'toggle',
      label: isActive ? 'Deactivate' : 'Activate',
      icon: null,
      danger: !isActive,
    },
    { value: 'delete', label: 'Delete', icon: null, danger: true },
  ].filter((o) => {
    if (o.value === 'delete' || o.value === 'toggle') return !isSelf
    return true
  })

  const handleMenuSelect = (value: string) => {
    if (value === 'view' || value === 'edit') onViewProfile()
    else if (value === 'toggle') onActivateDeactivate()
    else if (value === 'delete') onDelete()
  }

  return (
    <div className="user-card">
      <div className="user-card-top">
        <Avatar
          src={getUserAvatarUrl(user.avatar_url, user.full_name)}
          alt={user.full_name}
          size="lg"
          fallback={user.full_name}
          className="user-card-avatar"
        />
        <Dropdown
          trigger={
            <button
              type="button"
              className="user-card-menu-btn"
              aria-label="Actions"
            >
              <MoreVertical className="icon-sm" />
            </button>
          }
          options={menuOptions}
          onSelect={handleMenuSelect}
        />
      </div>
      <div className="user-card-body">
        <h3 className="user-card-name">{user.full_name}</h3>
        <p className="user-card-email">{user.email}</p>
      </div>
      <div className="user-card-badges">
        <span className={`badge badge-role ${user.role === ROLES.ADMIN ? 'badge-admin' : ''}`}>
          {getRoleLabel(user.role)}
        </span>
        <span className={`badge badge-status ${isActive ? 'badge-active' : 'badge-inactive'}`}>
          <span className="badge-dot" />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="user-card-footer">
        <span className="user-card-dept">
          {user.company_name ? `Dept: ${user.company_name}` : '—'}
        </span>
        <button
          type="button"
          className="user-card-view-link"
          onClick={onViewProfile}
        >
          View Profile
        </button>
      </div>
    </div>
  )
}

function UserRow({
  user,
  currentUserId,
  onEdit,
  onActivateDeactivate,
  onDelete,
  onViewProfile,
}: {
  user: User
  currentUserId: string
  onEdit: () => void
  onActivateDeactivate: () => void
  onDelete: () => void
  onViewProfile: () => void
}) {
  const isActive = user.is_active ?? true
  const isSelf = user.id === currentUserId

  const menuOptions = [
    { value: 'view', label: 'View Profile' },
    { value: 'edit', label: 'Edit' },
    { value: 'toggle', label: isActive ? 'Deactivate' : 'Activate' },
    { value: 'delete', label: 'Delete', danger: true },
  ].filter((o) => {
    if (o.value === 'delete' || o.value === 'toggle') return !isSelf
    return true
  })

  const handleMenuSelect = (value: string) => {
    if (value === 'view' || value === 'edit') onViewProfile()
    else if (value === 'toggle') onActivateDeactivate()
    else if (value === 'delete') onDelete()
  }

  return (
    <tr>
      <td className="admin-table-cell-name">
        <div className="user-row-cell">
          <Avatar
            src={getUserAvatarUrl(user.avatar_url, user.full_name)}
            alt={user.full_name}
            size="sm"
            fallback={user.full_name}
          />
          <span>{user.full_name}</span>
        </div>
      </td>
      <td className="admin-table-cell-muted">{user.email}</td>
      <td>
        <span className={`badge badge-role ${user.role === ROLES.ADMIN ? 'badge-admin' : ''}`}>
          {getRoleLabel(user.role)}
        </span>
      </td>
      <td>
        <span className={`badge badge-status ${isActive ? 'badge-active' : 'badge-inactive'}`}>
          <span className="badge-dot" />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <Dropdown
          trigger={
            <button type="button" className="user-card-menu-btn" aria-label="Actions">
              <MoreVertical className="icon-sm" />
            </button>
          }
          options={menuOptions}
          onSelect={handleMenuSelect}
        />
      </td>
    </tr>
  )
}
