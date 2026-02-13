/**
 * 404 Not Found Page
 */

import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="error-page">
      <div className="error-page-code">404</div>
      <h1 className="error-page-title">Page not found</h1>
      <p className="error-page-description">
        Sorry, we couldn't find the page you're looking for.
      </p>
      <Button onClick={() => navigate('/dashboard')}>
        <Home style={{ width: 20, height: 20, marginRight: '8px' }} />
        Back to Dashboard
      </Button>
    </div>
  )
}
