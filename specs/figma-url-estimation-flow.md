# Figma URL Estimation Flow

This document describes how Figma (and other reference) URLs flow through the system from project creation to quote generation.

## Overview

When a user shares a Figma design link during project creation, the system:

1. **Captures** the URL (explicit field or auto-extracted from description/docs)
2. **Stores** it on the project as `reference_urls`
3. **During quote generation**: scrapes the URL (screenshot + text), runs vision analysis, and includes the result in the project brief for the LLM
4. **Figma-specific**: Uses single-URL scrape only (no site crawl) since Figma designs are single-page

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PROJECT CREATION (NewProject)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│  User enters:                                                                    │
│  • Project name, description, additional inputs                                   │
│  • Reference URLs (Figma, etc.) — optional dedicated field                        │
│  • Supporting files (PDF, DOCX, images)                                           │
│                                                                                  │
│  Backend (POST /api/v1/projects):                                                │
│  • reference_urls = request.reference_urls OR extract_urls(description,          │
│    additional_instructions)                                                       │
│  • Store project.reference_urls in DB                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        QUOTE GENERATION (EstimationGenerationUI)                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Frontend sends: project_context.reference_urls = project.reference_urls          │
│  (or backend uses project.reference_urls when request lacks reference_urls)       │
│                                                                                  │
│  Backend (POST /api/v1/projects/{id}/quotes):                                    │
│  1. explicit_urls = project_context.reference_urls ?? project.reference_urls     │
│  2. build_reference_url_context(..., explicit_urls=explicit_urls)                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     build_reference_url_context()                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  • Determine URLs: explicit_urls + extract from description, instructions, docs  │
│  • Figma detection: URLs with figma.com/design/ or figma.com/file/ → skip crawl  │
│  • For non-Figma: optionally crawl site (SITE_CRAWL_ENABLED)                     │
│  • For Figma: single-URL scrape only (no crawl — Figma is single-page)           │
│  • scrape_urls() → Playwright: screenshot + body text per URL                     │
│  • Vision: LLM analyzes screenshots for design inference (layout, components)    │
│  • Return context block → appended to project brief                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LLM QUOTE GENERATION                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  canonical_brief = project + description + instructions + docs +                  │
│                    "Reference URLs (scraped content and visual description):"     │
│                    + reference_url_context                                        │
│                                                                                  │
│  LLM receives full brief including Figma design description → more accurate       │
│  estimate (layout, components, complexity inferred from design)                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. URL Extraction (`url_extraction.py`)

- Extracts URLs from text (description, instructions, documents)
- Supports `https` (and `http` in dev)
- Max URLs per request: `MAX_REFERENCE_URLS` (default 4)
- Rejects localhost/private IP in production

### 2. URL Scraping (`url_scraping_service.py`)

- Uses Playwright (Chromium) to open each URL
- Captures screenshot + body text
- Fallback: HTTP fetch + BeautifulSoup if Playwright fails
- No Figma API or token required; works with public design links

### 3. Reference URL Context (`reference_url_context.py`)

- `build_reference_url_context()` orchestrates the flow
- **Figma URLs**: Detected by `figma.com/design/` or `figma.com/file/` in URL
- **Figma**: Skip site crawl (single-URL scrape only)
- **Other URLs**: May use site crawl if `SITE_CRAWL_ENABLED` and not Figma
- Vision: `LLMService.analyze_image()` for each screenshot → design inference
- Output: Truncated to `URL_REFERENCE_CONTEXT_MAX_CHARS` (default 12,000)

### 4. Project Creation

- **Explicit**: `reference_urls` in `ProjectCreate` (from NewProject "Reference URLs" field)
- **Auto-extract**: Backend extracts from `description` + `additional_instructions`
- Stored in `project.reference_urls` (JSONB)

### 5. Quote Generation

- **Source of reference_urls**:
  1. `request.project_context.reference_urls` (from frontend)
  2. Fallback: `project.reference_urls` (from DB)
- Passed to `build_reference_url_context(explicit_urls=...)`
- Result added to `canonical_brief` under header `REFERENCE_URLS_HEADER`

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `ENABLE_URL_SCRAPING` | true | Enable URL scraping for reference context |
| `MAX_REFERENCE_URLS` | 4 | Max URLs to scrape per quote generation |
| `URL_SCRAPE_TIMEOUT_SEC` | 18 | Timeout per URL (Playwright) |
| `URL_REFERENCE_CONTEXT_MAX_CHARS` | 12000 | Cap for reference block in brief |
| `SITE_CRAWL_ENABLED` | true | Enable full-site crawl (skipped for Figma) |
| `ALLOWED_URL_SCHEMES` | ["https"] | Schemes allowed for scraping |

## Frontend Flow

### NewProject Page

1. **Reference URLs field**: Optional textarea for Figma/design links (one per line or comma-separated)
2. **Create project**: Sends `reference_urls` if user pasted URLs
3. **EstimationGenerationUI**: Receives `referenceUrls={project.reference_urls}` for quote generation

### ProjectDetail Page (regenerate / existing project)

- Passes `referenceUrls={project.reference_urls ?? quote.metadata.reference_urls_used}` to EstimationGenerationUI

## Figma-Specific Behavior

- **No site crawl**: Figma design links (`figma.com/design/...`, `figma.com/file/...`) trigger single-URL scrape only
- **Why**: Crawling figma.com would discover unrelated pages; designs live in one file
- **Multi-page exploration**: When `FIGMA_PAGE_EXPLORATION_ENABLED=true`, Playwright explores the Pages sidebar (Home, Internal pages, etc.), expands collapsible sections, clicks each page, and captures a screenshot per page so the full scope (e.g. 10 pages) is captured for accurate estimation
- **Config**: `MAX_FIGMA_PAGES` (default 20) caps how many pages to explore per file

## Data Flow Summary

| Stage | Data |
|-------|------|
| Project create (API) | `reference_urls: string[]` in ProjectCreate |
| Project (DB) | `project.reference_urls` (JSONB) |
| Quote generate (request) | `project_context.reference_urls` or fallback to `project.reference_urls` |
| build_reference_url_context | `explicit_urls` + extracted from text |
| canonical_brief | Includes `REFERENCE_URLS_HEADER` + scraped/vision context |
| Quote metadata | `reference_urls_used: string[]` (URLs actually scraped) |
