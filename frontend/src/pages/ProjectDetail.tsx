/**
 * ProjectDetail Page
 * Display project information with estimate generation
 *
 * FIXED LAYOUT:
 * - Compact header bar with back, project name, badge, search, edit
 * - 3 stat cards: Total Hours, Project Status, Complexity
 * - Uses EstimateChat component for actual AI-powered estimation
 * - Handles ?tab=chat query param for auto-generation flow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit2,
  Clock,
  FileText,
  Zap,
  Calendar,
  DollarSign,
  ListChecks,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { projectsService, quotesService } from '@/services';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EstimateChat } from '@/components/estimate/EstimateChat';
import type { Project, ProjectStatus } from '@/types';
import type { Quote } from '@/types/quote.types';

// Status badge variants
function getStatusBadgeVariant(status: ProjectStatus): 'active' | 'success' | 'secondary' {
  const variants: Record<ProjectStatus, 'active' | 'success' | 'secondary'> = {
    active: 'active',
    completed: 'success',
    archived: 'secondary',
  };
  return variants[status] || 'secondary';
}

// Get complexity from requirements count
function getComplexity(count: number): { label: string; level: 'Low' | 'Medium' | 'High' } {
  if (count <= 5) return { label: 'Low', level: 'Low' };
  if (count <= 15) return { label: 'Medium', level: 'Medium' };
  return { label: 'High', level: 'High' };
}

/**
 * Stat Card Component
 */
interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  iconClass: string;
  onClick?: () => void;
}

