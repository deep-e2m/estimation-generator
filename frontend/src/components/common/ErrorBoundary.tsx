/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors in child components and displays a fallback UI.
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-page">
          <div className="empty-state-icon" style={{ marginBottom: 'var(--space-6)' }}>
            <AlertTriangle style={{ width: 48, height: 48, color: 'var(--color-error-500)' }} />
          </div>
          <h1 className="error-page-title">Something went wrong</h1>
          <p className="error-page-description">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <div
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-gray-100)',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '600px',
                width: '100%',
                overflow: 'auto',
              }}
            >
              <pre style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error-600)' }}>
                {this.state.error.toString()}
              </pre>
            </div>
          )}
          <Button onClick={this.handleReset} style={{ marginTop: 'var(--space-6)' }}>
            <RefreshCw style={{ width: 20, height: 20, marginRight: '8px' }} />
            Refresh Page
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
