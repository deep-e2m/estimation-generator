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

// Content quality check (before project creation)
export interface CheckContentQualityRequest {
  project_name: string;
  description: string;
  additional_instructions?: string;
  /** Plain text from attached/source documents; when provided, quality is evaluated for form + document together */
  document_text?: string;
  /** When provided, backend loads requirement documents for this project and includes their text in the check */
  project_id?: string;
}

export interface ContentQualityFeedback {
  project_name: string[];
  description: string[];
  additional_instructions: string[];
}

export interface CheckContentQualityData {
  overall_sufficient: boolean;
  score: number;
  feedback: ContentQualityFeedback;
  suggested_improvements: string;
}

export interface CheckContentQualityResponse {
  success: boolean;
  data: CheckContentQualityData;
}

/** Scraped content and screenshot for a reference URL (preview for estimation). */
export interface ReferenceUrlPreviewData {
  url: string;
  extracted_text: string;
  screenshot_base64: string | null;
  error: string | null;
}

/** Full-site preview: crawl + scrape result (one screenshot + text per page). */
export interface ReferenceUrlSitePreviewData {
  seed_url: string;
  pages: ReferenceUrlPreviewData[];
}
