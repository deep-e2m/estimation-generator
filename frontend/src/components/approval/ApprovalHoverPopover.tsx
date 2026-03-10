/**
 * Hover popover for approval control (Option B).
 * Shows "Sent to N Super PM(s)" and list of assignee name + status on hover/focus.
 */

import React, { useState, useRef, useEffect } from 'react'
import type { ApprovalRequest } from '@/types/rbac.types'

const HOVER_DELAY_MS = 400
const FOCUS_DELAY_MS = 200

function formatSentDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

function statusLabel(status: string): string {
  if (status === 'pending') return 'Pending'
  if (status === 'approved') return 'Approved'
  if (status === 'disapproved') return 'Declined'
  return status
}

interface ApprovalHoverPopoverProps {
  /** Trigger element (approval button or status pill). */
  children: React.ReactNode
  /** When empty: optional short tooltip. When set: show "Sent to N Super PM(s)" + list. */
  approvalRequests: ApprovalRequest[]
  /** Optional short tooltip when there are no requests. */
  emptyTooltip?: string
  /** Optional class for the wrapper. */
  className?: string
}

export function ApprovalHoverPopover({
  children,
  approvalRequests,
  emptyTooltip,
  className,
}: ApprovalHoverPopoverProps) {
  const [visible, setVisible] = useState(false)
  const [useTooltipOnly, setUseTooltipOnly] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const hasRequests = approvalRequests.length > 0
  const showRichContent = hasRequests

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const show = (delay: number, tooltipOnly?: boolean) => {
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      setUseTooltipOnly(!!tooltipOnly)
      setVisible(true)
      timeoutRef.current = null
    }, delay)
  }

  const hide = () => {
    clearTimer()
    setVisible(false)
  }

  useEffect(() => {
    return clearTimer
  }, [])

  const handleMouseEnter = () => {
    show(showRichContent ? HOVER_DELAY_MS : 0, !showRichContent && !!emptyTooltip)
  }
  const handleMouseLeave = () => hide()
  const handleFocus = () => show(FOCUS_DELAY_MS, false)
  const handleBlur = (e: React.FocusEvent) => {
    if (!wrapperRef.current?.contains(e.relatedTarget)) hide()
  }

  return (
    <div
      ref={wrapperRef}
      className={className ? `approval-hover-popover-wrapper ${className}` : 'approval-hover-popover-wrapper'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {visible && (
        <div
          className="approval-hover-popover"
          role="tooltip"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {showRichContent && !useTooltipOnly ? (
            <>
              <div className="approval-hover-popover-title">
                Sent to {approvalRequests.length} Super PM{approvalRequests.length !== 1 ? 's' : ''}
              </div>
              {approvalRequests[0]?.created_at && (
                <div className="approval-hover-popover-date">
                  {formatSentDate(approvalRequests[0].created_at)}
                </div>
              )}
              <ul className="approval-hover-popover-list">
                {approvalRequests.map((r) => (
                  <li key={r.id} className="approval-hover-popover-item">
                    <span className="approval-hover-popover-name">
                      {r.assigned_to?.full_name ?? r.assigned_to?.email ?? 'Unknown'}
                    </span>
                    <span className={`approval-hover-popover-status approval-hover-popover-status--${r.status}`}>
                      — {statusLabel(r.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            emptyTooltip && (
              <div className="approval-hover-popover-tooltip-only">{emptyTooltip}</div>
            )
          )}
        </div>
      )}
    </div>
  )
}
