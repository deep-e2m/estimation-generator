/**
 * Quotes API Service
 * Handles all quote-related API calls for the Estimate AI system
 */

import { apiClient } from './api';
import { normalizeQuoteFromApi, type ApiQuote } from '@/lib/quote-normalizer';
import type {
  ApiResponse,
  Quote,
  QuoteSummary,
  QuoteFilters,
  QuoteVersion,
  PaginatedResponse,
  QuoteStatus,
} from '@/types';

// Quote generation request
export interface QuoteGenerateRequest {
  requirements_text?: string;
  attachment_ids?: string[];
  platform?: string;
  generation_options?: {
    detail_level?: 'brief' | 'detailed' | 'comprehensive';
    include_assumptions?: boolean;
    include_risks?: boolean;
    estimation_approach?: 'single_point' | 'three_point';
    currency?: string;
    hourly_rate?: number;
  };
}

// Quote update request
export interface QuoteUpdateRequest {
  content?: Partial<Quote['content']>;
  status?: QuoteStatus;
  client_name?: string;
  platform?: string;
}

// Build query params for quote filters
function buildQuoteQueryParams(
  filters?: QuoteFilters,
  cursor?: string,
  limit: number = 20
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.platform) params.append('platform', filters.platform);
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);
  if (filters?.sort_by) params.append('sort_by', filters.sort_by);
  if (filters?.sort_order) params.append('sort_order', filters.sort_order);
  if (cursor) params.append('cursor', cursor);
  params.append('limit', limit.toString());

  return params;
}

export const quotesService = {
  /**
   * Generate a new quote for a project
   */
  generate: async (projectId: string, data: QuoteGenerateRequest): Promise<Quote> => {
    const response = await apiClient.post<ApiResponse<ApiQuote>>(
      `/api/v1/projects/${projectId}/quotes`,
      data
    );
    // Normalize API response to frontend Quote format
    return normalizeQuoteFromApi(response.data.data);
  },

  /**
   * List quotes for a specific project
   */
  listByProject: async (
    projectId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<QuoteSummary>> => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());

    interface BackendQuote {
      id: string;
      quote_number: string;
      project_id: string;
      title: string;
      total_hours: number;
      total_cost?: number;
      platform: string;
      complexity: string;
      status: string;
      created_at: string;
      updated_at: string;
    }

    const response = await apiClient.get<ApiResponse<{
      quotes: BackendQuote[];
      pagination: {
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
      };
    }>>(
      `/api/v1/projects/${projectId}/quotes?${params.toString()}`
    );

    // Map backend response to frontend format
    const backendData = response.data.data;
    const mappedQuotes: QuoteSummary[] = (backendData.quotes || []).map((q) => ({
      id: q.id,
      quote_number: q.quote_number || `QT-${q.id.slice(0, 8).toUpperCase()}`,
      version: 1,
      status: (q.status as QuoteSummary['status']) || 'draft',
      platform: q.platform as QuoteSummary['platform'],
      totals: {
        total_expected_hours: Number(q.total_hours) || 0,
        total_cost: Number(q.total_cost) || 0,
        currency: 'USD',
      },
      created_by: { id: '', full_name: '' },
      created_at: q.created_at,
      updated_at: q.updated_at,
    }));

    return {
      data: mappedQuotes,
      pagination: {
        cursor: null,
        has_more: backendData.pagination?.has_next || false,
        total_count: backendData.pagination?.total_items || 0,
      },
    };
  },

  /**
   * List all quotes with filters
   */
  list: async (
    filters?: QuoteFilters,
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<QuoteSummary>> => {
    const params = buildQuoteQueryParams(filters, cursor, limit);

    interface BackendQuote {
      id: string;
      quote_number: string;
      project_id: string;
      title: string;
      total_hours: number;
      total_cost?: number;
      platform: string;
      complexity: string;
      status: string;
      created_at: string;
      updated_at: string;
    }

    const response = await apiClient.get<ApiResponse<{
      quotes: BackendQuote[];
      pagination: {
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
      };
    }>>(
      `/api/v1/quotes?${params.toString()}`
    );

    // Map backend response to frontend format
    const backendData = response.data.data;
    const mappedQuotes: QuoteSummary[] = (backendData.quotes || []).map((q) => ({
      id: q.id,
      quote_number: q.quote_number || `QT-${q.id.slice(0, 8).toUpperCase()}`,
      version: 1,
      status: (q.status as QuoteSummary['status']) || 'draft',
      platform: q.platform as QuoteSummary['platform'],
      totals: {
        total_expected_hours: Number(q.total_hours) || 0,
        total_cost: Number(q.total_cost) || 0,
        currency: 'USD',
      },
      created_by: { id: '', full_name: '' },
      created_at: q.created_at,
      updated_at: q.updated_at,
    }));

    return {
      data: mappedQuotes,
      pagination: {
        cursor: null,
        has_more: backendData.pagination?.has_next || false,
        total_count: backendData.pagination?.total_items || 0,
      },
    };
  },

  /**
   * Get a single quote by ID
   */
  get: async (quoteId: string): Promise<Quote> => {
    const response = await apiClient.get<ApiResponse<ApiQuote>>(
      `/api/v1/quotes/${quoteId}`
    );
    // Normalize API response (content as string) to frontend Quote format
    return normalizeQuoteFromApi(response.data.data);
  },

  /**
   * Update a quote
   */
  update: async (quoteId: string, data: QuoteUpdateRequest): Promise<Quote> => {
    const response = await apiClient.put<ApiResponse<ApiQuote>>(
      `/api/v1/quotes/${quoteId}`,
      data
    );
    // Normalize API response to frontend Quote format
    return normalizeQuoteFromApi(response.data.data);
  },

  /**
   * Delete a quote
   */
  delete: async (quoteId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/quotes/${quoteId}`);
  },

  /**
   * Get quote version history
   */
  getVersions: async (quoteId: string): Promise<QuoteVersion[]> => {
    const response = await apiClient.get<ApiResponse<QuoteVersion[]>>(
      `/api/v1/quotes/${quoteId}/versions`
    );
    return response.data.data;
  },

  /**
   * Create a new version of a quote
   */
  createVersion: async (quoteId: string, versionNote?: string): Promise<QuoteVersion> => {
    const response = await apiClient.post<ApiResponse<QuoteVersion>>(
      `/api/v1/quotes/${quoteId}/versions`,
      { version_note: versionNote }
    );
    return response.data.data;
  },

  /**
   * Update quote status
   */
  updateStatus: async (quoteId: string, status: QuoteStatus): Promise<Quote> => {
    return quotesService.update(quoteId, { status });
  },

  /**
   * Finalize a quote (mark as ready for client)
   */
  finalize: async (quoteId: string): Promise<Quote> => {
    return quotesService.updateStatus(quoteId, 'finalized');
  },

  /**
   * Archive a quote
   */
  archive: async (quoteId: string): Promise<Quote> => {
    return quotesService.updateStatus(quoteId, 'archived');
  },
};

export default quotesService;
