/**
 * Approval workflow API service
 * Send projects for approval and approve/disapprove as Super PM
 */

import { apiClient } from './api'
import type { ApiResponse } from '@/services/api'
import type {
  ApprovalRequest,
  ApprovalRequestCreate,
  ApprovalDecision,
  ApprovalStatus,
} from '@/types/rbac.types'

export const approvalsService = {
  create: async (
    projectId: string,
    data: ApprovalRequestCreate
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApiResponse<ApprovalRequest>>(
      `/api/v1/projects/${projectId}/approval-requests`,
      data
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
