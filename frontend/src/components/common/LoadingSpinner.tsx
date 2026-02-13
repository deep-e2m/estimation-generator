/**
 * Loading Spinner Component
 * 
 * Full-page loading state.
 */

import { Spinner } from '@/components/ui/spinner'

interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="page-spinner" style={{ flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Spinner size="lg" />
      {message && (
        <p className="text-sm text-gray-500">{message}</p>
      )}
    </div>
  )
}
