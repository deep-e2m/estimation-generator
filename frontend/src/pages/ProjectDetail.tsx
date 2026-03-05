/**
 * ProjectDetail Page
 * Display project information with estimate generation
 *
 * FIXED LAYOUT:
 * - Compact header bar with back, project name, badge, search
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
  Clock,
  FileText,
  CheckCircle2,
  Calendar,
  ListChecks,
  Link2,
  Eye,
  Share2,
  Send,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { parseTotalHoursFromContent, parseRequirementsCountFromContent } from '@/lib/quote-content-parse';
import { apiClient, getErrorMessage, projectsService, quotesService } from '@/services';
import { useCanShareProject } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { ShareProjectDialog } from '@/components/project/ShareProjectDialog';
import { SendForApprovalDialog } from '@/components/approval/SendForApprovalDialog';
import { ProjectSharesList } from '@/components/project/ProjectSharesList';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui';
import { EstimateChat } from '@/components/estimate/EstimateChat';
import type {
  Project,
  ProjectStatus,
  ReferenceUrlPreviewData,
  ReferenceUrlSitePreviewData,
} from '@/types';
import { canEditEstimation, canShareProject } from '@/types/project';
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Description expand/collapse state
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionOverflowing, setIsDescriptionOverflowing] = useState(false);
  const [showReferenceUrlsList, setShowReferenceUrlsList] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReferenceUrlPreviewData | null>(null);
  const [previewSiteData, setPreviewSiteData] = useState<ReferenceUrlSitePreviewData | null>(null);
  const [previewMode, setPreviewMode] = useState<'page' | 'site'>('page');
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVideoBlobUrl, setPreviewVideoBlobUrl] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const saveStatusResetTimeoutRef = useRef<number | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sendApprovalDialogOpen, setSendApprovalDialogOpen] = useState(false);
  const canShareRole = useCanShareProject();
  // Show Share/Send approval only when user has edit_full (owner or admin) on this project
  const canShareThisProject =
    project?.my_access_level !== undefined
      ? canShareProject(project.my_access_level)
      : canShareRole;
  const canEditEstimationOnProject = canEditEstimation(project?.my_access_level);

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

  // Handle save status changes coming from the estimation editor (autosave)
  const handleSaveStatusChange = useCallback((status: 'idle' | 'saving' | 'saved') => {
    setSaveStatus(status);

    // When a save has just completed, briefly show the green tick before
    // returning to the normal "x minutes ago" relative time.
    if (status === 'saved') {
      if (saveStatusResetTimeoutRef.current) {
        window.clearTimeout(saveStatusResetTimeoutRef.current);
      }
      saveStatusResetTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
        saveStatusResetTimeoutRef.current = null;
      }, 2000);
    }
  }, []);

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
  const isSaving = saveStatus === 'saving';
  const isSaved = saveStatus === 'saved';

  const lastUpdatedLabel = isSaving
    ? 'Syncing...'
    : isSaved
    ? 'Saved'
    : formatRelativeTime(lastUpdated);

  const lastUpdatedIcon = isSaving ? (
    <Loader2 style={{ width: 14, height: 14, color: '#f97316' }} className="animate-spin" />
  ) : isSaved ? (
    <CheckCircle2 style={{ width: 14, height: 14, color: '#16a34a' }} />
  ) : (
    <FileText style={{ width: 14, height: 14 }} />
  );

  const referenceUrlsUsed = (quote?.metadata as { reference_urls_used?: string[] } | undefined)
    ?.reference_urls_used;
  // Show project's saved reference URLs (e.g. Figma) when set; otherwise URLs used in last quote
  const referenceUrlsToShow = (project?.reference_urls?.length
    ? project.reference_urls
    : referenceUrlsUsed) ?? [];
  const referenceUrlsCount = referenceUrlsToShow.length;

  const openUrlPreview = useCallback(
    (url: string, mode: 'page' | 'site' = 'page') => {
      if (!id) return;
      setPreviewUrl(url);
      setPreviewMode(mode);
      setPreviewOpen(true);
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewData(null);
      setPreviewSiteData(null);
      setPreviewPageIndex(0);
      if (mode === 'site') {
        projectsService
          .getReferenceUrlSitePreview(id, url)
          .then((data) => {
            setPreviewSiteData(data);
            setPreviewLoading(false);
          })
          .catch((err: unknown) => {
            setPreviewError(getErrorMessage(err) || 'Failed to crawl and scrape site');
            setPreviewLoading(false);
          });
      } else {
        projectsService
          .getReferenceUrlPreview(id, url)
          .then((data) => {
            setPreviewData(data);
            setPreviewLoading(false);
          })
          .catch((err: unknown) => {
            setPreviewError(getErrorMessage(err) || 'Failed to load scraped content');
            setPreviewLoading(false);
          });
      }
    },
    [id]
  );

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewUrl(null);
    setPreviewData(null);
    setPreviewSiteData(null);
    setPreviewError(null);
    setPreviewPageIndex(0);
    setPreviewVideoBlobUrl(null);
  }, []);

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
      value: lastUpdatedLabel,
      icon: lastUpdatedIcon,
      iconClass: 'updated',
    },
    // Always show Reference URLs pill so users see where scraped URLs appear (from description/documents)
    {
      label: 'Reference URLs',
      value:
        referenceUrlsCount === 0
          ? '0 links'
          : referenceUrlsCount === 1
            ? '1 link'
            : `${referenceUrlsCount} links`,
      icon: <Link2 style={{ width: 14, height: 14 }} />,
      iconClass: 'urls' as const,
      ...(referenceUrlsCount > 0 && referenceUrlsToShow.length > 0
        ? { urls: referenceUrlsToShow }
        : {}),
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
        {canShareThisProject && id && (
          <div className="project-detail-header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)} leftIcon={<Share2 style={{ width: 16, height: 16 }} />}>
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSendApprovalDialogOpen(true)} leftIcon={<Send style={{ width: 16, height: 16 }} />}>
              Send for approval
            </Button>
          </div>
        )}
      </header>

      {canShareThisProject && id && (
        <>
          <ShareProjectDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} projectId={id} />
          <SendForApprovalDialog open={sendApprovalDialogOpen} onOpenChange={setSendApprovalDialogOpen} projectId={id} />
        </>
      )}

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
          <div className="project-detail-stat-pills-wrapper">
            <div className="project-detail-stat-pills">
              {statCardsData.map((card, index) => {
                const hasUrls = 'urls' in card && Array.isArray(card.urls);
                const pill = (
                  <div
                    className={`project-detail-stat-pill ${hasUrls ? 'project-detail-stat-pill-clickable' : ''}`}
                    role={hasUrls ? 'button' : undefined}
                    tabIndex={hasUrls ? 0 : undefined}
                    onClick={hasUrls ? () => setShowReferenceUrlsList((v) => !v) : undefined}
                    onKeyDown={
                      hasUrls
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setShowReferenceUrlsList((v) => !v);
                            }
                          }
                        : undefined}
                  >
                    <span className={`project-detail-stat-pill-icon ${card.iconClass}`}>
                      {card.icon}
                    </span>
                    <span className="project-detail-stat-pill-label">{card.label}:</span>
                    <span className="project-detail-stat-pill-value">{card.value}</span>
                  </div>
                );
                return (
                  <React.Fragment key={card.label}>
                    {index > 0 && <span className="project-detail-stat-pill-separator" />}
                    {pill}
                  </React.Fragment>
                );
              })}
            </div>
            {referenceUrlsCount > 0 && showReferenceUrlsList && referenceUrlsToShow.length > 0 && (
              <>
                <div className="project-detail-reference-urls-list">
                  {referenceUrlsToShow.map((url: string) => (
                    <div key={url} className="project-detail-reference-url-item-row">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-detail-reference-url-item"
                      >
                        {url}
                      </a>
                      <button
                        type="button"
                        className="project-detail-reference-url-preview-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          openUrlPreview(url, 'site');
                        }}
                        aria-label={`View full site asset for ${url} (crawl, screenshots, scraped content, video)`}
                        title="Preview full site (crawl, screenshots, content, video)"
                      >
                        <Eye style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {canShareThisProject && id && (
          <div className="project-detail-sharing-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-gray-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="project-detail-description-label">Shared with</span>
              <Button variant="ghost" size="sm" onClick={() => setShareDialogOpen(true)}>
                Share with someone
              </Button>
            </div>
            <ProjectSharesList projectId={id} />
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
            onSaveStatusChange={handleSaveStatusChange}
            referenceUrls={project?.reference_urls?.length ? project.reference_urls : (referenceUrlsUsed ?? undefined)}
            crawlSiteFromUrl={(project?.reference_urls ?? referenceUrlsUsed)?.[0]}
            readOnly={!canEditEstimationOnProject}
          />
        )}
      </div>

      {/* Reference URL preview dialog: single page or full site (tabs) */}
      <Dialog open={previewOpen} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent
          className="reference-url-preview-dialog"
          style={{
            maxWidth: '95vw',
            width: 1120,
            maxHeight: '78vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {previewSiteData
                ? `Reference site – ${previewSiteData.pages.length} page${previewSiteData.pages.length !== 1 ? 's' : ''}`
                : 'Reference URL – scraped content'}
            </DialogTitle>
            <DialogDescription>
              {(previewSiteData?.seed_url || previewUrl) && (
                <a
                  href={previewSiteData?.seed_url || previewUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reference-url-preview-link"
                  style={{ wordBreak: 'break-all', fontSize: '0.9rem' }}
                >
                  {previewSiteData?.seed_url || previewUrl}
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="reference-url-preview-body" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {previewLoading && (
              <div className="reference-url-preview-loading" style={{ padding: '2rem', textAlign: 'center' }}>
                <Loader2 style={{ width: 32, height: 32 }} className="animate-spin" />
                <p style={{ marginTop: 12, color: 'var(--color-gray-500)' }}>
                  {previewMode === 'site'
                    ? 'Crawling site, then scraping each page… This may take 1–3 minutes.'
                    : 'Scraping URL…'}
                </p>
              </div>
            )}
            {!previewLoading && previewError && (
              <div className="reference-url-preview-error" style={{ padding: '1rem', color: 'var(--color-error)' }}>
                {previewError}
              </div>
            )}
            {!previewLoading && previewSiteData && previewSiteData.pages.length > 0 && (
              <>
                <div
                  role="tablist"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginBottom: 12,
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 8,
                  }}
                >
                  {previewSiteData.pages.map((page, idx) => {
                    let label = `Page ${idx + 1}`;
                    try {
                      const u = new URL(page.url);
                      label = (u.pathname || '/') + (u.search || '') || label;
                    } catch {
                      // keep Page N
                    }
                    return (
                      <button
                        key={page.url}
                        type="button"
                        role="tab"
                        aria-selected={previewPageIndex === idx}
                        aria-label={`Page ${idx + 1}: ${label}`}
                        onClick={() => setPreviewPageIndex(idx)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: previewPageIndex === idx ? 'var(--color-primary)' : 'var(--color-gray-100)',
                          color: previewPageIndex === idx ? 'white' : 'inherit',
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const page = previewSiteData.pages[previewPageIndex];
                  if (!page) return null;
                  return (
                    <div
                      className="reference-url-preview-columns"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 16,
                        alignItems: 'flex-start',
                        minHeight: 0,
                      }}
                    >
                      <div
                        className="reference-url-preview-screenshot"
                        style={{
                          flex: '1 1 0',
                          minWidth: 0,
                          maxWidth: '50%',
                          maxHeight: '65vh',
                          overflow: 'auto',
                        }}
                      >
                        {page.screenshot_base64 ? (
                          <>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>
                              Screenshot (used for estimation)
                            </p>
                            <img
                              src={`data:image/png;base64,${page.screenshot_base64}`}
                              alt={`Screenshot of ${page.url}`}
                              style={{
                                maxWidth: '100%',
                                height: 'auto',
                                display: 'block',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                              }}
                            />
                          </>
                        ) : page.error ? (
                          <p style={{ color: 'var(--color-warning)' }}>{page.error}</p>
                        ) : null}
                      </div>
                      <div
                        className="reference-url-preview-text"
                        style={{ flex: '1 1 0', minWidth: 0, maxWidth: '50%' }}
                      >
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>
                          Extracted text (used for estimation)
                        </p>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: 280,
                            overflow: 'auto',
                            padding: 12,
                            background: 'var(--color-gray-100)',
                            borderRadius: 8,
                            fontSize: '0.8rem',
                          }}
                        >
                          {page.extracted_text || '(No text extracted)'}
                        </pre>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {!previewLoading && previewData && !previewSiteData && (
              <div
                className="reference-url-preview-columns"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 16,
                  alignItems: 'flex-start',
                  minHeight: 0,
                }}
              >
                <div
                  className="reference-url-preview-screenshot"
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    maxWidth: '50%',
                    maxHeight: '65vh',
                    overflow: 'auto',
                  }}
                >
                  {previewData.screenshot_base64 ? (
                    <>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>
                        Screenshot (used for estimation)
                      </p>
                      <img
                        src={`data:image/png;base64,${previewData.screenshot_base64}`}
                        alt="Screenshot of reference URL"
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block',
                          borderRadius: 8,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                    </>
                  ) : previewData.error ? (
                    <p style={{ color: 'var(--color-warning)' }}>{previewData.error}</p>
                  ) : null}
                </div>
                <div
                  className="reference-url-preview-text"
                  style={{ flex: '1 1 0', minWidth: 0, maxWidth: '50%' }}
                >
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>
                    Extracted text (used for estimation)
                  </p>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 320,
                      overflow: 'auto',
                      padding: 12,
                      background: 'var(--color-gray-100)',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                    }}
                  >
                    {previewData.extracted_text || '(No text extracted)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectDetailPage;
