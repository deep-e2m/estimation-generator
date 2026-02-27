/**
 * Audit logs service for admin global activity logs API.
 */

import { apiClient } from './api';

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  outcome: string;
  resource_type: string | null;
  resource_id: string | null;
  project_id: string | null;
  project_name: string | null;
  timestamp: string;
  ip_address: string | null;
  metadata: Record<string, any> | null;
}

export interface AuditLogsListParams {
  page?: number;
  per_page?: number;
  action?: string;
  user_id?: string;
  resource_type?: string;
  outcome?: string;
  start_date?: string;
  end_date?: string;
}

export interface AuditLogsListResponse {
  success: boolean;
  data: AuditLogEntry[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export const auditLogsService = {
  /**
   * List audit logs (admin only).
   */
  async listLogs(params: AuditLogsListParams = {}): Promise<AuditLogsListResponse> {
    const response = await apiClient.get<AuditLogsListResponse>('/admin/audit-logs', {
      params,
    });
    return response.data;
  },
};
