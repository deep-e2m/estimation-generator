/**
 * Quote-related type definitions
 * Based on API contracts specification
 */

import type { Quote, QuoteContent } from '@/types';
export type { Quote, QuoteContent };

// Platform options for quote generation (must match backend Platform enum)
export type Platform = 'wordpress';

// Quote status lifecycle
export type QuoteStatus =
  | 'generating'
  | 'draft'
  | 'published'
  | 'finalized'
  | 'sent'
  | 'accepted'
  | 'approved'
  | 'rejected'
  | 'archived';

// Generation progress steps
export type GenerationStep =
  | 'parsing_input'
  | 'analyzing_requirements'
  | 'retrieving_knowledge'
  | 'generating_estimate'
  | 'formatting_output';

// Estimation approach options
export type EstimationApproach = 'single_point' | 'three_point' | 't_shirt';

// Detail level for generation
export type DetailLevel = 'summary' | 'standard' | 'detailed';

// Hours estimation structure (three-point estimation)
export interface HoursEstimate {
  optimistic_hours: number;
  most_likely_hours: number;
  pessimistic_hours: number;
  expected_hours: number;
  cost?: number;
}

// Individual deliverable/line item
export interface Deliverable {
  id: string;
  name: string;
  description: string;
  category?: string;
  estimate: HoursEstimate;
  notes?: string;
}

// Risk assessment
export interface Risk {
  id?: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

// Timeline milestone
export interface Milestone {
  name: string;
  target_date: string;
}

// Quote timeline section
export interface QuoteTimeline {
  estimated_start: string;
  estimated_end: string;
  milestones: Milestone[];
}

// Quote totals summary
export interface QuoteTotals {
  total_optimistic_hours: number;
  total_most_likely_hours: number;
  total_pessimistic_hours: number;
  total_expected_hours: number;
  total_cost: number;
  currency: string;
  hourly_rate: number;
}

// Scope section
export interface QuoteScope {
  included: string[];
  excluded: string[];
}

// Research reference link
export interface ResearchReference {
  id?: string;
  summary: string;
  url: string;
  source_type: 'official_docs' | 'plugin_page' | 'api_reference' | 'community' | 'other';
  relevance_note: string;
  is_valid?: boolean;
}

// User reference
export interface UserRef {
  id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
}

// Project reference
export interface ProjectRef {
  id: string;
  name: string;
}

// Attachment reference
export interface AttachmentRef {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  url: string;
  thumbnail_url?: string;
}

// Quote requirements input
export interface QuoteRequirements {
  text: string;
  attachments: AttachmentRef[];
}

// Generation metadata
export interface GenerationMetadata {
  model_used: string;
  knowledge_docs_used: string[];
  confidence_score: number;
  generation_time_seconds: number;
}

// Quote list item (summary view)
export interface QuoteListItem {
  id: string;
  quote_number: string;
  version: number;
  status: QuoteStatus;
  totals: Pick<QuoteTotals, 'total_expected_hours' | 'total_cost' | 'currency'>;
  created_by: UserRef;
  created_at: string;
  updated_at: string;
}

// Generation options for quote request
export interface GenerationOptions {
  detail_level: DetailLevel;
  include_assumptions: boolean;
  include_risks: boolean;
  estimation_approach: EstimationApproach;
  currency: string;
  hourly_rate: number;
}

// Analysis metadata from quote generation
export interface AnalysisMetadata {
  requirements_count: number;
  tasks_count: number;
  sections_count: number;
  pages_count: number;
  complexity_factors: string[];
}

// Quote generation request - matches backend QuoteGenerateRequest schema
export interface GenerateQuoteRequest {
  requirements: string;  // min 10 chars, max 50000 chars
  title?: string;        // optional title, max 500 chars
  hourly_rate?: number;  // optional hourly rate for cost calculation
  use_rag?: boolean;     // whether to use RAG context from knowledge base (default true)
  regenerate?: boolean;  // if true, delete existing estimate and create new one
  project_context?: {    // additional project context
    platform?: Platform;
    project_name?: string;
    industry?: string;
    /** SOW/source document text (e.g. extracted from uploaded PDF) for accurate timeline, sitemap, exclusions */
    document_summary?: string;
    additional_instructions?: string;
    /** Explicit reference URLs to scrape and include in the brief (when URL scraping is enabled) */
    reference_urls?: string[];
    /** When set, backend crawls this URL for same-host pages and includes all in the brief (full-site estimation) */
    crawl_site_from_url?: string;
    [key: string]: unknown;
  };
}

// Quote generation response (async)
export interface GenerateQuoteResponse {
  quote_id: string;
  quote_number: string;
  version: number;
  status: 'generating';
  generation_job_id: string;
  estimated_completion_seconds: number;
  created_at: string;
}

// Generation progress tracking
export interface GenerationProgress {
  quote_id: string;
  status: 'generating' | 'completed' | 'failed';
  progress: {
    current_step: GenerationStep;
    steps_completed: number;
    total_steps: number;
    percentage: number;
    message?: string;
  };
  started_at: string;
  completed_at?: string;
  redirect_url?: string;
  error?: {
    code: string;
    message: string;
  };
}

// Quote update request (partial update)
export interface UpdateQuoteRequest {
  content?: Partial<QuoteContent>;
  status?: QuoteStatus;
}

// Export options
export interface ExportOptions {
  template: 'professional' | 'minimal' | 'detailed' | 'editable' | 'print_ready';
  include_sections: {
    executive_summary: boolean;
    scope: boolean;
    deliverables: boolean;
    timeline: boolean;
    assumptions: boolean;
    risks: boolean;
    terms_and_conditions?: boolean;
  };
  branding?: {
    company_logo_url?: string;
    primary_color?: string;
    include_footer?: boolean;
  };
  metadata?: {
    prepared_for?: string;
    prepared_by?: string;
    valid_until?: string;
  };
}

// Export job status
export interface ExportJob {
  export_job_id: string;
  status: 'processing' | 'completed' | 'failed';
  format: 'pdf' | 'docx';
  progress_percentage?: number;
  download_url?: string;
  download_url_expires_at?: string;
  file_size?: number;
  started_at: string;
  completed_at?: string;
  error?: {
    code: string;
    message: string;
  };
}

// Chat and Refinement Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  changes?: ChangeDescription[];
}

export interface ChangeDescription {
  section: string;
  change_type: 'added' | 'updated' | 'removed';
  description: string;
  field_path?: string;
}

export interface RefineQuoteRequest {
  message: string;
  /** Current quote content from editor (e.g. BlockNote JSON); when sent, refinement uses it so unsaved edits are not lost. */
  current_content?: string | null;
}

/** Project fields updated via refine chat (name/description). */
export interface RefinedProjectUpdate {
  name?: string | null;
  description?: string | null;
}

export interface RefineQuoteResponse {
  updated_quote: Quote;
  ai_message: string;
  changes_applied: ChangeDescription[];
  /** Set when the user asked to change project name or description via chat. */
  updated_project?: RefinedProjectUpdate | null;
}
