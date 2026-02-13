/**
 * 401 Unauthorized Page
 */

import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'

export default function Unauthorized() {
  const navigate = useNavigate()

  return (
    <div className="error-page">
      <div className="error-page-code">401</div>
      <h1 className="error-page-title">Unauthorized</h1>
      <p className="error-page-description">
        You don't have permission to access this page. Please sign in to continue.
      </p>
      <Button onClick={() => navigate('/auth/login')}>
        <LogIn style={{ width: 20, height: 20, marginRight: '8px' }} />
        Sign In
      </Button>
    </div>
  )
}
