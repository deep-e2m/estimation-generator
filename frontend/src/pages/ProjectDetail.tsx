/**
 * ProjectDetail Page
 * Display project information with estimate generation
 *
 * STRICT WORKFLOW:
 * - Project details auto-passed to chat context (no re-entry)
 * - AI auto-initiates estimate generation (no greetings)
 * - Single estimate per project (no regeneration)
 * - Hours-only estimates (NO pricing/cost)
 * - Only "Edit in Editor" and "Approve" actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FolderOpen,
  Calculator,
  Settings,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit2,
  MoreVertical,
  Archive,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { projectsService, quotesService } from '@/services';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EstimateChat } from '@/components/estimate';
import type { Project, QuoteSummary, ProjectStatus } from '@/types';
import type { Quote } from '@/types/quote.types';
import '@/styles/projects.css';

// Tab types - Only 2 tabs now: Estimate and Settings
type TabId = 'estimate' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'estimate', label: 'Estimate', icon: Calculator },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Status badge variants
function getStatusBadgeVariant(status: ProjectStatus): 'default' | 'success' | 'secondary' {
  const variants: Record<ProjectStatus, 'default' | 'success' | 'secondary'> = {
    active: 'default',
    completed: 'success',
    archived: 'secondary',
  };
  return variants[status] || 'secondary';
}

/**
 * Project Header Component
 */
interface ProjectHeaderProps {
  project: Project;
  onEdit: () => void;
}

function ProjectHeader({ project, onEdit }: ProjectHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="project-detail-header">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100 shrink-0">
          <FolderOpen className="h-7 w-7 text-primary-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {project.name}
            </h1>
            <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
              {project.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            {project.platform && (
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                {project.platform}
              </span>
            )}
            <span>Created {formatDate(project.created_at)}</span>
          </div>
          {project.description && (
            <p className="text-gray-600 mt-2 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          leftIcon={<Edit2 className="h-4 w-4" />}
        >
          Edit
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <CheckCircle className="h-4 w-4" />
                  Mark as Completed
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Archive className="h-4 w-4" />
                  Archive Project
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 transition-colors">
                  <Trash2 className="h-4 w-4" />
                  Delete Project
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Navigation Component
 */
interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasEstimate: boolean;
}

function TabNavigation({ activeTab, onTabChange, hasEstimate }: TabNavigationProps) {
  return (
    <div className="project-tabs">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'project-tab',
            activeTab === id && 'project-tab-active'
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
          {id === 'estimate' && hasEstimate && (
            <span className="ml-2 flex h-2 w-2 rounded-full bg-success-500" />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Estimate Tab Content - Uses EstimateChat component
 */
interface EstimateTabProps {
  project: Project;
  existingEstimate: Quote | null;
  onEstimateGenerated: (quote: Quote) => void;
}

function EstimateTab({ project, existingEstimate, onEstimateGenerated }: EstimateTabProps) {
  return (
    <div className="project-estimate-container h-[calc(100vh-280px)] min-h-[500px]">
      <EstimateChat
        project={project}
        existingEstimate={existingEstimate}
        onEstimateGenerated={onEstimateGenerated}
      />
    </div>
  );
}

/**
 * Settings Tab Content
 */
interface SettingsTabProps {
  project: Project;
  onUpdate: (data: Partial<Project>) => void;
}

function SettingsTab({ project, onUpdate }: SettingsTabProps) {
  return (
    <div className="project-settings-container">
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Project Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Project Name</label>
                <p className="mt-1 text-gray-900">{project.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1">
                  <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
                    {project.status}
                  </Badge>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Platform</label>
                <p className="mt-1 text-gray-900">{project.platform || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-gray-900">{formatDate(project.created_at)}</p>
              </div>
            </div>

            {/* Description */}
            {project.description && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{project.description}</p>
              </div>
            )}

            {/* Owner Info */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Project Owner</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                  {project.owner.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{project.owner.full_name}</p>
                  <p className="text-sm text-gray-500">{project.owner.email}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Loading Skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-start gap-4 mb-6">
        <div className="h-14 w-14 bg-gray-200 rounded-xl" />
        <div className="flex-1">
          <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="h-12 w-96 bg-gray-100 rounded-lg mb-6" />
      <div className="h-96 bg-gray-50 rounded-lg" />
    </div>
  );
}

/**
 * Main ProjectDetail Page Component
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [project, setProject] = useState<Project | null>(null);
  const [existingEstimate, setExistingEstimate] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEstimateLoading, setIsEstimateLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get active tab from URL - default to 'estimate' (previously 'chat')
  const urlTab = searchParams.get('tab');
  const activeTab: TabId = (urlTab === 'settings' ? 'settings' : 'estimate');

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

  // Load existing estimate for the project (enforces single estimate rule)
  useEffect(() => {
    if (!id) return;

    const loadExistingEstimate = async () => {
      try {
        setIsEstimateLoading(true);
        const response = await quotesService.listByProject(id);
        const quotes = response?.data || [];

        // Get the first (and should be only) estimate
        if (quotes.length > 0) {
          // Fetch full quote details
          const fullQuote = await quotesService.get(quotes[0].id);
          setExistingEstimate(fullQuote as unknown as Quote);
        }
      } catch (err) {
        console.error('Failed to load estimate:', err);
      } finally {
        setIsEstimateLoading(false);
      }
    };

    loadExistingEstimate();
  }, [id]);

  // Handlers
  const handleTabChange = useCallback(
    (tab: TabId) => {
      setSearchParams({ tab });
    },
    [setSearchParams]
  );

  const handleEdit = useCallback(() => {
    // TODO: Navigate to edit page or open edit modal
    console.log('Edit project');
  }, []);

  // Handle estimate generated
  const handleEstimateGenerated = useCallback((quote: Quote) => {
    setExistingEstimate(quote);
  }, []);

  const handleUpdateProject = useCallback((data: Partial<Project>) => {
    // TODO: Implement project update
    console.log('Update project:', data);
  }, []);

  if (!id) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500">Invalid project ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="project-detail-page">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-detail-page">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-100 mb-4">
            <AlertCircle className="h-8 w-8 text-error-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load project</h3>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-detail-page">
      {/* Back Button */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Project Header */}
      <ProjectHeader project={project} onEdit={handleEdit} />

      {/* Tab Navigation */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasEstimate={!!existingEstimate}
      />

      {/* Tab Content */}
      <div className="project-tab-content">
        {activeTab === 'estimate' && !isEstimateLoading && (
          <EstimateTab
            project={project}
            existingEstimate={existingEstimate}
            onEstimateGenerated={handleEstimateGenerated}
          />
        )}
        {activeTab === 'estimate' && isEstimateLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        )}
        {activeTab === 'settings' && (
          <SettingsTab project={project} onUpdate={handleUpdateProject} />
        )}
      </div>
    </div>
  );
}

export default ProjectDetailPage;
