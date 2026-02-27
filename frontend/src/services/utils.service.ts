/**
 * Utils API service.
 * Fetches placeholder avatar URL from backend (LLM-based) when user has no avatar.
 */

import { apiClient } from './api';
import type { ApiResponse } from './api';
import { getPlaceholderAvatarUrl } from '@/lib/placeholderAvatars';

export interface PlaceholderAvatarResponse {
  url: string;
}

export const utilsService = {
  /**
   * Fetch placeholder avatar URL from backend (LLM classifies by first name).
   * Use when user has no avatar_url. Falls back to client-side name list on API error.
   */
  getPlaceholderAvatarUrl: async (fullName: string): Promise<string> => {
    try {
      const response = await apiClient.get<ApiResponse<PlaceholderAvatarResponse>>(
        '/api/v1/utils/placeholder-avatar',
        { params: { full_name: fullName } }
      );
      if (response.data?.data?.url) return response.data.data.url;
    } catch {
      // Fallback to client-side name-based placeholder
    }
    return getPlaceholderAvatarUrl(fullName);
  },
};
