/**
 * Users API service (Admin)
 * List users, update role/profile, activate/deactivate, delete (soft).
 */

import { apiClient } from './api'
import type { ApiResponse } from '@/services/api'
import type { User } from '@/types/auth.types'
import type { UserRole } from '@/types/auth.types'

export interface UserListParams {
  role?: UserRole
  search?: string
  is_active?: boolean
}

export interface UserUpdatePayload {
  email?: string
  password?: string
  full_name?: string
  company_name?: string | null
  role?: UserRole
  is_active?: boolean
}

export const usersService = {
  list: async (params?: UserListParams): Promise<User[]> => {
    const searchParams = new URLSearchParams()
    if (params?.role) searchParams.set('role', params.role)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
    const qs = searchParams.toString()
    const url = qs ? `/api/v1/users?${qs}` : '/api/v1/users'
    const response = await apiClient.get<ApiResponse<User[]>>(url)
    return response.data.data
  },

  updateRole: async (userId: string, role: UserRole): Promise<User> => {
    const response = await apiClient.put<ApiResponse<User>>(
      `/api/v1/users/${userId}/role`,
      { role }
    )
    return response.data.data
  },

  update: async (userId: string, payload: UserUpdatePayload): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(
      `/api/v1/users/${userId}`,
      payload
    )
    return response.data.data
  },

  delete: async (userId: string): Promise<User> => {
    const response = await apiClient.delete<ApiResponse<User>>(
      `/api/v1/users/${userId}`
    )
    return response.data.data
  },
}
