/**
 * API Client configuration
 * Provides axios instance with interceptors for auth and error handling
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

// API response wrapper type
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// API error response type
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

// Determine API base URL
// In development: use empty string for relative URLs (goes through Vite proxy)
// In production: VITE_API_URL points to actual backend
const getApiBaseUrl = (): string => {
  // In development, always use relative URLs so requests go through Vite proxy
  // The proxy handles routing to the backend (configured in vite.config.ts)
  if (import.meta.env.DEV) {
    return '';
  }
  // In production, use VITE_API_URL or fallback to localhost
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'http://localhost:8000';
};

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds default timeout
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Generate request ID for tracing
    config.headers['X-Request-ID'] = crypto.randomUUID();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      // Clear tokens and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      // Only redirect if not already on auth pages
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limited. Retry after ${retryAfter} seconds.`);
    }

    return Promise.reject(error);
  }
);

// Helper function to extract error message
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError | undefined;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

// Helper function to check if error is a specific API error code
export function isApiErrorCode(error: unknown, code: string): boolean {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError | undefined;
    return apiError?.error?.code === code;
  }
  return false;
}

// Create multipart form data request config
export function createMultipartConfig(
  onUploadProgress?: (progress: number) => void
): AxiosRequestConfig {
  return {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onUploadProgress
      ? (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onUploadProgress(percentCompleted);
          }
        }
      : undefined,
  };
}

export default apiClient;
