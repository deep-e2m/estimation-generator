/**
 * Quote Service
 * Handles quote generation, retrieval, updates, and exports
 */

import { apiClient, getErrorMessage } from './api';
import type {
  Quote,
  QuoteListItem,
  GenerateQuoteRequest,
  GenerateQuoteResponse,
  GenerationProgress,
  UpdateQuoteRequest,
  ExportOptions,
  ExportJob,
  Platform,
} from '../types/quote.types';

// Streaming progress callback types
export type StreamProgressCallback = (progress: GenerationProgress) => void;
export type StreamCompleteCallback = (quote: Quote) => void;
export type StreamErrorCallback = (error: string) => void;

class QuoteService {
  private abortController: AbortController | null = null;

  /**
   * Generate a new quote with streaming progress updates
   * @param projectId - Project ID
   * @param request - Generation request with requirements
   * @param onProgress - Callback for progress updates
   * @param onComplete - Callback when generation completes
   * @param onError - Callback for errors
   * @returns Function to cancel the generation
   */
  generateQuoteWithProgress(
    projectId: string,
    request: GenerateQuoteRequest,
    onProgress: StreamProgressCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback
  ): () => void {
    // Create abort controller for cancellation
    this.abortController = new AbortController();

    const generate = async () => {
      try {
        // Set initial progress
        onProgress({
          quote_id: '',
          status: 'generating',
          progress: {
            current_step: 'generating_estimate',
            steps_completed: 1,
            total_steps: 3,
            percentage: 33,
            message: 'Generating quote with AI...',
          },
          started_at: new Date().toISOString(),
        });

        // The backend does synchronous generation and returns the full quote
        const response = await apiClient.post<{
          success: boolean;
          data: {
            quote: Quote;
            generation_metadata: {
              model_used: string;
              tokens_used: number;
              generation_cost: number;
              rag_context_used: boolean;
              generation_time_ms: number;
            };
          };
        }>(
          `/api/v1/projects/${projectId}/quotes`,
          request,
          { signal: this.abortController?.signal }
        );

        // Update progress to complete
        onProgress({
          quote_id: response.data.data.quote.id,
          status: 'completed',
          progress: {
            current_step: 'formatting_output',
            steps_completed: 3,
            total_steps: 3,
            percentage: 100,
            message: 'Quote generated successfully!',
          },
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        // Return the quote directly
        onComplete(response.data.data.quote);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          onError('Generation cancelled');
        } else {
          onError(getErrorMessage(error));
        }
      }
    };

    generate();

    // Return cancel function
    return () => {
      this.abortController?.abort();
    };
  }

  /**
   * Poll for generation progress until complete or failed
   */
  private async pollGenerationProgress(
    projectId: string,
    quoteId: string,
    jobId: string,
    onProgress: StreamProgressCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback
  ): Promise<void> {
    const pollInterval = 1500; // 1.5 seconds
    const maxAttempts = 80; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (this.abortController?.signal.aborted) {
        return;
      }

      try {
        const response = await apiClient.get<{ success: boolean; data: GenerationProgress }>(
          `/api/v1/projects/${projectId}/quotes/${quoteId}/generation-status`,
          { signal: this.abortController?.signal }
        );

        const progress = response.data.data;
        onProgress(progress);

        if (progress.status === 'completed') {
          // Fetch the complete quote
          const quote = await this.getQuote(projectId, quoteId);
          onComplete(quote);
          return;
        }

        if (progress.status === 'failed') {
          onError(progress.error?.message || 'Quote generation failed');
          return;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        attempts++;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        onError(getErrorMessage(error));
        return;
      }
    }

    onError('Quote generation timed out. Please try again.');
  }

  /**
   * Generate quote (simple non-streaming version)
   */
  async generateQuote(
    projectId: string,
    request: GenerateQuoteRequest
  ): Promise<GenerateQuoteResponse> {
    const response = await apiClient.post<{ success: boolean; data: GenerateQuoteResponse }>(
      `/api/v1/projects/${projectId}/quotes`,
      request
    );
    return response.data.data;
  }

  /**
   * Get a single quote by ID
   */
  async getQuote(projectId: string, quoteId: string): Promise<Quote> {
    const response = await apiClient.get<{ success: boolean; data: Quote }>(
      `/api/v1/projects/${projectId}/quotes/${quoteId}`
    );
    return response.data.data;
  }

  /**
   * List quotes for a project
   */
  async listQuotes(
    projectId: string,
    options?: {
      status?: string;
      cursor?: string;
      limit?: number;
    }
  ): Promise<{ quotes: QuoteListItem[]; hasMore: boolean; cursor?: string }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.cursor) params.append('cursor', options.cursor);
    if (options?.limit) params.append('limit', options.limit.toString());

