/**
 * Normalizes backend quote responses to frontend Quote shape.
 * Backend sends content as markdown string; frontend UI expects QuoteContent (or renderable markdown).
 */

import type { Quote, QuoteContent, QuoteSummary } from '@/types';

/** Backend quote response shape (content and requirements are strings) */
export interface ApiQuote {
  id: string;
  quote_number: string;
  project_id: string;
  title: string;
  content: string;
  requirements: string;
  total_hours: number | string;
  total_cost: number | string;
  platform?: string;
  complexity?: string;
  status: string;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  version?: number;
  /** Present when returned from quote detail endpoint */
  project_name?: string | null;
  creator_name?: string | null;
}

const emptyQuoteContent: QuoteContent = {
  executive_summary: '',
  scope: { included: [], excluded: [] },
  deliverables: [],
  assumptions: [],
  risks: [],
  timeline: { estimated_start: '', estimated_end: '', milestones: [] },
  totals: {
    total_optimistic_hours: 0,
    total_most_likely_hours: 0,
    total_pessimistic_hours: 0,
    total_expected_hours: 0,
    total_cost: 0,
    currency: 'USD',
    hourly_rate: 0,
  },
  research_references: [],
};

function numeric(value: number | string | undefined | null): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build QuoteContent from backend payload. If content is a string (markdown),
 * use it as executive_summary and derive totals from root-level hours/cost.
 */
function buildContent(api: ApiQuote): QuoteContent {
  const hours = numeric(api.total_hours);
  const cost = numeric(api.total_cost);

  if (typeof api.content !== 'string' || !api.content.trim()) {
    return {
      ...emptyQuoteContent,
      totals: {
        ...emptyQuoteContent.totals,
        total_expected_hours: hours,
        total_most_likely_hours: hours,
        total_optimistic_hours: hours,
        total_pessimistic_hours: hours,
        total_cost: cost,
      },
    };
  }

  return {
    ...emptyQuoteContent,
    executive_summary: api.content,
    totals: {
      ...emptyQuoteContent.totals,
      total_expected_hours: hours,
      total_most_likely_hours: hours,
      total_optimistic_hours: hours,
      total_pessimistic_hours: hours,
      total_cost: cost,
    },
  };
}

/**
 * Normalize a quote from the API (content/requirements as strings) to frontend Quote.
 * Use when receiving quote from generate, refine, or get-by-id.
 */
export function normalizeQuoteFromApi(
  api: ApiQuote,
  options?: { projectName?: string }
): Quote {
  const projectId = api.project_id ?? '';
  const content = buildContent(api);

  const projectName = options?.projectName ?? api.project_name ?? '';
  const summary: QuoteSummary = {
    id: String(api.id),
    quote_number: api.quote_number ?? `QT-${String(api.id).slice(0, 8).toUpperCase()}`,
    version: typeof api.version === 'number' ? api.version : 1,
    status: (api.status as Quote['status']) ?? 'draft',
    project: { id: projectId, name: projectName },
    platform: (api.platform as Quote['platform']) ?? undefined,
    totals: {
      total_expected_hours: numeric(api.total_hours),
      total_cost: numeric(api.total_cost),
      currency: 'USD',
    },
    created_by: { id: String(api.created_by), full_name: '' },
    created_at: api.created_at ?? new Date().toISOString(),
    updated_at: api.updated_at ?? api.created_at ?? new Date().toISOString(),
  };

  return {
    ...summary,
    project: { id: projectId, name: projectName },
    requirements: {
      text: typeof api.requirements === 'string' ? api.requirements : '',
      attachments: [],
    },
    content,
    total_hours: numeric(api.total_hours),
    total_cost: numeric(api.total_cost),
    title: api.title,
    generation_metadata: api.metadata
      ? {
          model_used: (api.metadata.model_used as string) ?? '',
          knowledge_docs_used: (api.metadata.knowledge_docs_used as string[]) ?? [],
          confidence_score: numeric(Number(api.metadata.confidence_score)),
          generation_time_seconds: numeric(Number(api.metadata.generation_time_ms)) / 1000,
        }
      : undefined,
  };
}

/** Detect if content is markdown-only (no structured deliverables/scope from parser) */
export function isMarkdownOnlyContent(content: QuoteContent): boolean {
  return (
    (!content.deliverables || content.deliverables.length === 0) &&
    (!content.scope?.included?.length && !content.scope?.excluded?.length) &&
    !!content.executive_summary?.trim()
  );
}
