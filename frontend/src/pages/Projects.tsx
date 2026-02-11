/**
 * Projects Page
 * List all projects in a vertical list format with filtering and search
 *
 * Features:
 * - Project rows with summary info
 * - Search and filter controls
 * - Create new project button
 * - Pagination support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { projectsService } from '@/services';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { ProjectSummary, ProjectStatus, ProjectFilters, ProjectPlatform } from '@/types';
import '@/styles/projects.css';

// Status badge variants
function getStatusBadgeVariant(status: ProjectStatus): 'default' | 'success' | 'secondary' {
  const variants: Record<ProjectStatus, 'default' | 'success' | 'secondary'> = {
    active: 'default',
    completed: 'success',
    archived: 'secondary',
  };
  return variants[status] || 'secondary';
}

// Status labels
function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  };
  return labels[status] || status;
}

/**
 * Project Row Component - List view format
 */
interface ProjectRowProps {
  project: ProjectSummary;
  onClick: () => void;
}

function ProjectRow({ project, onClick }: ProjectRowProps) {
  return (
    <div
      className="project-row cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
      onClick={onClick}
    >
      <div className="flex items-center gap-4 px-4 py-4">
        {/* Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 shrink-0">
          <FolderOpen className="h-5 w-5 text-primary-600" />
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
            <Badge variant={getStatusBadgeVariant(project.status)} className="shrink-0">
              {getStatusLabel(project.status)}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {project.description}
            </p>
          )}
        </div>

        {/* Metadata - visible on larger screens */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          {/* Quotes count */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-[80px]">
            <FileText className="h-4 w-4" />
            <span>{project.quotes_count} {project.quotes_count === 1 ? 'quote' : 'quotes'}</span>
          </div>

          {/* Platform */}
          {project.platform && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded min-w-[80px] text-center">
              {project.platform}
            </span>
          )}

          {/* Updated time */}
          <div className="flex items-center gap-1.5 text-sm text-gray-400 min-w-[100px]">
            <Clock className="h-4 w-4" />
            <span>{formatRelativeTime(project.updated_at)}</span>
          </div>
        </div>

        {/* Mobile metadata */}
        <div className="flex sm:hidden items-center gap-2 text-xs text-gray-400 shrink-0">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(project.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no projects exist
 */
interface EmptyStateProps {
  hasFilters: boolean;
  onCreateProject: () => void;
  onClearFilters: () => void;
}

function EmptyState({ hasFilters, onCreateProject, onClearFilters }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-6">
        <FolderOpen className="h-10 w-10 text-gray-400" />
      </div>
      {hasFilters ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No matching projects</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
            Try adjusting your search or filters to find what you're looking for.
          </p>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
            Create your first project to start generating quotes
          </p>
          <Button onClick={onCreateProject} leftIcon={<Plus className="h-4 w-4" />}>
            Create Project
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Loading skeleton - List view format
 */
function LoadingSkeleton() {
  return (
    <div className="projects-list bg-white rounded-lg border border-gray-200">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="animate-pulse border-b border-gray-100 last:border-b-0">
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="h-10 w-10 bg-gray-200 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-64 bg-gray-100 rounded" />
            </div>
            <div className="hidden sm:flex items-center gap-6">
              <div className="h-4 w-16 bg-gray-100 rounded" />
              <div className="h-6 w-20 bg-gray-100 rounded" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Filter dropdown component
 */
interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}

function FilterDropdown({ value, onChange, options, label }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Filter className="h-4 w-4 text-gray-400" />
        <span>{selectedOption?.label || label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg',
                  option.value === value && 'bg-primary-50 text-primary-700 font-medium'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Main Projects Page Component
 */
export function ProjectsPage() {
  const navigate = useNavigate();

  // State
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Filter options
  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
  ];

  // Load projects
  const loadProjects = useCallback(async (resetCursor = true) => {
    try {
      setIsLoading(true);
      setError(null);

      const filters: ProjectFilters = {};
      if (searchQuery) filters.search = searchQuery;
      if (statusFilter) filters.status = statusFilter as ProjectStatus;

      const response = await projectsService.list(
        filters,
        resetCursor ? undefined : cursor || undefined,
        20
      );

      if (resetCursor) {
        setProjects(response.data);
      } else {
        setProjects((prev) => [...prev, ...response.data]);
      }

      setHasMore(response.pagination.has_more);
      setCursor(response.pagination.cursor);
    } catch (err) {
      setError('Failed to load projects. Please try again.');
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, cursor]);

  // Load projects on mount and when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadProjects(true);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, statusFilter]);

  // Handlers
  const handleCreateProject = () => {
    navigate('/projects/new');
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadProjects(false);
    }
  };

  const hasFilters = searchQuery.length > 0 || statusFilter.length > 0;

  return (
    <div className="projects-page">
      {/* Page Header */}
      <div className="projects-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">
            Manage your projects and generate quotes
          </p>
        </div>
        <Button onClick={handleCreateProject} leftIcon={<Plus className="h-4 w-4" />}>
          New Project
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="projects-filters">
        <div className="projects-search">
          <Search className="projects-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="projects-search-input"
          />
        </div>

        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Filter by status"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadProjects(true)}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading && projects.length === 0 ? (
        <LoadingSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onCreateProject={handleCreateProject}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <>
          <div className="projects-list bg-white rounded-lg border border-gray-200 overflow-hidden">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                isLoading={isLoading}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProjectsPage;
