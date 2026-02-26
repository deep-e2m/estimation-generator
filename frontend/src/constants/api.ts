/**
 * Timeout for long-running API requests (AI generation, refinement, export).
 * 5 minutes to accommodate ref URL scraping + RAG + LLM (quote + optional stack research).
 * Backend may take 2–4 minutes; avoid frontend timeout before completion.
 */
export const LONG_REQUEST_TIMEOUT_MS = 300000;
