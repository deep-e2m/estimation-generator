import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { quotesApi, feedbackApi, exportApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import type { QuoteFilters, FeedbackSubmission, ExportFormat } from '@/types';
import { toast } from 'sonner';

/**
 * Hook for fetching paginated quotes list with infinite scroll
 */
export function useQuotesList(filters: QuoteFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.quotes.list(filters as unknown as Record<string, unknown>),
    queryFn: async ({ pageParam }) => {
      return quotesApi.list(filters, pageParam as string | undefined, 20);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more ? lastPage.pagination.cursor : undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook for fetching quotes for a specific project (page-based pagination)
 */
export function useProjectQuotes(projectId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.projects.quotes(projectId),
    queryFn: async ({ pageParam }) => {
      return quotesApi.listByProject(projectId, pageParam as number, 20);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more
        ? (lastPage.pagination.page ?? 0) + 1
        : undefined,
    enabled: !!projectId,
  });
}

/**
 * Hook for fetching a single quote
 */
export function useQuote(projectId: string, quoteId: string) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(projectId, quoteId),
    queryFn: () => quotesApi.get(projectId, quoteId),
    enabled: !!projectId && !!quoteId,
  });
}

/**
 * Hook for fetching quote versions
 */
export function useQuoteVersions(projectId: string, quoteId: string) {
  return useQuery({
    queryKey: queryKeys.quotes.versions(projectId, quoteId),
    queryFn: () => quotesApi.getVersions(projectId, quoteId),
    enabled: !!projectId && !!quoteId,
  });
}

/**
 * Hook for updating a quote
 */
export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      quoteId,
      data,
    }: {
      projectId: string;
      quoteId: string;
      data: Parameters<typeof quotesApi.update>[2];
    }) => quotesApi.update(projectId, quoteId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.quotes.detail(variables.projectId, variables.quoteId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.quotes.lists(),
      });
      toast.success('Quote updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update quote', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });
}

/**
 * Hook for deleting a quote
 */
export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, quoteId }: { projectId: string; quoteId: string }) =>
      quotesApi.delete(projectId, quoteId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.quotes.lists(),
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.removeQueries({
        queryKey: queryKeys.quotes.detail(variables.projectId, variables.quoteId),
      });
      toast.success('Quote deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete quote', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });
}

/**
 * Hook for creating a new quote version
 */
export function useCreateQuoteVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      quoteId,
      versionNote,
    }: {
      projectId: string;
      quoteId: string;
      versionNote?: string;
    }) => quotesApi.createVersion(projectId, quoteId, versionNote),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.quotes.versions(variables.projectId, variables.quoteId),
      });
      toast.success('New version created');
    },
    onError: (error) => {
      toast.error('Failed to create version', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });
}

/**
 * Hook for submitting feedback
 */
export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      quoteId,
      feedback,
    }: {
      projectId: string;
      quoteId: string;
      feedback: FeedbackSubmission;
    }) => feedbackApi.submit(projectId, quoteId, feedback),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.quotes.feedback(variables.projectId, variables.quoteId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.quotes.detail(variables.projectId, variables.quoteId),
      });
      toast.success('Thank you for your feedback!');
    },
    onError: (error) => {
      toast.error('Failed to submit feedback', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });
}

/**
 * Hook for fetching quote feedback
 */
export function useQuoteFeedback(projectId: string, quoteId: string) {
  return useQuery({
    queryKey: queryKeys.quotes.feedback(projectId, quoteId),
    queryFn: () => feedbackApi.get(projectId, quoteId),
    enabled: !!projectId && !!quoteId,
  });
}

/**
 * Hook for exporting a quote
 */
export function useExportQuote() {
  return useMutation({
    mutationFn: ({
      projectId,
      quoteId,
      format,
    }: {
      projectId: string;
      quoteId: string;
      format: ExportFormat;
    }) => exportApi.export(projectId, quoteId, format),
    onSuccess: (data) => {
      toast.success(`Export started`, {
        description: `Your ${data.format.toUpperCase()} will be ready shortly`,
      });
    },
    onError: (error) => {
      toast.error('Failed to start export', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },
  });
}

/**
 * Hook for checking export status
 */
export function useExportStatus(exportJobId: string | null) {
  return useQuery({
    queryKey: queryKeys.exports.status(exportJobId || ''),
    queryFn: () => exportApi.getStatus(exportJobId!),
    enabled: !!exportJobId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while processing
      const status = query.state.data?.status;
      if (status === 'processing') return 2000;
      return false;
    },
  });
}

/**
 * Hook for fetching export history
 */
export function useExportHistory(projectId: string, quoteId: string) {
  return useQuery({
    queryKey: queryKeys.quotes.exports(projectId, quoteId),
    queryFn: () => exportApi.listHistory(projectId, quoteId),
    enabled: !!projectId && !!quoteId,
  });
}
