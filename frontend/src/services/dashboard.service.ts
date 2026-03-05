/**
 * Dashboard API Service
 * Fetches aggregate stats and AI analytics from the backend.
 * No hardcoded AI metrics; accuracy/margin/efficiency are optional (null until real data).
 */

import { apiClient } from './api';
import type { ApiResponse } from './api';

export interface DashboardStats {
  total_projects: number;
  total_quotes: number;
  total_hours_estimated: number;
  active_projects: number;
  pending_quotes: number;
  /** AI Performance card: accuracy 0-100; null when not available */
  ai_accuracy_percent: number | null;
  margin_of_error_percent: number | null;
  ai_efficiency_percent: number | null;
  /** 'benchmark' = placeholder values; 'measured' = from real data (future: when feedback/accuracy pipeline exists) */
  ai_metrics_source: 'benchmark' | 'measured' | null;
}

export interface ModelUsageItem {
  model_id: string;
  description: string;
  quote_count: number;
  total_tokens: number;
  total_cost: number;
  accuracy_percent: number | null;
}

export interface DashboardAnalytics {
  total_quotes_analyzed: number;
  total_tokens_all_time: number;
  models: ModelUsageItem[];
}

/** Projects created per day (admin analytics) */
export interface ProjectsOverTimeItem {
  date: string;
  count: number;
}

/** Quotes created per day with hours (admin analytics) */
export interface QuotesOverTimeItem {
  date: string;
  count: number;
  total_hours: number;
}

/** Status distribution for pie charts */
export interface StatusCount {
  status: string;
  count: number;
}

export interface ByStatusData {
  projects: StatusCount[];
  quotes: StatusCount[];
}

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export const dashboardService = {
  /**
   * Get dashboard aggregate stats (counts and total hours from DB).
   */
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<ApiResponse<DashboardStats>>(
      '/api/v1/dashboard/stats'
    );
    return response.data.data;
  },

  /**
   * Get AI analytics for Full Analytics popup (models, tokens, descriptions).
   */
  getAnalytics: async (): Promise<DashboardAnalytics> => {
    const response = await apiClient.get<ApiResponse<DashboardAnalytics>>(
      '/api/v1/dashboard/analytics'
    );
    return response.data.data;
  },

  /**
   * Get projects created over time (admin only).
   */
  getProjectsOverTime: async (period: AnalyticsPeriod = '30d'): Promise<ProjectsOverTimeItem[]> => {
    const response = await apiClient.get<ApiResponse<ProjectsOverTimeItem[]>>(
      `/api/v1/dashboard/analytics/projects-over-time?period=${period}`
    );
    return response.data.data;
  },

  /**
   * Get quotes created over time with hours (admin only).
   */
  getQuotesOverTime: async (period: AnalyticsPeriod = '30d'): Promise<QuotesOverTimeItem[]> => {
    const response = await apiClient.get<ApiResponse<QuotesOverTimeItem[]>>(
      `/api/v1/dashboard/analytics/quotes-over-time?period=${period}`
    );
    return response.data.data;
  },

  /**
   * Get project and quote status distribution (admin only).
   */
  getByStatus: async (): Promise<ByStatusData> => {
    const response = await apiClient.get<ApiResponse<ByStatusData>>(
      '/api/v1/dashboard/analytics/by-status'
    );
    return response.data.data;
  },

  /** Activity analytics (Phase 2) */
  getActivitySummary: async (period: AnalyticsPeriod = '30d') => {
    const response = await apiClient.get<
      ApiResponse<{
        action_breakdown: { action: string; count: number }[];
        outcome_breakdown: { outcome: string; count: number }[];
        resource_type_breakdown: { resource_type: string; count: number }[];
        timeline: { date: string; count: number }[];
      }>
    >(`/api/v1/dashboard/analytics/activity-summary?period=${period}`);
    return response.data.data;
  },

  /** User analytics (Phase 2) */
  getUserStats: async (limit = 10) => {
    const response = await apiClient.get<
      ApiResponse<{
        role_distribution: { role: string; count: number }[];
        most_active_users: {
          user_id: string;
          full_name: string;
          email: string;
          activity_count: number;
        }[];
      }>
    >(`/api/v1/dashboard/analytics/user-stats?limit=${limit}`);
    return response.data.data;
  },

  /** AI usage over time - tokens and cost per day (Phase 3, admin only) */
  getAIUsageOverTime: async (period: AnalyticsPeriod = '30d') => {
    const response = await apiClient.get<
      ApiResponse<{ date: string; tokens: number; cost: number }[]>
    >(`/api/v1/dashboard/analytics/ai-usage-over-time?period=${period}`);
    return response.data.data;
  },
};
