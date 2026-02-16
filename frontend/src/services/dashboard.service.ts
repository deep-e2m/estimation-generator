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
};
