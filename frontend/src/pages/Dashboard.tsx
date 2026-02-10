/**
 * Dashboard Page
 *
 * Main landing page after login showing:
 * - Quick stats
 * - Recent projects
 * - Recent quotes
 */

import { Link } from 'react-router-dom'
import {
  FolderOpen,
  FileText,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react'

import { useUser } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import '@/styles/dashboard.css'

// Stat card component
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  iconBgColor = 'bg-primary-50',
  iconColor = 'text-primary-600',
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  iconBgColor?: string
  iconColor?: string
}) {
  return (
    <Card className="stat-card">
      <CardContent className="stat-card-content">
        <div className="stat-card-inner">
          <div className="stat-card-info">
            <p className="stat-card-title">{title}</p>
            <p className="stat-card-value">{value}</p>
            {trendLabel && (
              <p className="stat-card-trend">
                <TrendingUp
                  className={`h-4 w-4 shrink-0 ${
                    trend === 'up'
                      ? 'text-success-500'
                      : trend === 'down'
                      ? 'text-error-500'
                      : 'text-gray-400'
                  }`}
                />
                <span>{trendLabel}</span>
              </p>
            )}
          </div>
          <div className={`stat-card-icon ${iconBgColor}`}>
            <Icon className={`h-7 w-7 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Empty state component
function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Plus />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link to={actionHref} className="empty-state-btn">
        <Plus />
        {actionLabel}
      </Link>
    </div>
  )
}

export default function DashboardPage() {
  const user = useUser()

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="dashboard">
      {/* Welcome Section */}
      <div className="dashboard-welcome">
        <div>
          <h2>
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'}!
          </h2>
          <p>
            Here's what's happening with your projects today.
          </p>
        </div>
        <Link to="/projects/new" className="dashboard-welcome-btn shrink-0">
          <Plus className="h-5 w-5" />
          New Project
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-stats">
        <StatCard
          title="Total Projects"
          value={0}
          icon={FolderOpen}
          trendLabel="All time"
          iconBgColor="bg-primary-50"
          iconColor="text-primary-600"
        />
        <StatCard
          title="Active Quotes"
          value={0}
          icon={FileText}
          trendLabel="In progress"
          iconBgColor="bg-success-50"
          iconColor="text-success-600"
        />
        <StatCard
          title="Hours Estimated"
          value={0}
          icon={Clock}
          trendLabel="This month"
          iconBgColor="bg-warning-50"
          iconColor="text-warning-600"
        />
        <StatCard
          title="Quotes Generated"
          value={0}
          icon={TrendingUp}
          trendLabel="This week"
          iconBgColor="bg-gray-100"
          iconColor="text-gray-600"
        />
      </div>

      {/* Recent Projects & Quotes */}
      <div className="dashboard-recent">
        {/* Recent Projects */}
        <Card className="card-section">
          <CardHeader className="card-section-header">
            <CardTitle>Recent Projects</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects" className="flex items-center gap-1.5">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="card-section-content">
            <EmptyState
              title="No projects yet"
              description="Create your first project to start generating quotes."
              actionLabel="Create Project"
              actionHref="/projects/new"
            />
          </CardContent>
        </Card>

        {/* Recent Quotes */}
        <Card className="card-section">
          <CardHeader className="card-section-header">
            <CardTitle>Recent Quotes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects" className="flex items-center gap-1.5">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="card-section-content">
            <EmptyState
              title="No quotes yet"
              description="Create a project to generate AI-powered quotes."
              actionLabel="New Project"
              actionHref="/projects/new"
            />
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="dashboard-actions card-section">
        <CardHeader className="card-section-header">
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="card-section-content">
          <div className="quick-actions-grid">
            <Link to="/projects/new" className="quick-action-item primary">
              <div className="quick-action-icon bg-primary-100">
                <Plus className="h-6 w-6 text-primary-600" />
              </div>
              <div className="quick-action-text">
                <p>New Project</p>
                <p>Start with a quote</p>
              </div>
            </Link>

            <Link to="/projects" className="quick-action-item success">
              <div className="quick-action-icon bg-success-100">
                <FolderOpen className="h-6 w-6 text-success-600" />
              </div>
              <div className="quick-action-text">
                <p>All Projects</p>
                <p>View & manage projects</p>
              </div>
            </Link>

            <Link to="/projects" className="quick-action-item warning">
              <div className="quick-action-icon bg-warning-100">
                <FileText className="h-6 w-6 text-warning-600" />
              </div>
              <div className="quick-action-text">
                <p>View Quotes</p>
                <p>Project quotes & history</p>
              </div>
            </Link>

            <Link to="/settings" className="quick-action-item neutral">
              <div className="quick-action-icon bg-gray-100">
                <TrendingUp className="h-6 w-6 text-gray-600" />
              </div>
              <div className="quick-action-text">
                <p>Settings</p>
                <p>Configure preferences</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
