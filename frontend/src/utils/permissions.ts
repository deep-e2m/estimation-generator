/**
 * Project permission utilities for RBAC.
 * Check user permissions before showing/hiding UI actions (defense in depth with backend).
 *
 * @see docs/RBAC_PERMISSIONS.md
 */

import type { ProjectAccessLevel } from '@/types/project';
import type { User } from '@/types/auth.types';

/** Project-like shape with owner and optional my_access_level (detail view) */
interface ProjectWithOwner {
  owner: { id: string };
  my_access_level?: ProjectAccessLevel;
}

/** Project list item with owner_id (list view) */
interface ProjectWithOwnerId {
  owner_id?: string | null;
  my_access_level?: ProjectAccessLevel;
}

type ProjectForPermissions = ProjectWithOwner | ProjectWithOwnerId;

function isOwner(
  user: Pick<User, 'id' | 'role'>,
  project: ProjectForPermissions
): boolean {
  const ownerId = 'owner' in project ? project.owner?.id : project.owner_id;
  return ownerId === user.id;
}

/**
 * Check if user can edit project content (name, description, documents).
 * Requires edit_content or edit_full.
 */
export function canEditProject(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  project: ProjectForPermissions | null | undefined
): boolean {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  if (isOwner(user, project)) return true;
  const level = project.my_access_level;
  return level === 'edit_content' || level === 'edit_full';
}

/**
 * Check if user can edit estimation (generate/refine/edit quotes).
 * Requires edit_estimation or edit_full.
 */
export function canEditEstimation(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  project: ProjectForPermissions | null | undefined
): boolean {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  if (isOwner(user, project)) return true;
  const level = project.my_access_level;
  return level === 'edit_estimation' || level === 'edit_full';
}

/**
 * Check if user can share project and manage shares.
 * Requires edit_full (owner, admin, or shared with edit_full).
 */
export function canShareProject(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  project: ProjectForPermissions | null | undefined
): boolean {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  if (isOwner(user, project)) return true;
  const level = project.my_access_level;
  return level === 'edit_full';
}

/**
 * Check if user can delete the project.
 * Only owner or admin can delete (not edit_full shared users).
 */
export function canDeleteProject(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  project: ProjectForPermissions | null | undefined
): boolean {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  if (isOwner(user, project)) return true;
  return false;
}

/**
 * Check if user can delete a quote in this project.
 * Requires edit_full (matches backend: quote deletion requires EDIT_FULL).
 */
export function canDeleteQuote(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  project: ProjectForPermissions | null | undefined
): boolean {
  return canShareProject(user, project);
}
