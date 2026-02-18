// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
      code: string;
    }>;
    request_id?: string;
    timestamp?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
    page?: number;
  };
}

// User Types
export type UserRole = 'Admin' | 'PM';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

// Platform Type (used by both Project and Quote)
export type Platform = 'wordpress';

// Project Types
export type ProjectStatus = 'active' | 'archived' | 'completed';

export interface Project {
  additional_instructions: any;
  id: string;
  name: string;
  description?: string;
  platform?: Platform;
  client_email?: string;
  target_completion_date?: string;
  status: ProjectStatus;
  owner: Pick<User, 'id' | 'full_name' | 'email' | 'avatar_url'>;
  team_members: TeamMember[];
  quotes_count: number;
  requirements_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  joined_at: string;
}

// Quote Types
export type QuoteStatus = 'generating' | 'draft' | 'published' | 'finalized' | 'sent' | 'accepted' | 'approved' | 'rejected' | 'archived';

export interface QuoteSummary {
  id: string;
  quote_number: string;
  version: number;
  status: QuoteStatus;
  project?: {
    id: string;
    name: string;
  };
  platform?: Platform;
  totals: {
    total_expected_hours: number;
    total_cost: number;
    currency: string;
  };
  created_by: Pick<User, 'id' | 'full_name'>;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  estimate: {
    optimistic_hours: number;
    most_likely_hours: number;
    pessimistic_hours: number;
    expected_hours: number;
    cost: number;
  };
}

export interface Risk {
  description: string;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface Milestone {
  name: string;
  target_date: string;
}

/** Legacy key-value section format (used only for conversion to BlockNote). */
export type EstimationOutcomes = Record<string, string>;

export interface QuoteContent {
  executive_summary: string;
  scope: {
    included: string[];
    excluded: string[];
  };
  deliverables: Deliverable[];
  assumptions: string[];
  risks: Risk[];
  timeline: {
    estimated_start: string;
    estimated_end: string;
    milestones: Milestone[];
  };
  totals: {
    total_optimistic_hours: number;
    total_most_likely_hours: number;
    total_pessimistic_hours: number;
    total_expected_hours: number;
    total_cost: number;
    currency: string;
    hourly_rate: number;
  };
  /** Optional for compatibility with quote.types; normalizer sets [] for API quotes */
  research_references?: Array<{ summary: string; url: string; relevance_note: string }>;
}

export interface Attachment {
  id: string;
  filename: string;
  original_filename?: string;
  file_type: string;
  file_size: number;
  url: string;
  thumbnail_url?: string;
}

export interface Quote extends QuoteSummary {
  project: {
    id: string;
    name: string;
  };
  requirements: {
    text: string;
    attachments: Attachment[];
  };
  content: QuoteContent;
  // Backend may return these at root level (for simpler quotes)
  total_hours?: number;
  total_cost?: number;
  title?: string;
  /** Name shown as "Prepared by" (default E2M Solutions; editable by user). From API prepared_by or metadata.prepared_by. */
  prepared_by?: string;
  /** API returns quote metadata (extra_data); may include prepared_by if user edited. */
  metadata?: { prepared_by?: string; [key: string]: unknown };
  generation_metadata?: {
    model_used: string;
    knowledge_docs_used: string[];
    confidence_score: number;
    generation_time_seconds: number;
  };
}

export interface QuoteVersion {
  id: string;
  quote_number: string;
  version: number;
  version_note?: string;
  status: QuoteStatus;
  totals: {
    total_expected_hours: number;
    total_cost: number;
    currency: string;
  };
  created_by: Pick<User, 'id' | 'full_name'>;
  created_at: string;
}

// Feedback Types
export type FeedbackRating = 'positive' | 'negative';

export type FeedbackCategory =
  | 'accuracy'
  | 'completeness'
  | 'clarity'
  | 'assumptions'
  | 'risks'
  | 'formatting'
  | 'speed';

export interface DeliverableFeedback {
  deliverable_id: string;
  deliverable_name?: string;
  rating: FeedbackRating;
  comment?: string;
}

export interface Feedback {
  feedback_id: string;
  quote_id: string;
  rating: FeedbackRating;
  feedback_categories?: FeedbackCategory[];
  comment?: string;
  specific_feedback?: DeliverableFeedback[];
  submitted_by: Pick<User, 'id' | 'full_name'>;
  created_at: string;
  updated_at?: string;
}

export interface FeedbackSubmission {
  rating: FeedbackRating;
  feedback_categories?: FeedbackCategory[];
  comment?: string;
  specific_feedback?: Omit<DeliverableFeedback, 'deliverable_name'>[];
}

// Export Types
export type ExportFormat = 'pdf' | 'docx';
export type ExportStatus = 'processing' | 'completed' | 'failed';

export interface ExportJob {
  export_job_id: string;
  format: ExportFormat;
  template?: string;
  status: ExportStatus;
  file_size?: number;
  download_url?: string;
  download_url_expires_at?: string;
  progress_percentage?: number;
  created_by: Pick<User, 'id' | 'full_name'>;
  created_at: string;
  completed_at?: string;
}

// Filter Types
export interface QuoteFilters {
  search?: string;
  status?: QuoteStatus;
  platform?: Platform;
  date_from?: string;
  date_to?: string;
  sort_by?: 'created_at' | 'quote_number' | 'total_hours' | 'client';
  sort_order?: 'asc' | 'desc';
}

// Re-export quote types (exclude ChatMessage to avoid clash with chat.ChatMessage)
export type {
  GenerationStep,
  EstimationApproach,
  DetailLevel,
  HoursEstimate,
  QuoteTimeline,
  QuoteTotals,
  QuoteScope,
  ResearchReference,
  UserRef,
  ProjectRef,
  AttachmentRef,
  QuoteRequirements,
  GenerationMetadata,
  QuoteListItem,
  GenerationOptions,
  GenerateQuoteRequest,
  GenerateQuoteResponse,
  GenerationProgress,
  UpdateQuoteRequest,
  ExportOptions,
  ChangeDescription,
  RefineQuoteRequest,
  RefineQuoteResponse,
} from './quote.types';
export * from './file.types';
export * from './project';
export * from './chat';
