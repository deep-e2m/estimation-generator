import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { normalizeQuoteFromApi, type ApiQuote } from '@/lib/quote-normalizer';
import type {
  ApiResponse,
  PaginatedResponse,
  Quote,
  QuoteSummary,
  QuoteFilters,
  QuoteVersion,
  Feedback,
  FeedbackSubmission,
  ExportJob,
  ExportFormat,
  Project,
} from '@/types';

// API Base URL - defaults to /api/v1 which will be proxied by Vite
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

// Create axios instance with defaults
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor for auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data.data;
          localStorage.setItem('access_token', access_token);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }

          return apiClient(originalRequest);
        }
      } catch {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Quote API functions
export const quotesApi = {
  // Get all quotes with filters and pagination
  list: async (
    filters: QuoteFilters = {},
    cursor?: string,
    limit: number = 20
  ): Promise<PaginatedResponse<QuoteSummary>> => {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.platform) params.append('platform', filters.platform);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());

    const response = await apiClient.get<ApiResponse<PaginatedResponse<QuoteSummary>>>(
      `/quotes?${params.toString()}`
    );
    return response.data.data as unknown as PaginatedResponse<QuoteSummary>;
  },

  // Get quotes for a specific project (page-based; backend returns { quotes, pagination })
  listByProject: async (
    projectId: string,
    pageParam?: number,
    limit: number = 20
  ): Promise<PaginatedResponse<QuoteSummary>> => {
    const page = pageParam ?? 1;
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', limit.toString());

    const response = await apiClient.get<
      ApiResponse<{ quotes: QuoteSummary[]; pagination: { page: number; page_size: number; total_items: number; total_pages: number; has_next: boolean; has_previous: boolean } }>
    >(`/projects/${projectId}/quotes?${params.toString()}`);

    const d = response.data.data;
    return {
      data: d.quotes,
      pagination: {
        has_more: d.pagination.has_next,
        cursor: null,
        total_count: d.pagination.total_items,
        page: d.pagination.page,
      },
    };
  },

  // Get single quote by ID (backend: GET /quotes/{quote_id}; content is string, normalized to Quote)
  get: async (_projectId: string, quoteId: string): Promise<Quote> => {
    const response = await apiClient.get<ApiResponse<ApiQuote>>(
      `/quotes/${quoteId}`
    );
    return normalizeQuoteFromApi(response.data.data);
  },

  // Update quote (backend: PUT /quotes/{quote_id})
  update: async (
    _projectId: string,
    quoteId: string,
    data: Partial<Quote>
  ): Promise<Quote> => {
    const response = await apiClient.put<ApiResponse<ApiQuote>>(
      `/quotes/${quoteId}`,
      data
    );
    return normalizeQuoteFromApi(response.data.data);
  },

  // Delete quote (backend: DELETE /quotes/{quote_id})
  delete: async (_projectId: string, quoteId: string): Promise<void> => {
    await apiClient.delete(`/quotes/${quoteId}`);
  },

  // Get quote versions (quote-scoped; projectId kept for cache keys/callers)
  getVersions: async (
    _projectId: string,
    quoteId: string
  ): Promise<QuoteVersion[]> => {
    const response = await apiClient.get<ApiResponse<QuoteVersion[]>>(
      `/quotes/${quoteId}/versions`
    );
    return response.data.data;
  },

  // Create new version (quote-scoped)
  createVersion: async (
    _projectId: string,
    quoteId: string,
    versionNote?: string
  ): Promise<QuoteVersion> => {
    const response = await apiClient.post<ApiResponse<QuoteVersion>>(
      `/quotes/${quoteId}/versions`,
      { version_note: versionNote }
    );
    return response.data.data;
  },
};

// Feedback API functions
export const feedbackApi = {
  // Submit feedback
  submit: async (
    projectId: string,
    quoteId: string,
    feedback: FeedbackSubmission
  ): Promise<Feedback> => {
    const response = await apiClient.post<ApiResponse<Feedback>>(
      `/projects/${projectId}/quotes/${quoteId}/feedback`,
      feedback
    );
    return response.data.data;
  },

  // Update feedback
  update: async (
    projectId: string,
    quoteId: string,
    feedbackId: string,
    feedback: Partial<FeedbackSubmission>
  ): Promise<Feedback> => {
    const response = await apiClient.patch<ApiResponse<Feedback>>(
      `/projects/${projectId}/quotes/${quoteId}/feedback/${feedbackId}`,
      feedback
    );
    return response.data.data;
  },

  // Get feedback for a quote
  get: async (projectId: string, quoteId: string): Promise<Feedback[]> => {
    const response = await apiClient.get<ApiResponse<Feedback[]>>(
      `/projects/${projectId}/quotes/${quoteId}/feedback`
    );
    return response.data.data;
  },
};

// Export API functions
export const exportApi = {
  // Export to PDF
  exportPdf: async (
    projectId: string,
    quoteId: string,
    options?: {
      template?: string;
      include_sections?: Record<string, boolean>;
    }
  ): Promise<ExportJob> => {
    const response = await apiClient.post<ApiResponse<ExportJob>>(
      `/projects/${projectId}/quotes/${quoteId}/export/pdf`,
      options || {}
    );
    return response.data.data;
  },

  // Export to DOCX
  exportDocx: async (
    projectId: string,
    quoteId: string,
    options?: {
      template?: string;
      include_sections?: Record<string, boolean>;
    }
  ): Promise<ExportJob> => {
    const response = await apiClient.post<ApiResponse<ExportJob>>(
      `/projects/${projectId}/quotes/${quoteId}/export/docx`,
      options || {}
    );
    return response.data.data;
  },

  // Generic export function
  export: async (
    projectId: string,
    quoteId: string,
    format: ExportFormat
  ): Promise<ExportJob> => {
    if (format === 'pdf') {
      return exportApi.exportPdf(projectId, quoteId);
    }
    return exportApi.exportDocx(projectId, quoteId);
  },

  // Get export status
  getStatus: async (exportJobId: string): Promise<ExportJob> => {
    const response = await apiClient.get<ApiResponse<ExportJob>>(
      `/exports/${exportJobId}/status`
    );
    return response.data.data;
  },

  // Get download URL
  getDownloadUrl: async (exportJobId: string): Promise<string> => {
    const response = await apiClient.get<ApiResponse<{ download_url: string }>>(
      `/exports/${exportJobId}/download`
    );
    return response.data.data.download_url;
  },

  // List export history for a quote
  listHistory: async (
    projectId: string,
    quoteId: string
  ): Promise<ExportJob[]> => {
    const response = await apiClient.get<ApiResponse<ExportJob[]>>(
      `/projects/${projectId}/quotes/${quoteId}/exports`
    );
    return response.data.data;
  },
};

// Project API functions
export const projectsApi = {
  // Get all projects
  list: async (cursor?: string, limit: number = 20): Promise<PaginatedResponse<Project>> => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());

    const response = await apiClient.get<ApiResponse<PaginatedResponse<Project>>>(
      `/projects?${params.toString()}`
    );
    return response.data.data as unknown as PaginatedResponse<Project>;
  },

  // Get single project
  get: async (projectId: string): Promise<Project> => {
    const response = await apiClient.get<ApiResponse<Project>>(
      `/projects/${projectId}`
    );
    return response.data.data;
  },
};

export { apiClient };
