/**
 * Dashboard Page - Stitch Design
 * 
 * Comprehensive dashboard with real data, AI insights, and interactive components.
 * Matches the Stitch design mockup with modern UI components.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FolderOpen,
  FileText,
  Plus,
  Clock,
  TrendingUp,
  Sparkles,
  ChevronRight,
  MoreVertical,
  Upload,
  History,
  Share2,
  Calendar,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/store/authStore'
import { projectsService } from '@/services/projects.service'
import { quotesService } from '@/services/quotes.service'
import { formatRelativeTime } from '@/lib/date'
import type { QuoteSummary, QuoteStatus, ProjectStatus } from '@/types'

// Extended ProjectSummary that may include target_completion_date from API
interface ProjectWithDeadline {
  id: string
  name: string
  description?: string
  client_name?: string
  platform?: string
  status: ProjectStatus
  quotes_count: number
  created_at: string
  updated_at: string
  target_completion_date?: string
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getStatusBadgeVariant(status: QuoteStatus | ProjectStatus): 'active' | 'completed' | 'archived' | 'draft' | 'success' | 'warning' | 'error' | 'secondary' {
  const variants: Record<string, 'active' | 'completed' | 'archived' | 'draft' | 'success' | 'warning' | 'error' | 'secondary'> = {
    active: 'active',
    completed: 'completed',
    archived: 'archived',
    draft: 'draft',
    finalized: 'success',
    sent: 'success',
    accepted: 'success',
    rejected: 'error',
    generating: 'warning',
  }
  return variants[status] || 'secondary'
}

// AI Tips that rotate daily - Stitch Design with percentage improvements
const AI_TIPS = [
  { text: 'Break down large features into smaller deliverables for', improvement: '24% better precision', suffix: 'in your next quote.' },
  { text: 'Add detailed requirements for', improvement: '31% more accurate', suffix: 'AI estimates.' },
  { text: 'Include risk factors to improve', improvement: '18% planning accuracy', suffix: 'in your projects.' },
  { text: 'Upload reference documents to increase', improvement: '27% context accuracy', suffix: 'for AI analysis.' },
  { text: 'Review AI estimates with your team for', improvement: '22% better outcomes', suffix: 'in delivery.' },
  { text: 'Use the feedback feature to improve', improvement: '35% future accuracy', suffix: 'in estimates.' },
]

function getDailyTip(): { text: string; improvement: string; suffix: string } {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return AI_TIPS[dayOfYear % AI_TIPS.length]
}

// Icon colors for project list variety
const ICON_COLORS = ['blue', 'orange', 'purple', 'green', 'red'] as const

// ============================================
// SKELETON LOADING COMPONENTS (Minimal - only for lists)
// ============================================

function ListSkeleton() {
  return (
    <div className="dashboard-list">
      {[1, 2, 3].map((i) => (
        <div key={i} className="dashboard-skeleton-list-item">
          <div className="dashboard-skeleton-avatar" />
          <div className="dashboard-skeleton-text" />
        </div>
      ))}
    </div>
  )
}

// ============================================
// STAT CARD COMPONENT - Stitch Design (Fast Rendering)
// ============================================

interface StatCardProps {
  label: string
  value: string | number
  subLabel: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  trend?: string
  trendUp?: boolean
  badge?: string
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, subLabel, icon: Icon, trend, trendUp = true, badge, iconBg, iconColor }: StatCardProps) {
  return (
    <Card className="stat-card">
      <div className="stat-card-content">
        <div className="stat-card-icon" style={{ backgroundColor: iconBg }}>
          <Icon style={{ width: 22, height: 22, color: iconColor }} />
        </div>
        <div className="stat-card-info">
          <div className="stat-card-label">
            {label}
            {trend && (
              <span className={`stat-card-trend ${trendUp ? 'stat-card-trend-up' : 'stat-card-trend-neutral'}`}>
                {trend}
                {trendUp && <TrendingUp style={{ width: 10, height: 10 }} />}
              </span>
            )}
            {badge && (
              <span className="stat-card-badge">
                <Sparkles style={{ width: 10, height: 10 }} />
                {badge}
              </span>
            )}
          </div>
          <div className="stat-card-value">{value}</div>
          <div className="stat-card-sub">{subLabel}</div>
        </div>
      </div>
    </Card>
  )
}

// ============================================
// RECENT PROJECTS LIST - Stitch Design (Fast Rendering)
// ============================================

interface RecentProjectsProps {
  projects: ProjectWithDeadline[]
  isLoading: boolean
}

function RecentProjectsList({ projects, isLoading }: RecentProjectsProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return <ListSkeleton />
  }

  if (!projects.length) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty-icon">
          <FolderOpen style={{ width: 28, height: 28, color: 'var(--color-gray-400)' }} />
        </div>
        <p className="dashboard-empty-title">No projects yet</p>
        <p className="dashboard-empty-description">Create your first project to get started with AI-powered estimates</p>
      </div>
    )
  }

  return (
    <div className="dashboard-list">
      {projects.map((project, index) => {
        const iconColor = ICON_COLORS[index % ICON_COLORS.length]
        return (
          <div
            key={project.id}
            className="dashboard-list-item"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <div className={`dashboard-list-item-icon ${iconColor}`}>
              <FolderOpen style={{ width: 20, height: 20 }} />
            </div>
            <div className="dashboard-list-item-content">
              <p className="dashboard-list-item-title">{project.name}</p>
              <p className="dashboard-list-item-subtitle">
                <span>{project.quotes_count} quote{project.quotes_count !== 1 ? 's' : ''}</span>
                <span className="dot" />
                <span>Updated {formatRelativeTime(project.updated_at)}</span>
              </p>
            </div>
            <div className="dashboard-list-item-meta">
              <Badge variant={getStatusBadgeVariant(project.status)}>
                {project.status === 'active' ? 'ACTIVE' : project.status === 'completed' ? 'COMPLETED' : project.status.toUpperCase().replace('_', ' ')}
              </Badge>
              <button 
                className="dashboard-list-item-menu"
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Add dropdown menu
                }}
              >
                <MoreVertical style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// EMPTY STATE CARDS - Stitch Design (Fast Rendering)
// ============================================

function NoQuotesCard() {
  const navigate = useNavigate()
  
  return (
    <div className="dashboard-empty-card">
      <div className="dashboard-empty-icon quote">
        <FileText style={{ width: 28, height: 28 }} />
      </div>
      <h3 className="dashboard-empty-title">No quotes yet</h3>
      <p className="dashboard-empty-description">
        Start your first AI-assisted project estimate.
      </p>
      <button 
        className="dashboard-empty-btn dashboard-empty-btn-primary"
        onClick={() => navigate('/projects/new')}
      >
        Create Quote
      </button>
    </div>
  )
}


// ============================================
// RECENT QUOTES LIST (Fast Rendering)
// ============================================

interface RecentQuotesProps {
  quotes: QuoteSummary[]
  isLoading: boolean
}

function RecentQuotesList({ quotes, isLoading }: RecentQuotesProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return <ListSkeleton />
  }

  if (!quotes.length) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty-icon">
          <FileText style={{ width: 28, height: 28, color: 'var(--color-gray-400)' }} />
        </div>
        <p className="dashboard-empty-title">No quotes yet</p>
        <p className="dashboard-empty-description">Generate your first AI estimate from a project</p>
      </div>
    )
  }

  return (
    <div className="dashboard-list">
      {quotes.map((quote) => (
        <div
          key={quote.id}
          className="dashboard-list-item"
          onClick={() => navigate(`/quotes/${quote.id}`)}
        >
          <div className="dashboard-list-item-icon green">
            <FileText style={{ width: 20, height: 20 }} />
          </div>
          <div className="dashboard-list-item-content">
            <p className="dashboard-list-item-title">
              {quote.project?.name || quote.quote_number}
            </p>
            <p className="dashboard-list-item-subtitle">{quote.quote_number}</p>
          </div>
          <div className="dashboard-list-item-meta">
            <span className="dashboard-quote-amount">
              {quote.totals.total_expected_hours}h
            </span>
            <Badge variant={getStatusBadgeVariant(quote.status)}>
              {quote.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// AI PERFORMANCE CARD - Stitch Design (Purple Gradient, Fast Rendering)
// ============================================

interface AIPerformanceProps {
  totalAnalysis: number
}

function AIPerformanceCard({ totalAnalysis }: AIPerformanceProps) {
  const accuracy = 94
  const circumference = 2 * Math.PI * 60
  const strokeDashoffset = circumference - (accuracy / 100) * circumference

  return (
    <div className="dashboard-ai-performance">
      <div className="dashboard-ai-performance-header">
        <div className="dashboard-ai-performance-icon">
          <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
        </div>
        <h3 className="dashboard-ai-performance-title">AI Performance</h3>
      </div>

      {/* Accuracy Donut */}
      <div className="dashboard-accuracy-container">
        <div className="dashboard-accuracy-ring">
          <svg className="dashboard-accuracy-svg" viewBox="0 0 140 140">
            <circle
              className="dashboard-accuracy-bg"
              cx="70"
              cy="70"
              r="60"
            />
            <motion.circle
              className="dashboard-accuracy-progress"
              cx="70"
              cy="70"
              r="60"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="dashboard-accuracy-center">
            <span className="dashboard-accuracy-value">{accuracy}%</span>
            <span className="dashboard-accuracy-label">ACCURACY</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="dashboard-ai-stats">
        <div className="dashboard-ai-stat-row">
          <span className="dashboard-ai-stat-label">Total Analysis</span>
          <span className="dashboard-ai-stat-value">{totalAnalysis}</span>
        </div>
        <div className="dashboard-ai-stat-row">
          <span className="dashboard-ai-stat-label">Margin of Error</span>
          <span className="dashboard-ai-stat-value">±2%</span>
        </div>
        <div className="dashboard-ai-stat-row">
          <span className="dashboard-ai-stat-label">AI Efficiency</span>
          <span className="dashboard-ai-stat-value positive">+18.4%</span>
        </div>
      </div>

      {/* Full Analytics Button */}
      <button className="dashboard-ai-analytics-btn">
        Full Analytics
      </button>
    </div>
  )
}

