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
import { ProjectsPage } from '@/pages/Projects'
import { NewProjectPage } from '@/pages/NewProject'
import { ProjectDetailPage } from '@/pages/ProjectDetail'
import { QuoteDetail } from '@/pages/QuoteDetail'
import { QuoteEditPage } from '@/pages/QuoteEdit'

// Styles
import '@/styles/chat.css'
import '@/styles/projects.css'
import '@/styles/quotes.css'

function SettingsPage() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
      <h2 className="text-lg font-medium text-gray-900">Settings</h2>
      <p className="mt-2 text-gray-500">Settings will be displayed here.</p>
    </div>
  )
}

function HelpPage() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
      <h2 className="text-lg font-medium text-gray-900">Help & Support</h2>
      <p className="mt-2 text-gray-500">Help content will be displayed here.</p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-900">Page not found</h2>
        <p className="mt-2 text-gray-500">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">403</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-500">
          You don't have permission to access this page.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}

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
