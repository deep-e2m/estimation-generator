/**
 * Dashboard Page - Stitch Design
 * 
 * Comprehensive dashboard with real data, AI insights, and interactive components.
 * Matches the Stitch design mockup with modern UI components.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FolderOpen,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  MoreVertical,
  Calendar,
  BarChart3,
  Edit,
  Archive,
  Trash2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dropdown } from '@/components/ui/dropdown'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useUser, useCanManageUsers } from '@/store/authStore'
import { projectsService } from '@/services/projects.service'
import { quotesService } from '@/services/quotes.service'
import {
  dashboardService,
  type AnalyticsPeriod,
} from '@/services/dashboard.service'
import { formatRelativeTime } from '@/lib/date'
import type { QuoteSummary, QuoteStatus, ProjectStatus } from '@/types'

// Extended ProjectSummary that may include target_completion_date from API
interface ProjectWithDeadline {
  id: string
  name: string
  description?: string
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
// STAT CARD COMPONENT - Analytics page format (icon left, value prominent)
// ============================================

type KpiColor = 'primary' | 'emerald' | 'amber' | 'violet'

interface StatCardProps {
  label: string
  value: string | number
  subLabel: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  color: KpiColor
}

function StatCard({ label, value, subLabel, icon: Icon, color }: StatCardProps) {
  return (
    <Card className={`admin-analytics-kpi admin-analytics-kpi-${color}`}>
      <div className="admin-analytics-kpi-icon">
        <Icon style={{ width: 22, height: 22 }} />
      </div>
      <div className="admin-analytics-kpi-content">
        <span className="admin-analytics-kpi-value">{value}</span>
        <span className="admin-analytics-kpi-label">{label}</span>
        <span className="admin-analytics-kpi-sub">{subLabel}</span>
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
  onProjectAction?: (action: string, project: ProjectWithDeadline) => void
}

function RecentProjectsList({ projects, isLoading, onProjectAction }: RecentProjectsProps) {
  const navigate = useNavigate()

  const projectDropdownOptions = [
    { value: 'view', label: 'View project', icon: <Edit style={{ width: 16, height: 16 }} /> },
    { value: 'archive', label: 'Archive', icon: <Archive style={{ width: 16, height: 16 }} /> },
    { value: 'divider', label: '', divider: true },
    { value: 'delete', label: 'Delete', icon: <Trash2 style={{ width: 16, height: 16 }} />, danger: true },
  ]

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
              {onProjectAction ? (
                <Dropdown
                  align="right"
                  trigger={
                    <button
                      className="dashboard-list-item-menu"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Project actions"
                    >
                      <MoreVertical style={{ width: 16, height: 16 }} />
                    </button>
                  }
                  options={projectDropdownOptions}
                  onSelect={(value) => {
                    if (value === 'view') {
                      navigate(`/projects/${project.id}`)
                    } else {
                      onProjectAction(value, project)
                    }
                  }}
                />
              ) : (
                <button className="dashboard-list-item-menu" onClick={(e) => e.stopPropagation()} aria-hidden>
                  <MoreVertical style={{ width: 16, height: 16 }} />
                </button>
              )}
            </div>
          </div>
        )
      })}
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
          onClick={() => {
            const projectId = quote.project?.id
            if (projectId) {
              navigate(`/projects/${projectId}/quotes/${quote.id}`)
            } else {
              navigate(`/projects`)
            }
          }}
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
  /** Total hours estimated (from dashboard stats API) – real data from DB */
  totalAnalysis: number;
  /** Accuracy / margin / efficiency: from API; may be benchmark (placeholder) or measured */
  accuracyPercent: number | null;
  marginOfErrorPercent: number | null;
  aiEfficiencyPercent: number | null;
  /** 'benchmark' = placeholder values; 'measured' = real */
  metricsSource: 'benchmark' | 'measured' | null;
  /** Open Full Analytics popup */
  onFullAnalytics: () => void;
}

