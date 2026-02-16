/**
 * Dashboard API Service
 * Fetches aggregate stats from the backend so dashboard cards reflect DB state
 * (e.g. total projects, total quotes, total hours estimated) and update correctly
 * when projects or quotes are deleted.
 */

import { apiClient } from './api';
import type { ApiResponse } from './api';

export interface DashboardStats {
  total_projects: number;
  total_quotes: number;
  total_hours_estimated: number;
  active_projects: number;
  pending_quotes: number;
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
};
