/**
 * Approval workflow API service
 * Send projects for approval and approve/disapprove as Super PM
 */

import { apiClient } from './api'
import type { ApiResponse } from '@/services/api'
import type {
  ApprovalRequest,
  ApprovalRequestCreateBulk,
  ApprovalDecision,
  ApprovalStatus,
} from '@/types/rbac.types'

export const approvalsService = {
  /** Create one or more approval requests (bulk). Returns list of created requests. */
  createBulk: async (
    projectId: string,
    data: ApprovalRequestCreateBulk
  ): Promise<ApprovalRequest[]> => {
    const response = await apiClient.post<ApiResponse<ApprovalRequest[]>>(
      `/api/v1/projects/${projectId}/approval-requests`,
      data
    )
    const dataPayload = response.data.data
    return Array.isArray(dataPayload) ? dataPayload : [dataPayload]
  },

  /** List all approval requests for a project (for project detail / popover). */
  listByProject: async (projectId: string): Promise<ApprovalRequest[]> => {
    const response = await apiClient.get<ApiResponse<ApprovalRequest[]>>(
      `/api/v1/projects/${projectId}/approval-requests`
    )
    return response.data.data
  },

  list: async (status?: ApprovalStatus): Promise<ApprovalRequest[]> => {
    const params = status ? `?status=${status}` : ''
    const response = await apiClient.get<ApiResponse<ApprovalRequest[]>>(
      `/api/v1/approval-requests${params}`
    )
    return response.data.data
  },

  get: async (requestId: string): Promise<ApprovalRequest> => {
    const response = await apiClient.get<ApiResponse<ApprovalRequest>>(
      `/api/v1/approval-requests/${requestId}`
    )
    return response.data.data
  },

  decide: async (
    requestId: string,
    data: ApprovalDecision
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApiResponse<ApprovalRequest>>(
      `/api/v1/approval-requests/${requestId}/decide`,
      data
    )
    return response.data.data
  },
}
