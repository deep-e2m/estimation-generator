/**
 * Admin Analytics Page
 *
 * Delightful, transparent analytics dashboard for admins.
 * Clear sections, premium UI, and easy-to-scan data visualization.
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Download,
  ExternalLink,
  FolderOpen,
  FileText,
  Sparkles,
  TrendingUp,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  Bar,
  BarChart,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  dashboardService,
  type AnalyticsPeriod,
} from '@/services/dashboard.service'

const CHART_COLORS = [
  'var(--color-primary-500)',
  '#059669', /* emerald */
  '#d97706', /* amber */
  '#dc2626', /* red */
  '#7c3aed', /* violet */
  '#0891b2', /* cyan */
]

/** Tighter Y-axis domain so data fills the chart (reduces excess vertical whitespace) */
const COMPACT_DOMAIN: [string, string] = ['dataMin', 'dataMax']

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: 60000,
  })

  const { data: byStatus, isLoading: byStatusLoading } = useQuery({
    queryKey: ['analytics-by-status'],
    queryFn: () => dashboardService.getByStatus(),
    staleTime: 60000,
  })

  const { data: projectsOverTime, isLoading: projectsOverTimeLoading } = useQuery({
    queryKey: ['analytics-projects-over-time', period],
    queryFn: () => dashboardService.getProjectsOverTime(period),
    staleTime: 60000,
  })

  const { data: quotesOverTime, isLoading: quotesOverTimeLoading } = useQuery({
    queryKey: ['analytics-quotes-over-time', period],
    queryFn: () => dashboardService.getQuotesOverTime(period),
    staleTime: 60000,
  })

  const { data: activitySummary, isLoading: activityLoading } = useQuery({
    queryKey: ['analytics-activity-summary', period],
    queryFn: () => dashboardService.getActivitySummary(period),
    staleTime: 60000,
  })

  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ['analytics-user-stats'],
    queryFn: () => dashboardService.getUserStats(10),
    staleTime: 60000,
  })

  const { data: aiUsageOverTime, isLoading: aiUsageLoading } = useQuery({
    queryKey: ['analytics-ai-usage-over-time', period],
    queryFn: () => dashboardService.getAIUsageOverTime(period),
    staleTime: 60000,
  })

  const { data: aiAnalytics, isLoading: aiAnalyticsLoading } = useQuery({
    queryKey: ['analytics-ai'],
    queryFn: () => dashboardService.getAnalytics(),
    staleTime: 60000,
  })

  const projectPieData = useMemo(() => {
    if (!byStatus?.projects) return []
    return byStatus.projects
      .filter((p) => p.count > 0)
      .map((p, i) => ({
        name: p.status.charAt(0).toUpperCase() + p.status.slice(1),
        value: p.count,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [byStatus?.projects])

  const quotePieData = useMemo(() => {
    if (!byStatus?.quotes) return []
    return byStatus.quotes
      .filter((q) => q.count > 0)
      .map((q, i) => ({
        name: q.status.charAt(0).toUpperCase() + q.status.slice(1),
        value: q.count,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [byStatus?.quotes])

  const activityOutcomePieData = useMemo(() => {
    if (!activitySummary?.outcome_breakdown) return []
    return activitySummary.outcome_breakdown
      .filter((o) => o.count > 0)
      .map((o) => ({
        name: o.outcome.charAt(0).toUpperCase() + o.outcome.slice(1),
        value: o.count,
        fill: o.outcome === 'success' ? '#059669' : '#dc2626',
      }))
  }, [activitySummary?.outcome_breakdown])

  const userRolePieData = useMemo(() => {
    if (!userStats?.role_distribution) return []
    return userStats.role_distribution
      .filter((r) => r.count > 0)
      .map((r, i) => ({
        name: r.role.replace('_', ' '),
        value: r.count,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [userStats?.role_distribution])

  const modelMixPieData = useMemo(() => {
    if (!aiAnalytics?.models) return []
    return aiAnalytics.models
      .filter((m) => m.total_tokens > 0 || m.quote_count > 0)
      .map((m, i) => ({
        name: m.model_id.split('/').pop() ?? m.model_id,
        value: m.total_tokens,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
  }, [aiAnalytics?.models])

  const isLoading =
    byStatusLoading ||
    projectsOverTimeLoading ||
    quotesOverTimeLoading ||
    activityLoading ||
    userStatsLoading ||
    aiUsageLoading ||
    aiAnalyticsLoading

  const handleExport = () => {
    const rows: string[][] = []
    rows.push(['Estimate AI Analytics Export', '', ''])
    rows.push(['Period', period, ''])
    rows.push(['Generated', new Date().toISOString(), ''])
    rows.push([])
    if (byStatus) {
      rows.push(['Project Status', ''])
      rows.push(['Status', 'Count'])
      byStatus.projects.forEach((p) => rows.push([p.status, String(p.count)]))
      rows.push([])
      rows.push(['Quote Status', ''])
      rows.push(['Status', 'Count'])
      byStatus.quotes.forEach((q) => rows.push([q.status, String(q.count)]))
      rows.push([])
    }
    if (projectsOverTime?.length) {
      rows.push(['Projects Over Time', ''])
      rows.push(['Date', 'Count'])
      projectsOverTime.forEach((r) => rows.push([r.date, String(r.count)]))
      rows.push([])
    }
    if (quotesOverTime?.length) {
      rows.push(['Quotes Over Time', ''])
      rows.push(['Date', 'Count', 'Total Hours'])
      quotesOverTime.forEach((r) => rows.push([r.date, String(r.count), String(r.total_hours)]))
      rows.push([])
    }
    if (activitySummary?.action_breakdown?.length) {
      rows.push(['Top Actions', ''])
      rows.push(['Action', 'Count'])
      activitySummary.action_breakdown.forEach((a) => rows.push([a.action, String(a.count)]))
      rows.push([])
    }
    if (aiUsageOverTime?.length) {
      rows.push(['AI Usage Over Time', ''])
      rows.push(['Date', 'Tokens', 'Cost (USD)'])
      aiUsageOverTime.forEach((r) => rows.push([r.date, String(r.tokens), String(r.cost)]))
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadCSV(`analytics-export-${period}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <div className="user-management-page">
      {/* Page header - shared User Management structure for consistency */}
      <div className="user-management-header">
        <div className="user-management-header-left">
          <h1 className="user-management-title">Analytics</h1>
          <p className="user-management-subtitle">
            Transparent insights into projects, quotes, activity, and AI usage.
          </p>
        </div>
        <Button
          className="user-management-add-btn"
          onClick={handleExport}
          disabled={isLoading}
        >
          <Download className="icon-sm" />
          Export CSV
        </Button>
      </div>

      {/* Controls card - same structure as User Management (tabs + filters) */}
      <div className="user-management-card">
        <div className="user-management-tabs">
          <button
            type="button"
            className="user-management-tab active"
            aria-current="page"
          >
            Overview
          </button>
        </div>
        <div className="user-management-filters">
          <div className="user-management-filter-dropdown">
            <Calendar className="filter-icon" />
            <select
              id="analytics-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
              className="user-management-filter-select"
              aria-label="Time period"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <ChevronRight className="filter-chevron" style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>
      </div>

      {/* Content area - same wrapper as User Management */}
      <div className="user-management-content">
      <motion.div
        className="admin-analytics-kpis"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[
          {
            label: 'Total Projects',
            value: stats?.total_projects ?? '—',
            sub: `${stats?.active_projects ?? '—'} active`,
            icon: FolderOpen,
            color: 'primary',
          },
          {
            label: 'Total Quotes',
            value: stats?.total_quotes ?? '—',
            sub: `${stats?.pending_quotes ?? '—'} pending`,
            icon: FileText,
            color: 'emerald',
          },
          {
            label: 'Hours Estimated',
            value: stats?.total_hours_estimated != null ? `${stats.total_hours_estimated}h` : '—',
            sub: 'All time',
            icon: TrendingUp,
            color: 'amber',
          },
          {
            label: 'AI Tokens',
            value: aiAnalytics?.total_tokens_all_time != null
              ? (aiAnalytics.total_tokens_all_time / 1000).toFixed(1) + 'k'
              : '—',
            sub: 'Total usage',
            icon: Sparkles,
            color: 'violet',
          },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} variants={itemVariants}>
            <Card className={`admin-analytics-kpi admin-analytics-kpi-${kpi.color}`}>
              <div className="admin-analytics-kpi-icon">
                <kpi.icon style={{ width: 22, height: 22 }} />
              </div>
              <div className="admin-analytics-kpi-content">
                <span className="admin-analytics-kpi-value">{kpi.value}</span>
                <span className="admin-analytics-kpi-label">{kpi.label}</span>
                <span className="admin-analytics-kpi-sub">{kpi.sub}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="admin-analytics-loading">
          <span>Loading analytics…</span>
        </div>
      ) : (
        <motion.div
          className="admin-analytics-sections"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Projects & Quotes */}
          <section className="admin-analytics-section">
            <div className="admin-analytics-section-header">
              <h2 className="admin-analytics-section-title">
                Projects & Quotes
              </h2>
              <Link to="/projects" className="admin-analytics-section-link">
                View projects <ExternalLink style={{ width: 14, height: 14 }} />
              </Link>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-2">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card">
                  <h3 className="admin-analytics-card-title">Project status</h3>
                  {projectPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={projectPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {projectPieData.map((_, index) => (
                            <Cell key={index} fill={projectPieData[index].fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'Projects']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No project data</p>
                  )}
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card">
                  <h3 className="admin-analytics-card-title">Quote status</h3>
                  {quotePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={quotePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {quotePieData.map((_, index) => (
                            <Cell key={index} fill={quotePieData[index].fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'Quotes']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No quote data</p>
                  )}
                </Card>
              </motion.div>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-1">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card admin-analytics-card-wide">
                  <h3 className="admin-analytics-card-title">Projects created over time</h3>
                  {projectsOverTime && projectsOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={projectsOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-gray-400)" />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} stroke="var(--color-gray-400)" domain={COMPACT_DOMAIN} />
                        <Tooltip
                          formatter={(v: number | undefined) => [v ?? 0, 'Projects']}
                          labelFormatter={(l) => `Date: ${l}`}
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="var(--color-primary-500)"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          name="Projects"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No projects in this period</p>
                  )}
                </Card>
              </motion.div>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-1">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card admin-analytics-card-wide">
                  <h3 className="admin-analytics-card-title">Quotes & hours estimated over time</h3>
                  {quotesOverTime && quotesOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={quotesOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="analytics-hours-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary-400)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-gray-400)" />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} stroke="var(--color-gray-400)" domain={COMPACT_DOMAIN} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} stroke="var(--color-gray-400)" domain={COMPACT_DOMAIN} />
                        <Tooltip
                          formatter={(v: number | undefined, n?: string) => [v ?? 0, n === 'count' ? 'Quotes' : 'Hours']}
                          labelFormatter={(l) => `Date: ${l}`}
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="count"
                          stroke="var(--color-primary-500)"
                          fill="url(#analytics-hours-grad)"
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
                    <p className="admin-analytics-empty">No quotes in this period</p>
                  )}
                </Card>
              </motion.div>
            </div>
          </section>

          {/* Activity & Users */}
          <section className="admin-analytics-section">
            <div className="admin-analytics-section-header">
              <h2 className="admin-analytics-section-title">
                Activity & Users
              </h2>
              <div className="admin-analytics-section-links">
                <Link to="/admin/logs" className="admin-analytics-section-link">
                  Activity logs
                </Link>
                <Link to="/admin/users" className="admin-analytics-section-link">
                  Manage users
                </Link>
              </div>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-2">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card admin-analytics-card-wide">
                  <h3 className="admin-analytics-card-title">Activity over time</h3>
                  {activitySummary?.timeline && activitySummary.timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={activitySummary.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-gray-400)" />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} stroke="var(--color-gray-400)" domain={COMPACT_DOMAIN} />
                        <Tooltip
                          formatter={(v: number | undefined) => [v ?? 0, 'Actions']}
                          labelFormatter={(l) => `Date: ${l}`}
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#0891b2"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          name="Actions"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No activity in this period</p>
                  )}
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card">
                  <h3 className="admin-analytics-card-title">Top actions</h3>
                  {activitySummary?.action_breakdown && activitySummary.action_breakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={activitySummary.action_breakdown}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 90, bottom: 4 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-gray-400)" />
                        <YAxis type="category" dataKey="action" width={85} tick={{ fontSize: 11 }} stroke="var(--color-gray-400)" />
                        <Tooltip
                          formatter={(v: number | undefined) => [v ?? 0, 'Count']}
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                        />
                        <Bar dataKey="count" fill="var(--color-primary-500)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No action data</p>
                  )}
                </Card>
              </motion.div>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-2">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card">
                  <h3 className="admin-analytics-card-title">Success vs failure</h3>
                  {activityOutcomePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={activityOutcomePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {activityOutcomePieData.map((_, index) => (
                            <Cell key={index} fill={activityOutcomePieData[index].fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'Actions']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No outcome data</p>
                  )}
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card">
                  <h3 className="admin-analytics-card-title">User role distribution</h3>
                  {userRolePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={userRolePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {userRolePieData.map((_, index) => (
                            <Cell key={index} fill={userRolePieData[index].fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [v ?? 0, 'Users']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No user data</p>
                  )}
                </Card>
              </motion.div>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-1">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card admin-analytics-card-wide">
                  <h3 className="admin-analytics-card-title">Most active users (30d)</h3>
                  {userStats?.most_active_users && userStats.most_active_users.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={userStats.most_active_users.map((u) => ({
                          name: u.full_name || u.email,
                          count: u.activity_count,
                        }))}
                        margin={{ top: 4, right: 8, left: 0, bottom: 24 }}
                      >
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          angle={-18}
                          textAnchor="end"
                          height={56}
                          stroke="var(--color-gray-400)"
                        />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} stroke="var(--color-gray-400)" domain={COMPACT_DOMAIN} />
                        <Tooltip
                          formatter={(v: number | undefined) => [v ?? 0, 'Actions']}
                          contentStyle={{ borderRadius: 8, border: '1px solid var(--color-gray-200)' }}
                        />
                        <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">No activity data</p>
                  )}
                </Card>
              </motion.div>
            </div>
          </section>

          {/* AI Performance */}
          <section className="admin-analytics-section">
            <div className="admin-analytics-section-header">
              <h2 className="admin-analytics-section-title">
                AI Performance
              </h2>
            </div>
            <div className="admin-analytics-cards-grid admin-analytics-cards-2">
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card admin-analytics-card-wide">
                  <h3 className="admin-analytics-card-title">Token usage & cost over time</h3>
                  {aiUsageOverTime && aiUsageOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={aiUsageOverTime} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="analytics-tokens-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-gray-400)" />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} stroke="var(--color-gray-400)" domain={COMPACT_DOMAIN} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => `$${v.toFixed(4)}`}
                          stroke="var(--color-gray-400)"
                          domain={COMPACT_DOMAIN}
                        />
                        <Tooltip
                          formatter={(v: number | undefined, n?: string) => [
                            n === 'tokens' ? (v ?? 0).toLocaleString() : `$${(v ?? 0).toFixed(4)}`,
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
                          fill="url(#analytics-tokens-grad)"
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
                    <p className="admin-analytics-empty">No AI usage in this period</p>
                  )}
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="admin-analytics-card">
                  <h3 className="admin-analytics-card-title">Model usage (by tokens)</h3>
                  {modelMixPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={modelMixPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {modelMixPieData.map((_, index) => (
                            <Cell key={index} fill={modelMixPieData[index].fill} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), 'Tokens']} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="admin-analytics-empty">Generate quotes to see model usage</p>
                  )}
                </Card>
              </motion.div>
            </div>
          </section>
        </motion.div>
      )}
      </div>
    </div>
  )
}
