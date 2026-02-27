/**
 * Project shares API service
 * Share projects with users and manage access levels
 */

import { apiClient } from './api'
import type { ApiResponse } from '@/services/api'
import type {
  ProjectShare,
  ProjectShareCreate,
  ProjectShareUpdate,
} from '@/types/rbac.types'

export const projectSharesService = {
  list: async (projectId: string): Promise<ProjectShare[]> => {
    const response = await apiClient.get<ApiResponse<ProjectShare[]>>(
      `/api/v1/projects/${projectId}/shares`
    )
    return response.data.data
  },

  create: async (
    projectId: string,
    data: ProjectShareCreate
  ): Promise<ProjectShare> => {
    const response = await apiClient.post<ApiResponse<ProjectShare>>(
      `/api/v1/projects/${projectId}/shares`,
      data
    )
    return response.data.data
  },

  update: async (
    projectId: string,
    shareId: string,
    data: ProjectShareUpdate
  ): Promise<ProjectShare> => {
    const response = await apiClient.put<ApiResponse<ProjectShare>>(
      `/api/v1/projects/${projectId}/shares/${shareId}`,
      data
    )
    return response.data.data
  },

  remove: async (projectId: string, shareId: string): Promise<void> => {
    await apiClient.delete(
      `/api/v1/projects/${projectId}/shares/${shareId}`
    )
  },
}
