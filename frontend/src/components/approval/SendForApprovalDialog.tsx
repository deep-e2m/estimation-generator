/**
 * Dialog to send project for approval to a Superior PM.
 * Uses design system: Alert, NativeSelect, Button, dialog tokens.
 */

import { useState, useEffect } from 'react'
import { Loader2, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Alert,
  AlertDescription,
  NativeSelect,
} from '@/components/ui'
import { Button } from '@/components/ui/button'
import { approvalsService } from '@/services/approvals.service'
import { usersService } from '@/services/users.service'
import type { User } from '@/types/auth.types'
import { getErrorMessage } from '@/services/api'

interface SendForApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSent?: () => void
}

export function SendForApprovalDialog({
  open,
  onOpenChange,
  projectId,
  onSent,
}: SendForApprovalDialogProps) {
  const [superPms, setSuperPms] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedUserId('')
    const load = async () => {
      setLoading(true)
      try {
        const list = await usersService.list({ role: 'super_pm' })
        setSuperPms(list)
        if (list.length > 0) setSelectedUserId(list[0].id)
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return
    setSubmitting(true)
    setError(null)
    try {
      await approvalsService.create(projectId, { assigned_to: selectedUserId })
      onSent?.()
      onOpenChange(false)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const options = superPms.map((u) => ({
    value: u.id,
    label: `${u.full_name} (${u.email})`,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="send-for-approval-dialog">
        <DialogHeader>
          <DialogTitle>Send for approval</DialogTitle>
          <DialogDescription>
            Send this project estimation to a Superior PM for approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="send-for-approval-form">
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="send-for-approval-field">
            <NativeSelect
              label="Superior PM"
              placeholder="Select Superior PM..."
              options={options}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loading}
            />
            {loading && (
              <div className="send-for-approval-loading">
                <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                <span>Loading Superior PMs…</span>
              </div>
            )}
            {!loading && superPms.length === 0 && (
              <Alert variant="warning" className="send-for-approval-empty">
                <AlertDescription>
                  No Superior PMs in the system. Contact an admin to add a user with the Superior PM role.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="send-for-approval-footer">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedUserId || submitting || superPms.length === 0}
              leftIcon={<Send style={{ width: 18, height: 18 }} />}
            >
              Send for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
