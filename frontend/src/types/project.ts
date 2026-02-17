/**
 * Project Type Definitions
 * Types for project management in the Estimate AI system
 */

import type { User, UserRole } from './index';

// Project status enum
export type ProjectStatus = 'active' | 'archived' | 'completed';

// Platform options for projects (must match backend Platform enum - lowercase)
export type ProjectPlatform = 'wordpress';

// Team member type
export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  joined_at: string;
}

// Project summary for list views
export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  platform?: ProjectPlatform;
  status: ProjectStatus;
  quotes_count: number;
  created_at: string;
  updated_at: string;
}

// Full project details
export interface Project extends ProjectSummary {
  additional_instructions?: string;
  client_email?: string;
  target_completion_date?: string;
  owner: Pick<User, 'id' | 'full_name' | 'email' | 'avatar_url'>;
  team_members: TeamMember[];
  requirements_count?: number;
}

// Create project request
export interface ProjectCreate {
  name: string;
  description?: string;
  additional_instructions?: string;
  platform?: ProjectPlatform;
  // Optional client fields (for future use)
  client_id?: string;
  new_client?: {
    name: string;
    email?: string;
  };
}

// Update project request
export interface ProjectUpdate {
  name?: string;
  description?: string;
  client_email?: string;
  platform?: ProjectPlatform;
  status?: ProjectStatus;
  target_completion_date?: string;
}

// Project list response with pagination
export interface ProjectListResponse {
  data: ProjectSummary[];
  pagination: {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
  };
}

// Project filters for list queries
export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus;
  platform?: ProjectPlatform;
  sort_by?: 'created_at' | 'name' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}
