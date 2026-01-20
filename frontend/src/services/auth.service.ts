/**
 * Authentication Service
 * Handles all auth-related API calls
 */

import { apiClient } from './api'
import type {
  User,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePasswordData,
} from '@/types/auth.types'

// API response wrapper type
interface ApiResponse<T> {
  success: boolean
  data: T
}

interface PasswordResetResponse {
  message: string
}

interface ChangePasswordResponse {
  message: string
}

interface ValidateTokenResponse {
  valid: boolean
  email?: string
}

class AuthService {
  /**
   * Request password reset email
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetResponse> {
    const response = await apiClient.post<ApiResponse<PasswordResetResponse>>(
      '/api/v1/auth/forgot-password',
      data
    )
    return response.data.data
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: PasswordResetConfirm): Promise<PasswordResetResponse> {
    const response = await apiClient.post<ApiResponse<PasswordResetResponse>>(
      '/api/v1/auth/reset-password',
      data
    )
    return response.data.data
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(data: ChangePasswordData): Promise<ChangePasswordResponse> {
    const response = await apiClient.post<ApiResponse<ChangePasswordResponse>>(
      '/api/v1/auth/change-password',
      data
    )
    return response.data.data
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<ValidateTokenResponse> {
    const response = await apiClient.get<ApiResponse<ValidateTokenResponse>>(
      `/api/v1/auth/validate-reset-token/${token}`
    )
    return response.data.data
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/api/v1/auth/me')
    return response.data.data
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<Pick<User, 'full_name' | 'company_name'>>): Promise<User> {
    const response = await apiClient.patch<ApiResponse<User>>('/api/v1/auth/me', data)
    return response.data.data
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(): Promise<void> {
    await apiClient.post('/api/v1/auth/logout-all')
  }
}

export const authService = new AuthService()