    const response = await apiClient.get<{
      success: boolean;
      data: QuoteListItem[];
      pagination: { cursor?: string; has_more: boolean };
    }>(`/api/v1/projects/${projectId}/quotes?${params.toString()}`);

    return {
      quotes: response.data.data,
      hasMore: response.data.pagination.has_more,
      cursor: response.data.pagination.cursor,
    };
  }

  /**
   * Update a quote
   */
  async updateQuote(
    projectId: string,
    quoteId: string,
    updates: UpdateQuoteRequest
  ): Promise<Quote> {
    const response = await apiClient.patch<{ success: boolean; data: Quote }>(
      `/api/v1/projects/${projectId}/quotes/${quoteId}`,
      updates
    );
    return response.data.data;
  }

  /**
   * Delete a quote
   */
  async deleteQuote(projectId: string, quoteId: string): Promise<void> {
    await apiClient.delete(`/api/v1/projects/${projectId}/quotes/${quoteId}`);
  }

  /**
   * Create a new version of a quote
   */
  async createQuoteVersion(
    projectId: string,
    quoteId: string,
    versionNote?: string
  ): Promise<Quote> {
    const response = await apiClient.post<{ success: boolean; data: Quote }>(
      `/api/v1/projects/${projectId}/quotes/${quoteId}/versions`,
      { version_note: versionNote }
    );
    return response.data.data;
  }

  /**
   * Export quote to PDF
   */
  async exportToPdf(
    projectId: string,
    quoteId: string,
    options?: Partial<ExportOptions>
  ): Promise<ExportJob> {
    const defaultOptions: ExportOptions = {
      template: 'professional',
      include_sections: {
        executive_summary: true,
        scope: true,
        deliverables: true,
        timeline: true,
        assumptions: true,
        risks: true,
        terms_and_conditions: true,
      },
    };

    const response = await apiClient.post<{ success: boolean; data: ExportJob }>(
      `/api/v1/projects/${projectId}/quotes/${quoteId}/export/pdf`,
      { ...defaultOptions, ...options }
    );

    return response.data.data;
  }

  /**
   * Export quote to DOCX
   */
  async exportToDocx(
    projectId: string,
    quoteId: string,
    options?: Partial<ExportOptions>
  ): Promise<ExportJob> {
    const defaultOptions: ExportOptions = {
      template: 'editable',
      include_sections: {
        executive_summary: true,
        scope: true,
        deliverables: true,
        timeline: true,
        assumptions: true,
        risks: true,
      },
    };

    const response = await apiClient.post<{ success: boolean; data: ExportJob }>(
      `/api/v1/projects/${projectId}/quotes/${quoteId}/export/docx`,
      { ...defaultOptions, ...options }
    );

    return response.data.data;
  }

  /**
   * Get export job status
   */
  async getExportStatus(exportJobId: string): Promise<ExportJob> {
    const response = await apiClient.get<{ success: boolean; data: ExportJob }>(
      `/api/v1/exports/${exportJobId}/status`
    );
    return response.data.data;
  }

  /**
   * Poll export status and return download URL when ready
   */
  async waitForExport(
    exportJobId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const pollInterval = 1000; // 1 second
    const maxAttempts = 60; // 1 minute max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getExportStatus(exportJobId);

      if (onProgress && status.progress_percentage !== undefined) {
        onProgress(status.progress_percentage);
      }

      if (status.status === 'completed' && status.download_url) {
        return status.download_url;
      }

      if (status.status === 'failed') {
        throw new Error(status.error?.message || 'Export failed');
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Export timed out');
  }

  /**
   * Download export file
   */
  async downloadExport(exportJobId: string): Promise<Blob> {
    const response = await apiClient.get(`/api/v1/exports/${exportJobId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Trigger file download in browser
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export quote directly to blob (for immediate download)
   * Handles both DOCX and PDF formats
   */
  async exportQuote(
    projectId: string,
    quoteId: string,
    format: 'docx' | 'pdf'
  ): Promise<Blob> {
    // Backend uses POST for export endpoints
    const response = await apiClient.post(
      `/api/v1/projects/${projectId}/quotes/${quoteId}/export/${format}`,
      {},
      {
        responseType: 'blob',
      }
    );
    return response.data;
  }

  /**
   * Get supported platforms
   */
  getSupportedPlatforms(): Array<{ value: Platform; label: string }> {
    return [
      { value: 'wordpress', label: 'WordPress' },
      { value: 'shopify', label: 'Shopify' },
      { value: 'woocommerce', label: 'WooCommerce' },
      { value: 'custom', label: 'Custom (React, Vue, Angular, Magento, etc.)' },
    ];
  }
}

export const quoteService = new QuoteService();
export default quoteService;