function AIPerformanceCard({
  totalAnalysis,
  accuracyPercent,
  marginOfErrorPercent,
  aiEfficiencyPercent,
  metricsSource,
  onFullAnalytics,
}: AIPerformanceProps) {
  const circumference = 2 * Math.PI * 60
  const hasAccuracy = accuracyPercent != null
  const strokeDashoffset = hasAccuracy
    ? circumference - (accuracyPercent / 100) * circumference
    : circumference
  const isBenchmark = metricsSource === 'benchmark'

  return (
    <div className="dashboard-ai-performance">
      <div className="dashboard-ai-performance-header">
        <div className="dashboard-ai-performance-icon">
          <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <h3 className="dashboard-ai-performance-title">AI Performance</h3>
          {isBenchmark && (
            <span
              className="dashboard-accuracy-benchmark"
              title="Values are industry-typical placeholders; real metrics will appear when measured from your quotes"
            >
              Benchmark
            </span>
          )}
        </div>
      </div>

      {/* Accuracy Donut - empty when no data */}
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
            <span className="dashboard-accuracy-value">
              {hasAccuracy ? `${accuracyPercent}%` : '—'}
            </span>
            <span className="dashboard-accuracy-label">ACCURACY</span>
            {isBenchmark && (
              <span className="dashboard-accuracy-benchmark" title="Industry typical; not yet measured from your quotes">
                Typical
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Total Analysis = real DB data; Accuracy/Margin/Efficiency may be benchmark */}
      <div className="dashboard-ai-stats">
        <div className="dashboard-ai-stat-row">
          <span className="dashboard-ai-stat-label">Total Analysis</span>
          <span className="dashboard-ai-stat-value" title="Total hours from your quotes (from database)">
            {totalAnalysis}
          </span>
        </div>
        <div className="dashboard-ai-stat-row">
          <span className="dashboard-ai-stat-label">Margin of Error</span>
          <span className="dashboard-ai-stat-value" title={isBenchmark ? 'Typical range; not yet measured' : undefined}>
            {marginOfErrorPercent != null ? `±${marginOfErrorPercent}%` : '—'}
            {isBenchmark && <span className="dashboard-ai-stat-benchmark"> typ.</span>}
          </span>
        </div>
        <div className="dashboard-ai-stat-row">
          <span className="dashboard-ai-stat-label">AI Efficiency</span>
          <span className="dashboard-ai-stat-value positive" title={isBenchmark ? 'Typical gain; not yet measured' : undefined}>
            {aiEfficiencyPercent != null ? `+${aiEfficiencyPercent}%` : '—'}
            {isBenchmark && <span className="dashboard-ai-stat-benchmark"> typ.</span>}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="dashboard-ai-analytics-btn"
        onClick={onFullAnalytics}
      >
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
// MAIN DASHBOARD COMPONENT - Stitch Design
// ============================================

// ============================================
// FULL ANALYTICS POPUP (graph, models, tokens, accuracy)
// ============================================

interface FullAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FullAnalyticsDialog({ open, onOpenChange }: FullAnalyticsDialogProps) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => dashboardService.getAnalytics(),
    enabled: open,
    staleTime: 60000,
  })

  const models = analytics?.models ?? []
  const maxTokens = Math.max(...models.map((m) => m.total_tokens), 1)
  const hasAnyAccuracy = models.some((m) => m.accuracy_percent != null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dashboard-analytics-dialog">
        <DialogHeader>
          <DialogTitle className="dashboard-analytics-dialog-title">
            <BarChart3 className="dashboard-analytics-dialog-title-icon" />
            AI Analytics
          </DialogTitle>
          <DialogDescription className="dashboard-analytics-dialog-desc">
            Usage and token consumption across models used for your quotes.
          </DialogDescription>
          <p className="dashboard-analytics-data-note">
            Quotes analyzed, total tokens, and per-model usage are from your saved quotes (accurate). Per-model accuracy will appear when we have feedback data.
          </p>
        </DialogHeader>
        <div className="dashboard-analytics-body">
          {isLoading ? (
            <div className="dashboard-analytics-loading">
              <span className="dashboard-analytics-loading-text">Loading analytics…</span>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {analytics && (
                <div className="dashboard-analytics-summary-cards">
                  <div className="dashboard-analytics-summary-card">
                    <span className="dashboard-analytics-summary-card-value">
                      {analytics.total_quotes_analyzed}
                    </span>
                    <span className="dashboard-analytics-summary-card-label">Quotes analyzed</span>
                  </div>
                  <div className="dashboard-analytics-summary-card">
                    <span className="dashboard-analytics-summary-card-value">
                      {analytics.total_tokens_all_time.toLocaleString()}
                    </span>
                    <span className="dashboard-analytics-summary-card-label">Total tokens</span>
                  </div>
                </div>
              )}

              {/* Tokens by model chart */}
              {models.length > 0 ? (
                <section className="dashboard-analytics-section">
                  <h3 className="dashboard-analytics-section-title">Tokens by model</h3>
                  <div className="dashboard-analytics-chart">
                    <div className="dashboard-analytics-bars">
                      {models.map((m) => (
                        <div key={m.model_id} className="dashboard-analytics-bar-row">
                          <span className="dashboard-analytics-bar-label" title={m.model_id}>
                            {m.model_id.split('/').pop() ?? m.model_id}
                          </span>
                          <div className="dashboard-analytics-bar-track">
                            <div
                              className="dashboard-analytics-bar-fill"
                              style={{
                                width: `${(m.total_tokens / maxTokens) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="dashboard-analytics-bar-value">
                            {m.total_tokens.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {/* Models used */}
              <section className="dashboard-analytics-section">
                <h3 className="dashboard-analytics-section-title">Models used</h3>
                {models.length === 0 ? (
                  <p className="dashboard-analytics-empty">
                    No model data yet. Generate a quote to see usage here.
                  </p>
                ) : (
                  <>
                    <ul className="dashboard-analytics-models-list">
                      {models.map((m) => (
                        <li key={m.model_id} className="dashboard-analytics-model-card">
                          <div className="dashboard-analytics-model-card-top">
                            <span className="dashboard-analytics-model-name" title={m.model_id}>
                              {m.model_id.split('/').pop() ?? m.model_id}
                            </span>
                            <span className="dashboard-analytics-model-stats">
                              {m.quote_count} quote{m.quote_count !== 1 ? 's' : ''} · {m.total_tokens.toLocaleString()} tokens
                              {m.total_cost > 0 && ` · $${m.total_cost.toFixed(4)}`}
                            </span>
                          </div>
                          <p className="dashboard-analytics-model-desc">{m.description}</p>
                          {hasAnyAccuracy && (
                            <div className="dashboard-analytics-model-accuracy">
                              Accuracy: {m.accuracy_percent != null ? `${m.accuracy_percent}%` : '—'}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {!hasAnyAccuracy && (
                      <p className="dashboard-analytics-accuracy-note">
                        Per-model accuracy will appear here once we have enough feedback data.
                      </p>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN DASHBOARD COMPONENT - Stitch Design
// ============================================

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useUser()
  const queryClient = useQueryClient()
  const [fullAnalyticsOpen, setFullAnalyticsOpen] = useState(false)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('30d')
  const canManageUsers = useCanManageUsers()

  // Dashboard stats from DB (so totals and hours stay correct when projects/quotes are deleted)
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: 10000,
  })

  // Fetch list data for "recent" sections only (not for card totals)
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: () => projectsService.list({ sort_by: 'updated_at', sort_order: 'desc' }, 1, 10),
    staleTime: 10000,
  })

  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['dashboard-quotes'],
    queryFn: () => quotesService.list({ sort_by: 'created_at', sort_order: 'desc' }, undefined, 10),
    staleTime: 10000,
  })

  // Admin analytics graphs (admin only)
  const { data: quotesOverTime = [] } = useQuery({
    queryKey: ['analytics-quotes-over-time', analyticsPeriod],
    queryFn: () => dashboardService.getQuotesOverTime(analyticsPeriod),
    staleTime: 60000,
    enabled: canManageUsers,
  })

  const { data: aiUsageOverTime = [] } = useQuery({
    queryKey: ['analytics-ai-usage-over-time', analyticsPeriod],
    queryFn: () => dashboardService.getAIUsageOverTime(analyticsPeriod),
    staleTime: 60000,
    enabled: canManageUsers,
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => projectsService.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-quotes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const archiveProjectMutation = useMutation({
    mutationFn: (projectId: string) => projectsService.archive(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleProjectAction = (action: string, project: ProjectWithDeadline) => {
    if (action === 'archive') {
      archiveProjectMutation.mutate(project.id)
    } else if (action === 'delete') {
      if (window.confirm(`Delete "${project.name}"? This will permanently delete the project and all associated quotes. This cannot be undone.`)) {
        deleteProjectMutation.mutate(project.id)
      }
    }
  }

  // Lists for recent projects / recent quotes
  const projects: ProjectWithDeadline[] = (projectsData?.data || []) as ProjectWithDeadline[]
  const quotes = quotesData?.data || []

  // Card values from DB stats (fallback to list-derived only while stats load)
  const totalProjects = stats?.total_projects ?? projectsData?.pagination?.total_count ?? projects.length
  const totalQuotes = stats?.total_quotes ?? quotesData?.pagination?.total_count ?? quotes.length
  const activeProjects = stats?.active_projects ?? projects.filter(p => p.status === 'active').length
  const pendingQuotes = stats?.pending_quotes ?? quotes.filter(q => q.status === 'draft' || q.status === 'generating').length
  const totalHoursEstimated = stats?.total_hours_estimated ?? quotes.reduce((sum, q) => sum + (q.totals.total_expected_hours || 0), 0)
  const totalAnalysis = totalHoursEstimated || 0

  const greeting = getGreeting()
  const firstName = user?.full_name?.split(' ')[0] || 'User'
  const dailyTip = getDailyTip()

  // Stats configuration - Analytics page format (3 cards)
  const statsCards = [
    {
      label: 'Total Projects',
      value: totalProjects,
      subLabel: `${activeProjects} active`,
      icon: FolderOpen,
      color: 'primary' as const,
    },
    {
      label: 'Total Quotes',
      value: totalQuotes,
      subLabel: `${pendingQuotes} pending`,
      icon: FileText,
      color: 'emerald' as const,
    },
    {
      label: 'Hours Estimated',
      value: `${totalHoursEstimated}h`,
      subLabel: 'All time',
      icon: Clock,
      color: 'amber' as const,
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

      {/* Main content + AI Performance sidebar: AI card spans beside top row AND graphs */}
      <div className="dashboard-main-with-sidebar">
        <div className="dashboard-main-content">
          <div className="dashboard-top-row">
            <div className="dashboard-stats-compressed">
              {statsCards.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>

          {/* Admin Analytics: Graphs (admin only) */}
          {canManageUsers && (
            <div className="dashboard-admin-graphs">
          <Card className="dashboard-graph-card">
            <div className="dashboard-graph-header">
              <h3 className="dashboard-graph-title">Quotes & hours estimated over time</h3>
              <select
                value={analyticsPeriod}
                onChange={(e) => setAnalyticsPeriod(e.target.value as AnalyticsPeriod)}
                className="dashboard-graph-period-select"
                aria-label="Time period"
              >
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </select>
            </div>
            {quotesOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={quotesOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboard-hours-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary-400)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-gray-400)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} stroke="var(--color-gray-400)" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} stroke="var(--color-gray-400)" />
                  <Tooltip
                    formatter={(v: number | unknown, n?: string) => [Number(v ?? 0), n === 'count' ? 'Quotes' : 'Hours']}
                    labelFormatter={(l) => `Date: ${l}`}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-primary-500)"
                    fill="url(#dashboard-hours-grad)"
                    name="Quotes"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="total_hours"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    name="Hours"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="dashboard-graph-empty">No quotes in this period</p>
            )}
          </Card>
          <Card className="dashboard-graph-card">
            <div className="dashboard-graph-header">
              <h3 className="dashboard-graph-title">Token usage & cost over time</h3>
              <select
                value={analyticsPeriod}
                onChange={(e) => setAnalyticsPeriod(e.target.value as AnalyticsPeriod)}
                className="dashboard-graph-period-select"
                aria-label="Time period"
              >
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </select>
            </div>
            {aiUsageOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={aiUsageOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboard-tokens-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-gray-400)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} stroke="var(--color-gray-400)" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${v.toFixed(4)}`}
                    stroke="var(--color-gray-400)"
                  />
                  <Tooltip
                    formatter={(v: number | unknown, n?: string) => [
                      n === 'tokens' ? Number(v ?? 0).toLocaleString() : `$${Number(v ?? 0).toFixed(4)}`,
                      n === 'tokens' ? 'Tokens' : 'Cost',
                    ]}
                    labelFormatter={(l) => `Date: ${l}`}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="tokens"
                    stroke="#7c3aed"
                    fill="url(#dashboard-tokens-grad)"
                    name="Tokens"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cost"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    name="Cost"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="dashboard-graph-empty">No AI usage in this period</p>
            )}
          </Card>
            </div>
          )}
        </div>

        <div className="dashboard-ai-performance-sidebar">
          <AIPerformanceCard
            totalAnalysis={totalAnalysis}
            accuracyPercent={stats?.ai_accuracy_percent ?? null}
            marginOfErrorPercent={stats?.margin_of_error_percent ?? null}
            aiEfficiencyPercent={stats?.ai_efficiency_percent ?? null}
            metricsSource={stats?.ai_metrics_source ?? null}
            onFullAnalytics={canManageUsers ? () => navigate('/admin/analytics') : () => setFullAnalyticsOpen(true)}
          />
        </div>
      </div>

      {/* Recent Projects - Full width at bottom */}
      <Card className="dashboard-section dashboard-section-bottom">
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
            onProjectAction={handleProjectAction}
          />
        </div>
      </Card>

      <FullAnalyticsDialog
        open={fullAnalyticsOpen}
        onOpenChange={setFullAnalyticsOpen}
      />
    </div>
  )
}
