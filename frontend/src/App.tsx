/**
 * Root Application Component
 *
 * Routes:
 * - Public: /auth/login, /auth/register
 * - Protected: /dashboard, /projects, etc.
 *
 * Note: Quotes are accessed within Projects, not as standalone routes
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute, AuthRoute } from '@/components/auth/ProtectedRoute'

// Layouts
import DashboardLayout from '@/components/layout/DashboardLayout'

// Auth pages
import LoginPage from '@/pages/Login'
import RegisterPage from '@/pages/Register'

// Main pages
import DashboardPage from '@/pages/Dashboard'
import ProjectsPage from '@/pages/Projects'
import NewProjectPage from '@/pages/NewProject'
import ProjectDetailPage from '@/pages/ProjectDetail'
import { QuoteDetail } from '@/pages/QuoteDetail'
import { QuoteEditPage } from '@/pages/QuoteEdit'

// Utility pages
import SettingsPage from '@/pages/Settings'
import HelpPage from '@/pages/Help'
import NotFoundPage from '@/pages/NotFound'
import UnauthorizedPage from '@/pages/Unauthorized'

function App() {
  const { checkAuth } = useAuthStore()

  // Check authentication on app load
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth routes (public) */}
      <Route
        path="/auth/login"
        element={
          <AuthRoute>
            <LoginPage />
          </AuthRoute>
        }
      />
      <Route
        path="/auth/register"
        element={
          <AuthRoute>
            <RegisterPage />
          </AuthRoute>
        }
      />
      <Route path="/auth" element={<Navigate to="/auth/login" replace />} />

      {/* Legacy login route redirect */}
      <Route path="/login" element={<Navigate to="/auth/login" replace />} />

      {/* Protected routes with dashboard layout */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Projects routes */}
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/quotes/:quoteId" element={<QuoteDetail />} />
        <Route path="/projects/:projectId/quotes/:quoteId/edit" element={<QuoteEditPage />} />

        {/* Redirect old /quotes routes to /projects */}
        <Route path="/quotes" element={<Navigate to="/projects" replace />} />
        <Route path="/quotes/new" element={<Navigate to="/projects" replace />} />
        <Route path="/quotes/:id" element={<Navigate to="/projects" replace />} />

        {/* Settings and Help */}
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:section" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Route>

      {/* Error pages */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
