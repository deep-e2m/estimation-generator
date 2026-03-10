/**
 * RBAC and project sharing types
 */

import type { User } from '@/types/auth.types'

export type AccessLevel =
  | 'read'
  | 'edit_content'
  | 'edit_estimation'
  | 'edit_full'

export type ApprovalStatus = 'pending' | 'approved' | 'disapproved'

export interface ProjectShare {
  id: string
  project_id: string
  shared_with_user: User
  shared_by_user: User
  access_level: AccessLevel
  created_at: string
  updated_at: string
}

export interface ProjectShareCreate {
  shared_with_user_id: string
  access_level: AccessLevel
}

export interface ProjectShareUpdate {
  access_level: AccessLevel
}

export interface ApprovalRequest {
  id: string
  project_id: string
  project_name?: string
  requested_by: User
  assigned_to: User
  status: ApprovalStatus
  disapproval_reason?: string
  created_at: string
  updated_at: string
  responded_at?: string
}

export interface ApprovalRequestCreate {
  assigned_to: string
}

/** Bulk create: send to multiple Super PMs at once. */
export interface ApprovalRequestCreateBulk {
  assigned_to: string[]
}

export interface ApprovalDecision {
  approved: boolean
  reason?: string
}
