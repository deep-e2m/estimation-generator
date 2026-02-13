/**
 * Settings Page
 */

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and application preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>
            Manage your account preferences and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon">
              <SettingsIcon style={{ width: 40, height: 40, color: 'var(--color-primary-500)' }} />
            </div>
            <h3 className="empty-state-title">Coming Soon</h3>
            <p className="empty-state-description">
              Settings management is currently under development.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
