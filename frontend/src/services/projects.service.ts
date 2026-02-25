/**
 * Projects API Service
 * Handles all project-related API calls
 */

import { apiClient, LONG_REQUEST_TIMEOUT_MS } from './api';
import type {
  ApiResponse,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListResponse,
  ProjectFilters,
  CheckContentQualityRequest,
  CheckContentQualityResponse,
  ReferenceUrlPreviewData,
  ReferenceUrlSitePreviewData,
} from '@/types';

// Build query params from filters (page-based pagination)
function buildProjectQueryParams(
  filters?: ProjectFilters,
  page: number = 1,
  limit: number = 20
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.platform) params.append('platform', filters.platform);
  if (filters?.sort_by) params.append('sort_by', filters.sort_by);
  if (filters?.sort_order) params.append('sort_order', filters.sort_order);
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  return params;
}

export const projectsService = {
  /**
   * Get list of projects with optional filtering and page-based pagination
   */
  list: async (
    filters?: ProjectFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<ProjectListResponse> => {
    const params = buildProjectQueryParams(filters, page, limit);
    const response = await apiClient.get<ApiResponse<ProjectListResponse>>(
      `/api/v1/projects?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get a single project by ID
   */
  get: async (projectId: string): Promise<Project> => {
    const response = await apiClient.get<ApiResponse<Project>>(
      `/api/v1/projects/${projectId}`
    );
    return response.data.data;
  },

  /**
   * Check project content quality (name, description, additional instructions)
   * before creation. Returns whether content is sufficient for estimation and per-field feedback.
   */
  checkContentQuality: async (
    data: CheckContentQualityRequest
  ): Promise<CheckContentQualityResponse['data']> => {
    const response = await apiClient.post<ApiResponse<CheckContentQualityResponse['data']>>(
      '/api/v1/projects/check-content-quality',
      data,
      { timeout: LONG_REQUEST_TIMEOUT_MS }
    );
    return response.data.data;
  },

  /**
   * Preview scraped content for a reference URL (screenshot + extracted text used for estimation).
   */
  getReferenceUrlPreview: async (
    projectId: string,
    url: string
  ): Promise<ReferenceUrlPreviewData> => {
    const params = new URLSearchParams({ url });
    const response = await apiClient.get<ApiResponse<ReferenceUrlPreviewData>>(
      `/api/v1/projects/${projectId}/reference-url-preview?${params.toString()}`,
      { timeout: 60_000 }
    );
    return response.data.data;
  },

  /**
   * Preview full site: crawl same-host pages from seed URL, then scrape each page (screenshot + text).
   * Returns one screenshot and extracted text per page. May take 1–3 minutes for many pages.
   */
  getReferenceUrlSitePreview: async (
    projectId: string,
    url: string
  ): Promise<ReferenceUrlSitePreviewData> => {
    const params = new URLSearchParams({ url });
    const response = await apiClient.get<ApiResponse<ReferenceUrlSitePreviewData>>(
      `/api/v1/projects/${projectId}/reference-url-site-preview?${params.toString()}`,
      { timeout: 300_000 }
    );
    return response.data.data;
  },

  /**
   * Create a new project
   */
  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await apiClient.post<ApiResponse<Project>>(
      '/api/v1/projects',
      data
    );
    return response.data.data;
  },

  /**
   * Update an existing project
   */
  update: async (projectId: string, data: ProjectUpdate): Promise<Project> => {
    const response = await apiClient.put<ApiResponse<Project>>(
      `/api/v1/projects/${projectId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a project
   */
  delete: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${projectId}`);
  },

  /**
   * Archive a project
   */
  archive: async (projectId: string): Promise<Project> => {
    return projectsService.update(projectId, { status: 'archived' });
  },

  /**
   * Complete a project
   */
  complete: async (projectId: string): Promise<Project> => {
    return projectsService.update(projectId, { status: 'completed' });
  },

  /**
   * Reactivate an archived project
   */
  reactivate: async (projectId: string): Promise<Project> => {
    return projectsService.update(projectId, { status: 'active' });
  },
};

export default projectsService;
