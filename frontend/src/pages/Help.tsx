/**
 * Help Page
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { HelpCircle, Mail, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Help() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Help & Support</h1>
        <p className="page-subtitle">Get help with Estimate AI</p>
      </div>

      <div className="grid lg:grid-cols-2 grid-cols-1" style={{ gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader>
            <CardTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <MessageSquare style={{ width: 24, height: 24, color: 'var(--color-primary-500)' }} />
                Documentation
              </div>
            </CardTitle>
            <CardDescription>
              Learn how to use Estimate AI effectively
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Browse our comprehensive documentation to learn about all features and best practices.
            </p>
            <Button variant="outline">View Documentation</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Mail style={{ width: 24, height: 24, color: 'var(--color-primary-500)' }} />
                Contact Support
              </div>
            </CardTitle>
            <CardDescription>
              Need help? Our support team is here for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              If you need additional assistance, reach out to our support team and we'll get back to you shortly.
            </p>
            <Button variant="outline">Contact Us</Button>
          </CardContent>
        </Card>
      </div>

      <Card style={{ marginTop: 'var(--space-6)' }}>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon">
              <HelpCircle style={{ width: 40, height: 40, color: 'var(--color-primary-500)' }} />
            </div>
            <h3 className="empty-state-title">FAQ Coming Soon</h3>
            <p className="empty-state-description">
              We're working on a comprehensive FAQ section to help answer your questions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
