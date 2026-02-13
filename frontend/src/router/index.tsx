/**
 * Application Router Configuration
 *
 * Defines all application routes with:
 * - Public routes (login, register)
 * - Protected routes (dashboard, projects, quotes)
 * - Layout structure
 */

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

import { ProtectedRoute, AuthRoute } from '@/components/auth/ProtectedRoute'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PageSpinner } from '@/components/ui/spinner'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/pages/Login'))
const RegisterPage = lazy(() => import('@/pages/Register'))
const DashboardPage = lazy(() => import('@/pages/Dashboard'))

// Placeholder pages (to be implemented)
const ProjectsPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
        <h2 className="text-lg font-medium text-gray-900">Projects</h2>
        <p className="mt-2 text-gray-500">Projects list will be displayed here.</p>
      </div>
    ),
  })
)

const QuotesPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
        <h2 className="text-lg font-medium text-gray-900">Quotes</h2>
        <p className="mt-2 text-gray-500">Quotes list will be displayed here.</p>
      </div>
    ),
  })
)

const SettingsPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
        <h2 className="text-lg font-medium text-gray-900">Settings</h2>
        <p className="mt-2 text-gray-500">Settings will be displayed here.</p>
      </div>
    ),
  })
)

const HelpPage = lazy(() =>
  Promise.resolve({
    default: () => (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
        <h2 className="text-lg font-medium text-gray-900">Help & Support</h2>
        <p className="mt-2 text-gray-500">Help content will be displayed here.</p>
      </div>
    ),
  })
)

const NotFoundPage = lazy(() =>
  Promise.resolve({
    default: () => (
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
    ),
  })
)

const UnauthorizedPage = lazy(() =>
  Promise.resolve({
    default: () => (
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
    ),
  })
)

// Suspense wrapper for lazy loaded components
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>
}

// Router configuration
export const router = createBrowserRouter([
  // Root redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // Auth routes (public)
  {
    path: '/auth',
    children: [
      {
        path: 'login',
        element: (
          <AuthRoute>
            <SuspenseWrapper>
              <LoginPage />
            </SuspenseWrapper>
          </AuthRoute>
        ),
      },
      {
        path: 'register',
        element: (
          <AuthRoute>
            <SuspenseWrapper>
              <RegisterPage />
            </SuspenseWrapper>
          </AuthRoute>
        ),
      },
      {
        path: '',
        element: <Navigate to="/auth/login" replace />,
      },
    ],
  },

  // Protected routes with dashboard layout
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'projects',
        element: (
          <SuspenseWrapper>
            <ProjectsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'projects/:id',
        element: (
          <SuspenseWrapper>
            <ProjectsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'quotes',
        element: (
          <SuspenseWrapper>
            <QuotesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'quotes/new',
        element: (
          <SuspenseWrapper>
            <QuotesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'quotes/:id',
        element: (
          <SuspenseWrapper>
            <QuotesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings/:section',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'help',
        element: (
          <SuspenseWrapper>
            <HelpPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },

  // Error pages
  {
    path: '/unauthorized',
    element: (
      <SuspenseWrapper>
        <UnauthorizedPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '*',
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
])
