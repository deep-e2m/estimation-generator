/**
 * API Client configuration
 * Provides axios instance with interceptors for auth and error handling.
 * On 401, attempts token refresh once and retries the request so active users stay logged in.
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

export { LONG_REQUEST_TIMEOUT_MS } from '@/constants/api';

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds default; use LONG_REQUEST_TIMEOUT_MS for generation/refine/export
});

// Notify idle timeout logic that activity occurred (e.g. API request = user is active)
const ACTIVITY_EVENT = 'user-activity';
export function notifyActivity(): void {
  window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
}

// Request interceptor - add auth token and notify activity for idle timeout
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Generate request ID for tracing
    config.headers['X-Request-ID'] = crypto.randomUUID();

    notifyActivity();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - on 401 try refresh once and retry, then handle rate limiting
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const baseUrl = getApiBaseUrl();
          const refreshUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/auth/refresh`;
          const response = await axios.post<{ success: boolean; data: { access_token: string; refresh_token: string } }>(
            refreshUrl,
            { refresh_token: refreshToken },
            { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
          );
          const data = response.data?.data;
          if (data?.access_token) {
            localStorage.setItem('access_token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('refresh_token', data.refresh_token);
            }
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
            }
            return apiClient(originalRequest);
          }
        } catch {
          // Refresh failed; fall through to clear and redirect
        }
      }

      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login?reason=session_expired';
      }
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limited. Retry after ${retryAfter} seconds.`);
    }

    return Promise.reject(error);
  }
);

// Helper function to extract error message
// Backend uses FastAPI HTTPException which returns { detail: { code, message } };
// some handlers return { error: { message } }. Support both.
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    if (data && typeof data === 'object') {
      const detail = data.detail as { message?: string } | undefined;
      if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
        return detail.message;
      }
      const err = data.error as { message?: string } | undefined;
      if (err && typeof err === 'object' && typeof err.message === 'string') {
        return err.message;
      }
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
