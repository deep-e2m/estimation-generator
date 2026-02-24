# Knowledge base re-ingestion runbook

When you change content that is embedded in the RAG knowledge base, you must re-run ingestion so that quote generation uses the updated text.

## When to re-ingest

- **WordPress stack guidelines**: After editing `WORDPRESS_STACK_GUIDELINES_MD` or the structured company stack in `backend/app/services/ai/static_knowledge.py` (e.g. `COMPANY_STACK_STRUCTURED`, canonical names or disallowed→allowed maps in `stack_enforcement.py`). Company stack context is built from RAG and/or built-in fallback; re-ingesting ensures RAG returns the updated guidelines. When adding new company plugins/themes, consider adding common alternatives to `DISALLOWED_TO_ALLOWED` in `stack_enforcement.py` so quotes that mention them get normalized to the company standard.
- **Estimation guidelines**: After editing `ESTIMATION_GUIDELINES_MD` or other entries in `BUILTIN_KNOWLEDGE_DOCUMENTS`.
- **Training / reference quotes**: After adding or changing training example documents or approved-quote content that should appear as similar projects.

## How to re-ingest

1. Use your existing knowledge-ingestion flow for the affected source type.
2. For **built-in documents** (e.g. `guideline-wordpress-stack`, `guideline-estimation`): run the ingestion script or API that processes `BUILTIN_KNOWLEDGE_DOCUMENTS` from `backend/app/services/ai/static_knowledge.py` and writes to the `knowledge_embeddings` table (or equivalent vector store).
3. For **approved quotes**: Approval already triggers ingestion (see quote status update in `backend/app/api/v1/quotes.py`). No extra step unless you need to backfill or re-embed existing approved quotes.

## Verification

- After re-ingestion, generate a quote for a WordPress project and confirm the prompt’s company stack / estimation rules reflect your edits (e.g. one theme, correct plugin names).
- Check logs for `Company stack context from RAG` to confirm RAG is returning the updated content when applicable.
