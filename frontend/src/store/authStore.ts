/**
 * Auth Store - Zustand state management for authentication
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  LoginResponse,
  RegisterResponse,
} from '@/types/auth.types'
import { apiClient, getErrorMessage } from '@/services/api'

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

// Generation counter — incremented on login/logout so stale checkAuth calls are discarded
let _checkAuthGeneration = 0

interface AuthState {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<boolean>
  clearError: () => void
  setUser: (user: User) => void
  checkAuth: () => Promise<void>
}

// Helper to store tokens
function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

// Helper to clear tokens
function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// Helper to get access token
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

// Helper to get refresh token
function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

// Check if token is expired (with 5 minute buffer)
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert to milliseconds
    return Date.now() >= exp - 5 * 60 * 1000 // 5 minute buffer
  } catch {
    return true
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (credentials: LoginCredentials) => {
        // Invalidate any in-flight checkAuth so it won't overwrite our fresh login
        ++_checkAuthGeneration
        set({ isLoading: true, error: null })

        try {
          const response = await apiClient.post<{ success: boolean; data: LoginResponse }>('/api/v1/auth/login', credentials)
          // Backend wraps response in { success, data } structure
          const { user, tokens } = response.data.data

          storeTokens(tokens)

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          const message = getErrorMessage(error)
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          })
          throw error
        }
      },

      // Register action
      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })

        try {
          const response = await apiClient.post<{ success: boolean; data: RegisterResponse }>('/api/v1/auth/register', data)
          // Backend wraps response in { success, data } structure
          const { user, tokens } = response.data.data

          storeTokens(tokens)

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error) {
          const message = getErrorMessage(error)
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          })
          throw error
        }
      },

      // Logout action
      logout: () => {
        clearTokens()
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      },

      // Refresh token action
      refreshToken: async () => {
        const refreshToken = getRefreshToken()

        if (!refreshToken) {
          get().logout()
          return false
        }

        try {
          const response = await apiClient.post<{ success: boolean; data: AuthTokens }>('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          })
          // Backend wraps response in { success, data } structure
          storeTokens(response.data.data)
          return true
        } catch {
          get().logout()
          return false
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null })
      },

      // Set user (for profile updates)
      setUser: (user: User) => {
        set({ user })
      },

      // Check authentication status on app load
      checkAuth: async () => {
        const token = getAccessToken()

        if (!token) {
          set({ isAuthenticated: false, user: null, isLoading: false })
          return
        }

        // Capture generation before any async work so we can detect stale calls
        const generation = ++_checkAuthGeneration

        // Check if token is expired
        if (isTokenExpired(token)) {
          const refreshed = await get().refreshToken()
          // If login() ran while we were refreshing, discard this result
          if (generation !== _checkAuthGeneration) return
          if (!refreshed) {
            return
          }
        }

        // Verify token with server and get user data
        try {
          set({ isLoading: true })
          const response = await apiClient.get<{ success: boolean; data: User }>('/api/v1/auth/me')
          // If login() ran while we were fetching /me, discard this stale result
          if (generation !== _checkAuthGeneration) return
          // Backend wraps response in { success, data } structure
          set({
            user: response.data.data,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          // If login() ran while this was failing, don't log the user out
          if (generation !== _checkAuthGeneration) return
          get().logout()
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist user data, not loading states
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Selector hooks for commonly used values
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)

// Role helpers (accept optional user for use outside React)
export function isAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === 'admin'
}
export function isPM(user: { role: string } | null | undefined): boolean {
  return user?.role === 'pm'
}
export function isSuperPM(user: { role: string } | null | undefined): boolean {
  return user?.role === 'super_pm'
}
export function isDev(user: { role: string } | null | undefined): boolean {
  return user?.role === 'dev'
}
export function canCreateProject(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return ['admin', 'pm', 'super_pm', 'dev'].includes(user.role)
}
/** Only super_pm can approve estimations; admin is tech-level and does not use approval workflow. */
export function canApproveEstimations(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'super_pm'
}
export function canShareProject(user: { role: string } | null | undefined): boolean {
  if (!user) return false
  return ['admin', 'pm', 'super_pm'].includes(user.role)
}
export function canManageUsers(user: { role: string } | null | undefined): boolean {
  return user?.role === 'admin'
}

// Role selector hooks (use current user from store)
export const useIsAdmin = () => useAuthStore((s) => isAdmin(s.user))
export const useIsPM = () => useAuthStore((s) => isPM(s.user))
export const useIsSuperPM = () => useAuthStore((s) => isSuperPM(s.user))
export const useIsDev = () => useAuthStore((s) => isDev(s.user))
export const useCanCreateProject = () => useAuthStore((s) => canCreateProject(s.user))
export const useCanApproveEstimations = () => useAuthStore((s) => canApproveEstimations(s.user))
export const useCanShareProject = () => useAuthStore((s) => canShareProject(s.user))
export const useCanManageUsers = () => useAuthStore((s) => canManageUsers(s.user))

/**
 * Ensure we have a valid (non-expired) access token.
 *
 * - Returns the existing token if it's still valid.
 * - Attempts a refresh when the token is close to expiry.
 * - Returns null if no valid token can be obtained.
 *
 * This is safe to call from non-React code (e.g. WebSocket services).
 */
export async function ensureValidAccessToken(): Promise<string | null> {
  const token = getAccessToken()

  if (!token) {
    return null
  }

  // If token is still valid (with buffer), just use it.
  if (!isTokenExpired(token)) {
    return token
  }

  // Try to refresh using the store's refreshToken action.
  const refreshed = await useAuthStore.getState().refreshToken()
  if (!refreshed) {
    return null
  }

  // Read the (potentially) new token from storage.
  return getAccessToken()
}
