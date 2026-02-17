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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit2,
  Clock,
  FileText,
  Calendar,
  ListChecks,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { parseTotalHoursFromContent, parseRequirementsCountFromContent } from '@/lib/quote-content-parse';
import { projectsService, quotesService } from '@/services';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EstimateChat } from '@/components/estimate/EstimateChat';
import type { Project, ProjectStatus } from '@/types';
import type { ChangeDescription, Quote, RefinedProjectUpdate } from '@/types/quote.types';

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

  // Description expand/collapse state
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

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

  // Detect if description text overflows 2 lines
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    // scrollHeight > clientHeight means the content exceeds the clamped height
    setIsDescriptionOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [project?.description]);

  // Handle estimate generated / refined callback (refine can also return updated project name/description)
  const handleEstimateGenerated = useCallback(
    (
      newQuote: Quote,
      _changes?: ChangeDescription[],
      updatedProject?: RefinedProjectUpdate | null
    ) => {
      setQuote(newQuote);
      if (updatedProject && project) {
        setProject((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          if (updatedProject.name !== undefined && updatedProject.name !== null) {
            next.name = updatedProject.name;
          }
          if (updatedProject.description !== undefined) {
            next.description = updatedProject.description ?? undefined;
          }
          return next;
        });
      }
      if (shouldAutoStartChat) {
        navigate(`/projects/${id}`, { replace: true });
      }
    },
    [id, navigate, project, shouldAutoStartChat]
  );

  // Calculate stats: use API values first, then parse from quote content so cards stay in sync with the document
  const totalHoursFromApi = quote?.total_hours ?? quote?.content?.totals?.total_expected_hours ?? 0;
  const totalHoursParsed = parseTotalHoursFromContent(quote?.content ?? null);
  const totalHours = totalHoursFromApi > 0 ? totalHoursFromApi : totalHoursParsed;

  // Use requirements_count from project API (stored from quote metadata); fallback to parsing quote content when 0
  const requirementsCount =
    (project?.requirements_count ?? 0) || parseRequirementsCountFromContent(quote?.content ?? null);

  const lastUpdated = quote?.updated_at ?? project?.updated_at ?? project?.created_at ?? new Date().toISOString();

  // Prepare stat cards data for EstimateChat (display hours as integer when whole number)
  const totalHoursDisplay = totalHours > 0 ? (Number.isInteger(totalHours) ? `${totalHours}h` : `${Math.round(totalHours)}h`) : '—';
  const statCardsData = [
    {
      label: 'Total Hours',
      value: totalHoursDisplay,
      subtext: totalHours > 0 ? 'Estimated effort' : 'No estimate yet',
      icon: <Clock style={{ width: 24, height: 24 }} />,
      iconClass: 'hours',
    },
    {
      label: 'Requirements',
      value: requirementsCount > 0 ? requirementsCount : '—',
      icon: <ListChecks style={{ width: 14, height: 14 }} />,
      iconClass: 'requirements',
    },
    {
      label: 'Last Updated',
      value: formatRelativeTime(lastUpdated),
      icon: <FileText style={{ width: 14, height: 14 }} />,
      iconClass: 'updated',
    },
  ];

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

      {/* Project Title Section - Compact Layout */}
      <div className="project-detail-title-section">
        <div className="project-detail-title-row">
          <div className="project-detail-title-left">
            <h1 className="project-detail-page-title">{project.name}</h1>
            <Badge variant={getStatusBadgeVariant(project.status)}>
              {project.status.toUpperCase()}
            </Badge>
          </div>
          <div className="project-detail-title-right">
            {project.platform && (
              <span className="project-detail-platform">{project.platform}</span>
            )}
            <span className="project-detail-meta-item">
              <Calendar style={{ width: 14, height: 14 }} />
              {formatDate(project.created_at)}
            </span>
          </div>
        </div>
        {project.description && (
          <div className="project-detail-description-row">
            <span className="project-detail-description-label">Description</span>
            <div className="project-detail-description-wrapper">
              <p
                ref={descriptionRef}
                className={`project-detail-description ${
                  !isDescriptionExpanded ? 'project-detail-description-clamped' : ''
                }`}
              >
                {project.description}
                {isDescriptionExpanded && (
                  <span
                    className="project-detail-see-more-link"
                    onClick={() => setIsDescriptionExpanded(false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsDescriptionExpanded(false);
                      }
                    }}
                  >
                    {' '}See less
                  </span>
                )}
              </p>
              {!isDescriptionExpanded && isDescriptionOverflowing && (
                <span
                  className="project-detail-see-more-float"
                  onClick={() => setIsDescriptionExpanded(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsDescriptionExpanded(true);
                    }
                  }}
                >
                  ...See more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inline Stat Pills - shown when a quote exists */}
        {quote && (
          <div className="project-detail-stat-pills">
            {statCardsData.map((card, index) => (
              <React.Fragment key={card.label}>
                {index > 0 && <span className="project-detail-stat-pill-separator" />}
                <div className="project-detail-stat-pill">
                  <span className={`project-detail-stat-pill-icon ${card.iconClass}`}>
                    {card.icon}
                  </span>
                  <span className="project-detail-stat-pill-label">{card.label}:</span>
                  <span className="project-detail-stat-pill-value">{card.value}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
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
