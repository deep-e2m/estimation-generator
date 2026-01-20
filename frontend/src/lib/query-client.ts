import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query key factory for type-safe query keys
export const queryKeys = {
  // Quotes
  quotes: {
    all: ['quotes'] as const,
    lists: () => [...queryKeys.quotes.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.quotes.lists(), filters] as const,
    details: () => [...queryKeys.quotes.all, 'detail'] as const,
    detail: (projectId: string, quoteId: string) =>
      [...queryKeys.quotes.details(), projectId, quoteId] as const,
    versions: (projectId: string, quoteId: string) =>
      [...queryKeys.quotes.detail(projectId, quoteId), 'versions'] as const,
    feedback: (projectId: string, quoteId: string) =>
      [...queryKeys.quotes.detail(projectId, quoteId), 'feedback'] as const,
    exports: (projectId: string, quoteId: string) =>
      [...queryKeys.quotes.detail(projectId, quoteId), 'exports'] as const,
  },

  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (projectId: string) =>
      [...queryKeys.projects.details(), projectId] as const,
    quotes: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), 'quotes'] as const,
  },

  // Exports
  exports: {
    all: ['exports'] as const,
    status: (exportJobId: string) =>
      [...queryKeys.exports.all, 'status', exportJobId] as const,
  },

  // User
  user: {
    current: ['user', 'current'] as const,
  },
};
