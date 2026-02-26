/**
 * Normalizes backend quote responses to frontend Quote shape.
 * Backend sends content as markdown string; frontend UI expects QuoteContent (or renderable markdown).
 */

import { estimationOutcomesToBlockNoteBlocks } from '@/lib/estimation-outcomes-to-blocks';
import type { Quote, QuoteContent, QuoteSummary, Deliverable } from '@/types';

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
  /** "Prepared by" display value (default E2M Solutions from backend) */
  prepared_by?: string | null;
}

/** Backend breakdown item structure (stored in metadata.breakdown) */
interface BackendBreakdownItem {
  phase: string;
  hours_min?: number;
  hours_max?: number;
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
 * Convert backend breakdown items to frontend Deliverable format
 */
function convertBreakdownToDeliverables(breakdown: unknown): Deliverable[] {
  if (!Array.isArray(breakdown)) {
    return [];
  }

  return breakdown
    .filter((item): item is BackendBreakdownItem => {
      return (
        typeof item === 'object' &&
        item !== null &&
        'phase' in item &&
        typeof item.phase === 'string'
      );
    })
    .map((item, index) => {
      const hours_min = numeric(item.hours_min);
      const hours_max = numeric(item.hours_max);
      const expected_hours = hours_max > 0 ? hours_max : hours_min;
      const most_likely_hours = hours_min > 0 && hours_max > 0
        ? (hours_min + hours_max) / 2
        : expected_hours;

      return {
        id: `deliverable-${index}`,
        name: item.phase,
        description: `${item.phase} phase`,
        estimate: {
          optimistic_hours: hours_min,
          most_likely_hours: most_likely_hours,
          pessimistic_hours: hours_max,
          expected_hours: expected_hours,
          cost: 0, // Cost is not used in the current implementation
        },
      };
    });
}

/**
 * Build QuoteContent from backend payload. If content is a string (markdown),
 * use it as executive_summary and derive totals from root-level hours/cost.
 * Extract deliverables from metadata.breakdown if available.
 */
function buildContent(api: ApiQuote): QuoteContent {
  const hours = numeric(api.total_hours);
  const cost = numeric(api.total_cost);

  // Extract deliverables from metadata.breakdown
  const deliverables = api.metadata?.breakdown
    ? convertBreakdownToDeliverables(api.metadata.breakdown)
    : [];

  // Extract assumptions from metadata
  const assumptions = Array.isArray(api.metadata?.assumptions)
    ? (api.metadata.assumptions as string[])
    : [];

  // Extract exclusions from metadata
  const exclusions = Array.isArray(api.metadata?.exclusions)
    ? (api.metadata.exclusions as string[])
    : [];

  if (typeof api.content !== 'string' || !api.content.trim()) {
    return {
      ...emptyQuoteContent,
      deliverables,
      assumptions,
      scope: {
        included: [],
        excluded: exclusions,
      },
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

  // Content: BlockNote JSON (array), legacy key-value (object with string values), or plain text
  let executive_summary = api.content;
  try {
    const parsed = JSON.parse(api.content) as unknown;
    if (Array.isArray(parsed)) {
      // BlockNote document – use as-is
      executive_summary = api.content;
    } else if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Object.values(parsed).every((v) => typeof v === 'string')
    ) {
      // Legacy key-value: convert to BlockNote JSON so editor and preview use same format
      const blocks = estimationOutcomesToBlockNoteBlocks(parsed as Record<string, string>);
      executive_summary = blocks.length > 0 ? JSON.stringify(blocks) : api.content;
    }
  } catch {
    // Not JSON, use api.content as executive_summary
  }

  return {
    ...emptyQuoteContent,
    executive_summary,
    deliverables,
    assumptions,
    scope: {
      included: [],
      excluded: exclusions,
    },
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
    prepared_by:
      api.prepared_by ??
      (api.metadata as { prepared_by?: string } | undefined)?.prepared_by ??
      undefined,
    metadata: api.metadata ?? undefined,
    generation_metadata: api.metadata
      ? {
          model_used: (api.metadata.model_used as string) ?? '',
          knowledge_docs_used: (api.metadata.knowledge_docs_used as string[]) ?? [],
          confidence_score: numeric(Number(api.metadata.confidence_score)),
          generation_time_seconds: numeric(Number(api.metadata.generation_time_ms)) / 1000,
          calibration_band: api.metadata.calibration_band as
            | { min_hours: number; max_hours: number; median_hours: number }
            | undefined,
          validation_warnings: (api.metadata.validation_warnings as string[] | undefined) ?? undefined,
          requirements_coverage_warnings: (api.metadata.requirements_coverage_warnings as
            | string[]
            | undefined) ?? undefined,
        }
      : undefined,
  };
}

/** 
 * Detect if content is markdown-only (full AI response as markdown string).
 * This is true when:
 * - executive_summary contains the full AI response with section headers
 * - The content has markdown patterns like "### 1." or "1. Project Overview"
 * 
 * We ignore scope.excluded because the backend extracts those from the markdown,
 * but the markdown content already includes them - we don't want duplicate rendering.
 */
export function isMarkdownOnlyContent(content: QuoteContent): boolean {
  const summary = content.executive_summary?.trim() || '';
  
  // If no summary, it's not markdown-only
  if (!summary) return false;
  
  // Check if the summary looks like full markdown content
  // (contains section headers or multiple sections)
  const hasMarkdownSections = 
    // Markdown headers: ### 1. Title, ## 2. Title
    /^#{1,4}\s*\d+\.\s/m.test(summary) ||
    // Plain numbered sections: 1. Project Overview, 2. Website Structure
    /^\d+\.\s+[A-Z][a-zA-Z\s&]+/m.test(summary) ||
    // Contains "Prepared for:" or "Platform:" metadata
    /^(Prepared for|Prepared by|Platform|Languages):/im.test(summary) ||
    // Contains multiple "---" separators (document structure)
    (summary.match(/^-{3,}$/gm) || []).length >= 2;
  
  // If it has markdown sections, treat as markdown-only
  // (ignore deliverables/scope that may have been extracted from the same content)
  if (hasMarkdownSections) {
    return true;
  }
  
  // Fallback: original logic for truly simple content
  return (
    (!content.deliverables || content.deliverables.length === 0) &&
    (!content.scope?.included?.length && !content.scope?.excluded?.length)
  );
}
