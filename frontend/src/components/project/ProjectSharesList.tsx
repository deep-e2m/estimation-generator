/**
 * List of project shares with option to update access or remove.
 */

import { useState, useEffect } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShareAccessSelect, ACCESS_LABELS } from './ShareAccessSelect'
import { projectSharesService } from '@/services/project-shares.service'
import type { ProjectShare, AccessLevel } from '@/types/rbac.types'
import type { UserRole } from '@/types/auth.types'
import { getAccessLevelsForRole } from './ShareAccessSelect'
import { getErrorMessage } from '@/services/api'

interface ProjectSharesListProps {
  projectId: string
  onUpdate?: () => void
}

export function ProjectSharesList({ projectId, onUpdate }: ProjectSharesListProps) {
  const [shares, setShares] = useState<ProjectShare[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLevel, setEditLevel] = useState<AccessLevel>('read')
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await projectSharesService.list(projectId)
      setShares(list)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId])

  const handleUpdate = async (shareId: string) => {
    const share = shares.find((s) => s.id === shareId)
    if (!share) return
    const allowed = getAccessLevelsForRole(share.shared_with_user.role as UserRole)
    if (!allowed.includes(editLevel)) return
    try {
      await projectSharesService.update(projectId, shareId, { access_level: editLevel })
      setEditingId(null)
      load()
      onUpdate?.()
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  const handleRemove = async (shareId: string) => {
    if (!confirm('Remove this share?')) return
    try {
      await projectSharesService.remove(projectId, shareId)
      load()
      onUpdate?.()
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading shares...
      </div>
    )
  }
  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }
  if (shares.length === 0) {
    return <p className="text-sm text-gray-500">No one else has access to this project.</p>
  }

  return (
    <ul className="space-y-2">
      {shares.map((share) => (
        <li
          key={share.id}
          className="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
        >
          <div className="min-w-0">
            <span className="font-medium truncate block">{share.shared_with_user.full_name}</span>
            <span className="text-xs text-gray-500 truncate block">{share.shared_with_user.email}</span>
          </div>
          {editingId === share.id ? (
            <div className="flex items-center gap-2">
              <ShareAccessSelect
                value={editLevel}
                onChange={setEditLevel}
                sharedWithRole={share.shared_with_user.role as UserRole}
                className="rounded border px-2 py-1 text-sm"
              />
              <Button size="icon-sm" onClick={() => handleUpdate(share.id)}>
                Save
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {ACCESS_LABELS[share.access_level]}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Edit access"
                onClick={() => {
                  setEditingId(share.id)
                  setEditLevel(share.access_level)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove share"
                onClick={() => handleRemove(share.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
