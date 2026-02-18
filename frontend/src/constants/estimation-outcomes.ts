/**
 * Estimation outcomes key-value contract (matches backend).
 * Each key is a section id; the editor renders one block per key.
 * prepared_for is omitted: project name is shown in document header only.
 */
export const ESTIMATION_OUTCOMES_KEYS = [
  'project_overview',
  'website_structure',
  'development_approach',
  'estimated_effort_timeline',
  'assumptions',
  'exclusions',
] as const;

export type EstimationOutcomesKey = (typeof ESTIMATION_OUTCOMES_KEYS)[number];

export const ESTIMATION_OUTCOMES_LABELS: Record<string, string> = {
  project_overview: 'Project Overview',
  website_structure: 'Website Structure & Page Scope',
  development_approach: 'Development Approach',
  estimated_effort_timeline: 'Estimated Effort & Timeline',
  assumptions: 'Assumptions & Client Responsibilities',
  exclusions: 'Exclusions',
};