function StatCard({ label, value, subtext, icon, iconClass, onClick }: StatCardProps) {
  return (
    <motion.div
      className={`project-stat-card ${onClick ? 'clickable' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
    >
      <div className="project-stat-content">
        <span className="project-stat-label">
          {label}
        </span>
        <span className={`project-stat-value ${typeof value === 'string' && value.length > 5 ? 'status' : ''}`}>
          {value}
        </span>
        {subtext && (
          <span className="project-stat-subtext">{subtext}</span>
        )}
      </div>
      <div className={`project-stat-icon ${iconClass}`}>
        {icon}
      </div>
    </motion.div>
  );
}

/**
 * Main ProjectDetail Page Component
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we should auto-start chat/estimation (from NewProject redirect)
  const shouldAutoStartChat = searchParams.get('tab') === 'chat';

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuoteLoading, setIsQuoteLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load project data
  useEffect(() => {
    if (!id) return;

    const loadProject = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const projectData = await projectsService.get(id);
        setProject(projectData);
      } catch (err) {
        setError('Failed to load project. Please try again.');
        console.error('Failed to load project:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [id]);

  // Load existing quote for the project
  useEffect(() => {
    if (!id) return;

    const loadQuote = async () => {
      try {
        setIsQuoteLoading(true);
        const response = await quotesService.listByProject(id);
        const quotes = response?.data || [];

        if (quotes.length > 0) {
          const fullQuote = await quotesService.get(quotes[0].id);
          setQuote(fullQuote as unknown as Quote);
        }
      } catch (err) {
        console.error('Failed to load quote:', err);
      } finally {
        setIsQuoteLoading(false);
      }
    };

    loadQuote();
  }, [id]);

  // Handle estimate generated callback
  const handleEstimateGenerated = useCallback((newQuote: Quote) => {
    setQuote(newQuote);
    // Remove the tab=chat param from URL after generation starts
    if (shouldAutoStartChat) {
      navigate(`/projects/${id}`, { replace: true });
    }
  }, [id, navigate, shouldAutoStartChat]);

  // Calculate stats
  const totalHours = quote?.total_hours ?? quote?.content?.totals?.total_expected_hours ?? 0;
  const totalCost = quote?.total_cost ?? quote?.content?.totals?.total_cost ?? 0;
  const requirementsCount = quote?.content?.deliverables?.length ?? 0;
  const lastUpdated = quote?.updated_at ?? project?.updated_at ?? project?.created_at ?? new Date().toISOString();

  if (!id) {
    return (
      <div className="project-detail-page">
        <div className="project-detail-error">
          <div className="project-detail-error-icon">
            <AlertCircle style={{ width: 32, height: 32 }} />
          </div>
          <h3>Invalid Project</h3>
          <p>No project ID provided.</p>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="project-detail-page">
        <div className="project-detail-loading">
          <Loader2 style={{ width: 40, height: 40 }} className="animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-detail-page">
        <div className="project-detail-error">
          <div className="project-detail-error-icon">
            <AlertCircle style={{ width: 32, height: 32 }} />
          </div>
          <h3>Failed to load project</h3>
          <p>{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-detail-page">
      {/* Header Bar */}
      <header className="project-detail-header">
        <div className="project-detail-header-left">
          <button
            className="project-detail-back"
            onClick={() => navigate('/projects')}
            aria-label="Back to projects"
          >
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </button>
          
          {/* Breadcrumb Navigation */}
          <div className="project-detail-breadcrumb">
            <button 
              onClick={() => navigate('/projects')}
              className="project-detail-breadcrumb-link"
            >
              Projects
            </button>
            <span className="project-detail-breadcrumb-separator">/</span>
            <span className="project-detail-breadcrumb-current">{project.name}</span>
          </div>
        </div>

        <div className="project-detail-header-right">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Edit2 style={{ width: 16, height: 16 }} />}
            onClick={() => navigate(`/projects/${id}/edit`)}
          >
            Edit Project
          </Button>
        </div>
      </header>

      {/* Project Title Section */}
      <div className="project-detail-title-section">
        <div className="project-detail-title-row">
          <h1 className="project-detail-page-title">{project.name}</h1>
          <Badge variant={getStatusBadgeVariant(project.status)}>
            {project.status.toUpperCase()}
          </Badge>
        </div>
        <div className="project-detail-meta">
          {project.platform && (
            <span className="project-detail-platform">{project.platform}</span>
          )}
          <span className="project-detail-meta-item">
            <Calendar style={{ width: 14, height: 14 }} />
            Created {formatDate(project.created_at)}
          </span>
          {project.description && (
            <p className="project-detail-description">{project.description}</p>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="project-stat-cards">
        <StatCard
          label="Total Hours"
          value={totalHours > 0 ? `${totalHours}h` : '—'}
          subtext={totalHours > 0 ? 'Estimated effort' : 'No estimate yet'}
          icon={<Clock style={{ width: 24, height: 24 }} />}
          iconClass="hours"
        />
        <StatCard
          label="Total Cost"
          value={totalCost > 0 ? `$${totalCost.toLocaleString()}` : '—'}
          subtext={totalCost > 0 ? 'Project budget' : 'No cost calculated'}
          icon={<DollarSign style={{ width: 24, height: 24 }} />}
          iconClass="cost"
        />
        <StatCard
          label="Requirements"
          value={requirementsCount > 0 ? requirementsCount : '—'}
          subtext={requirementsCount > 0 ? `${requirementsCount} items` : 'No requirements'}
          icon={<ListChecks style={{ width: 24, height: 24 }} />}
          iconClass="requirements"
        />
        <StatCard
          label="Last Updated"
          value={formatRelativeTime(lastUpdated)}
          subtext={formatDate(lastUpdated)}
          icon={<FileText style={{ width: 24, height: 24 }} />}
          iconClass="updated"
        />
      </div>

      {/* Main Content - EstimateChat handles the full workflow */}
      <div className="project-detail-content">
        {isQuoteLoading ? (
          <div className="project-detail-loading" style={{ minHeight: '400px' }}>
            <Loader2 style={{ width: 32, height: 32 }} className="animate-spin" />
            <p style={{ marginTop: '16px', color: 'var(--color-gray-500)' }}>Loading estimate...</p>
          </div>
        ) : (
          <EstimateChat
            project={project}
            existingEstimate={quote}
            onEstimateGenerated={handleEstimateGenerated}
          />
        )}
      </div>
    </div>
  );
}

export default ProjectDetailPage;
