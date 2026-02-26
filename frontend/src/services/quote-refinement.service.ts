/**
 * Quote Refinement Service
 * Handles conversational refinement of quotes through natural language
 */

import { normalizeQuoteFromApi, type ApiQuote } from '@/lib/quote-normalizer';
import { apiClient, LONG_REQUEST_TIMEOUT_MS } from './api';
import type { ApiResponse } from '../types';
import type {
  RefineQuoteRequest,
  RefineQuoteResponse,
  RefinedProjectUpdate,
} from '../types/quote.types';

/** Backend refine response (updated_quote has content as string) */
interface RefineQuoteApiResponse {
  updated_quote: ApiQuote;
  ai_message: string;
  changes_applied: RefineQuoteResponse['changes_applied'];
  updated_project?: RefinedProjectUpdate | null;
}

/**
 * Quote refinement service for conversational quote updates
 */
export class QuoteRefinementService {
  /**
   * Refine a quote using natural language.
   * Pass currentContent (e.g. from the BlockNote editor) so refinement uses the latest
   * state and unsaved edits are not overwritten.
   */
  async refineQuote(
    projectId: string,
    quoteId: string,
    message: string,
    currentContent?: string | null
  ): Promise<RefineQuoteResponse> {
    const body: RefineQuoteRequest = { message };
    if (currentContent != null && currentContent.trim() !== '') {
      body.current_content = currentContent.trim();
    }
    const response = await apiClient.post<ApiResponse<RefineQuoteApiResponse>>(
      `/api/v1/projects/${projectId}/quotes/${quoteId}/refine`,
      body,
      { timeout: LONG_REQUEST_TIMEOUT_MS }
    );

    const data = response.data.data;
    const updated_quote = normalizeQuoteFromApi(data.updated_quote, { projectName: '' });
    return {
      updated_quote,
      ai_message: data.ai_message,
      changes_applied: data.changes_applied,
      updated_project: data.updated_project ?? undefined,
    };
  }
}

// Export singleton instance
export const quoteRefinementService = new QuoteRefinementService();
