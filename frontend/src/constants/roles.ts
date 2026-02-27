/**
 * Centralized role constants for RBAC.
 * Aligns with backend UserRole and frontend auth.types UserRole.
 */

import type { UserRole } from '@/types/auth.types'

export const ROLES = {
  ADMIN: 'admin',
  SUPER_PM: 'super_pm',
  PM: 'pm',
  DEV: 'dev',
} as const satisfies Record<string, UserRole>

/** Only super_pm can approve estimations; admin is tech-level and does not use approval workflow. */
export const APPROVER_ROLES: readonly UserRole[] = [ROLES.SUPER_PM]
export const ADMIN_ROLES: readonly UserRole[] = [ROLES.ADMIN]
export const PROJECT_CREATOR_ROLES: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPER_PM,
  ROLES.PM,
  ROLES.DEV,
]
export const PROJECT_SHARER_ROLES: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPER_PM,
  ROLES.PM,
]