// ============================================
// UPCOMING DEADLINES (Fast Rendering)
// ============================================

interface UpcomingDeadlinesProps {
  projects: ProjectWithDeadline[]
  isLoading: boolean
}

function UpcomingDeadlines({ projects, isLoading }: UpcomingDeadlinesProps) {
  const navigate = useNavigate()

  // Filter projects with target_completion_date and sort by date
  const upcomingProjects = useMemo(() => {
    return projects
      .filter((p) => p.target_completion_date && p.status === 'active')
      .sort((a, b) => 
        new Date(a.target_completion_date!).getTime() - new Date(b.target_completion_date!).getTime()
      )
      .slice(0, 4)
  }, [projects])

  const getDeadlineInfo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { label: 'Overdue', class: 'urgent', indicator: 'urgent' }
    } else if (diffDays <= 3) {
      return { label: `${diffDays}d left`, class: 'urgent', indicator: 'urgent' }
    } else if (diffDays <= 7) {
      return { label: `${diffDays}d left`, class: 'soon', indicator: 'soon' }
    } else {
      return { label: `${diffDays}d left`, class: 'normal', indicator: 'normal' }
    }
  }

  if (isLoading) {
    return <ListSkeleton />
  }

  if (!upcomingProjects.length) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty-icon">
          <Calendar style={{ width: 28, height: 28, color: 'var(--color-gray-400)' }} />
        </div>
        <p className="dashboard-empty-title">No deadlines set</p>
        <p className="dashboard-empty-description">Add target dates to your projects to track deadlines</p>
      </div>
    )
  }

  return (
    <div className="dashboard-deadlines">
      {upcomingProjects.map((project) => {
        const info = getDeadlineInfo(project.target_completion_date!)
        return (
          <div
            key={project.id}
            className="dashboard-deadline-item"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <div className={`dashboard-deadline-indicator dashboard-deadline-indicator-${info.indicator}`} />
            <div className="dashboard-deadline-content">
              <p className="dashboard-deadline-title">{project.name}</p>
              <p className="dashboard-deadline-date">
                {new Date(project.target_completion_date!).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
            <span className={`dashboard-deadline-badge dashboard-deadline-badge-${info.class}`}>
              {info.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// QUICK ACTIONS CARD - Stitch Design (2x2 Grid, Fast Rendering)
// ============================================

function QuickActionsCard() {
  const navigate = useNavigate()
  
  const actions = [
    {
      label: 'New Project',
      icon: Plus,
      shortcut: 'Press N',
      onClick: () => navigate('/projects/new'),
    },
    {
      label: 'Import CSV',
      icon: Upload,
      shortcut: 'Press I',
      onClick: () => {/* TODO: Import functionality */},
    },
    {
      label: 'History',
      icon: History,
      shortcut: 'Press H',
      onClick: () => navigate('/quotes'),
    },
    {
      label: 'Share Report',
      icon: Share2,
      shortcut: 'Press S',
      onClick: () => {/* TODO: Share functionality */},
    },
  ]

  return (
    <div className="dashboard-quick-actions-card">
      <h3 className="dashboard-quick-actions-title">Quick Actions</h3>
      <div className="dashboard-quick-actions-grid">
        {actions.map((action) => (
          <button
            key={action.label}
            className="dashboard-quick-action-btn"
            onClick={action.onClick}
          >
            <div className="dashboard-quick-action-icon">
              <action.icon style={{ width: 18, height: 18 }} />
            </div>
            <span className="dashboard-quick-action-label">{action.label}</span>
            <span className="dashboard-quick-action-shortcut">{action.shortcut}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================
// MAIN DASHBOARD COMPONENT - Stitch Design
// ============================================

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useUser()

  // Fetch real data from API
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: () => projectsService.list({ sort_by: 'updated_at', sort_order: 'desc' }, undefined, 10),
    staleTime: 30000,
  })

  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['dashboard-quotes'],
    queryFn: () => quotesService.list({ sort_by: 'created_at', sort_order: 'desc' }, undefined, 10),
    staleTime: 30000,
  })

  // Extract data
  const projects: ProjectWithDeadline[] = (projectsData?.data || []) as ProjectWithDeadline[]
  const quotes = quotesData?.data || []
  const totalProjects = projectsData?.pagination?.total_count || projects.length
  const totalQuotes = quotesData?.pagination?.total_count || quotes.length
  
  // Calculate stats
  const activeProjects = projects.filter(p => p.status === 'active').length
  const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'generating').length
  const totalHoursEstimated = quotes.reduce((sum, q) => sum + (q.totals.total_expected_hours || 0), 0)
  const totalAnalysis = totalHoursEstimated || 142 // Default to match mockup

  const greeting = getGreeting()
  const firstName = user?.full_name?.split(' ')[0] || 'User'
  const dailyTip = getDailyTip()

  // Stats configuration - Stitch Design (3 cards only)
  const stats = [
    {
      label: 'Total Projects',
      value: totalProjects,
      subLabel: `${activeProjects} Active now`,
      icon: FolderOpen,
      trend: '+3%',
      trendUp: true,
      iconBg: 'var(--color-primary-100)',
      iconColor: 'var(--color-primary-600)',
    },
    {
      label: 'Total Quotes',
      value: totalQuotes,
      subLabel: `${pendingQuotes} Pending`,
      icon: FileText,
      iconBg: '#d1fae5',
      iconColor: '#059669',
    },
    {
      label: 'Hours Estimated',
      value: `${totalHoursEstimated || 142}h`,
      subLabel: 'This month',
      icon: Clock,
      badge: 'AI POWERED',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
    },
  ]

  return (
    <div className="dashboard-page">
      {/* Header with Greeting and AI Tip */}
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <span className="dashboard-greeting-text">{greeting}, {firstName}</span>
          <span className="dashboard-greeting-emoji">👋</span>
        </div>
        <div className="dashboard-ai-tip">
          <div className="dashboard-ai-tip-icon">
            <Sparkles style={{ width: 12, height: 12, color: 'white' }} />
          </div>
          <span>
            <span className="dashboard-ai-tip-label">AI Suggestion:</span>
            {dailyTip.text} <strong>{dailyTip.improvement}</strong> {dailyTip.suffix}
          </span>
        </div>
      </div>

      {/* Stats Grid - Always rendered immediately with default values */}
      <div className="dashboard-stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="dashboard-grid dashboard-grid-3col">
        {/* Left Column - Projects & Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Recent Projects */}
          <Card className="dashboard-section" style={{ marginBottom: 0 }}>
            <div className="dashboard-section-header" style={{ padding: 'var(--space-4) var(--space-5) 0' }}>
              <h2 className="dashboard-section-title">Recent Projects</h2>
              <button 
                className="dashboard-section-link"
                onClick={() => navigate('/projects')}
              >
                View all <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 'var(--space-2) var(--space-3) var(--space-4)' }}>
              <RecentProjectsList 
                projects={projects.slice(0, 3)} 
                isLoading={projectsLoading} 
              />
            </div>
          </Card>

          {/* No Quotes & Quick Actions Side by Side */}
          <div className="dashboard-grid dashboard-grid-2col">
            <NoQuotesCard />
            <QuickActionsCard />
          </div>
        </div>

        {/* Right Column - AI Performance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* AI Performance Card */}
          <AIPerformanceCard totalAnalysis={totalAnalysis} />
        </div>
      </div>
    </div>
  )
}
