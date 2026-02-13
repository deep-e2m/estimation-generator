/**
 * Protected Route Component
 *
 * Handles route protection based on authentication status.
 * Redirects unauthenticated users to login page.
 * Optionally checks for specific roles.
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { PageSpinner } from '@/components/ui/spinner'
import type { UserRole } from '@/types/auth.types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const { isAuthenticated, user, isLoading } = useAuthStore()

  // Show loading spinner while checking auth
  if (isLoading) {
    return <PageSpinner />
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Check role-based access if allowedRoles is specified
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to unauthorized page or dashboard
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

/**
 * Auth Route Component
 *
 * For auth pages (login, register) - redirects authenticated users to dashboard
 */
interface AuthRouteProps {
  children: React.ReactNode
}

export function AuthRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore()

  // Show loading spinner while checking auth
  if (isLoading) {
    return <PageSpinner />
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
