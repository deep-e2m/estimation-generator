/**
 * Timeout for long-running API requests (AI generation, refinement, export).
 * 3 minutes to stay above backend LLM_REQUEST_TIMEOUT (default 120s) and allow exports.
 */
export const LONG_REQUEST_TIMEOUT_MS = 180000;
