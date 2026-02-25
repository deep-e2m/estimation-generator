"""
Build reference URL context for the project brief (quote generation + content quality).

When URL scraping is enabled, extracts URLs from project content, scrapes each
(screenshot + text), describes screenshots via vision, and returns a single
block of text to append to the brief. See specs/url-scraping-estimation.md.
"""

import asyncio
import logging
from typing import Optional

from app.config import get_settings
from app.services.url_extraction import extract_urls

logger = logging.getLogger(__name__)

# Total wall-clock timeout for "extract + scrape + vision" so one slow URL doesn't block
REFERENCE_URL_TOTAL_TIMEOUT_SEC = 90

# Section header used in the brief
REFERENCE_URLS_HEADER = "Reference URLs (scraped content and visual description):"


async def build_reference_url_context(
    project_description: str,
    additional_instructions: Optional[str] = None,
    document_summary: Optional[str] = None,
    document_plain_texts: Optional[list[str]] = None,
    *,
    explicit_urls: Optional[list[str]] = None,
    crawl_site_from_url: Optional[str] = None,
) -> tuple[str, list[str]]:
    """
    Build the reference URL context string and list of URLs used.

    Combines all text sources, extracts URLs (and merges explicit_urls),
    scrapes each URL (screenshot + body text), runs vision on screenshots,
    and returns one truncated block plus the list of URLs processed.

    When crawl_site_from_url is set and SITE_CRAWL_ENABLED, discovers same-host
    pages from that seed (sitemap + links) and uses them for scraping instead of
    extracted/explicit URLs only.

    If URL scraping is disabled or no URLs are found, returns ("", []).
    On scraping/vision failure for a URL, that URL's section is omitted or
    partial; the whole operation does not fail.

    Args:
        project_description: Project description text.
        additional_instructions: Optional additional instructions.
        document_summary: Optional document/SOW summary (e.g. from request).
        document_plain_texts: Optional list of plain_text from requirement docs.
        explicit_urls: Optional list of URLs to include (merged with extracted).
        crawl_site_from_url: Optional seed URL to crawl for full-site context (overrides when set).

    Returns:
        (context_string, urls_used). context_string is truncated to
        URL_REFERENCE_CONTEXT_MAX_CHARS. urls_used is the list of URLs we
        attempted to use (for logging/metadata).
    """
    settings = get_settings()
    if not settings.ENABLE_URL_SCRAPING:
        return "", []

    urls_to_scrape: list[str] = []
    used_crawl = False
    if crawl_site_from_url and crawl_site_from_url.strip() and getattr(settings, "SITE_CRAWL_ENABLED", False):
        from app.services.site_crawl_service import crawl_site

        normalized = extract_urls(
            crawl_site_from_url.strip(),
            allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
            max_urls=1,
            reject_local_private=settings.is_production,
        )
        if normalized:
            urls_to_scrape = await crawl_site(
                normalized[0],
                max_pages=settings.MAX_SITE_PAGES,
                depth=settings.SITE_CRAWL_DEPTH,
                timeout_sec=float(settings.SITE_CRAWL_TIMEOUT_SEC),
                allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
            )
            if urls_to_scrape:
                used_crawl = True
        if not urls_to_scrape:
            logger.warning("Crawl from %s produced no URLs; falling back to extracted/explicit", crawl_site_from_url)

    if not urls_to_scrape:
        combined_parts: list[str] = []
        if project_description and project_description.strip():
            combined_parts.append(project_description.strip())
        if additional_instructions and str(additional_instructions).strip():
            combined_parts.append(str(additional_instructions).strip())
        if document_summary and str(document_summary).strip():
            combined_parts.append(str(document_summary).strip())
        for t in document_plain_texts or []:
            if t and str(t).strip():
                combined_parts.append(str(t).strip())

        extracted = extract_urls(
            *combined_parts,
            allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
            max_urls=settings.MAX_REFERENCE_URLS,
            reject_local_private=settings.is_production,
        )
        urls_to_scrape = list(extracted)
        if explicit_urls:
            seen = set(urls_to_scrape)
            for u in explicit_urls:
                if u and u.strip() and u.strip() not in seen:
                    urls_to_scrape.append(u.strip())
                    seen.add(u.strip())
            urls_to_scrape = urls_to_scrape[: settings.MAX_REFERENCE_URLS]

    if not urls_to_scrape:
        return "", []

    max_urls_for_scrape = len(urls_to_scrape) if used_crawl else min(settings.MAX_REFERENCE_URLS, len(urls_to_scrape))

    logger.info(
        "Reference URLs to scrape: count=%d (crawl=%s)",
        len(urls_to_scrape),
        used_crawl,
    )

    timeout = REFERENCE_URL_TOTAL_TIMEOUT_SEC
    if used_crawl:
        timeout = max(timeout, settings.SITE_CRAWL_TIMEOUT_SEC + max_urls_for_scrape * settings.URL_SCRAPE_TIMEOUT_SEC)

    try:
        context, urls_used = await asyncio.wait_for(
            _scrape_and_describe(
                urls_to_scrape,
                timeout_per_url=settings.URL_SCRAPE_TIMEOUT_SEC,
                max_urls=max_urls_for_scrape,
                max_context_chars=settings.URL_REFERENCE_CONTEXT_MAX_CHARS,
            ),
            timeout=timeout,
        )
        if context and len(context) > settings.URL_REFERENCE_CONTEXT_MAX_CHARS:
            context = context[: settings.URL_REFERENCE_CONTEXT_MAX_CHARS] + "\n\n[... truncated ...]"
        return context, urls_used
    except asyncio.TimeoutError:
        logger.warning("Reference URL context build timed out after %ds", REFERENCE_URL_TOTAL_TIMEOUT_SEC)
        return "", []
    except Exception as e:
        logger.warning("Reference URL context build failed: %s", e)
        return "", []


async def _scrape_and_describe(
    urls: list[str],
    *,
    timeout_per_url: int,
    max_urls: int,
    max_context_chars: int,
) -> tuple[str, list[str]]:
    """Scrape URLs and build context string with text + vision descriptions."""
    from app.services.ai.llm_service import get_llm_service
    from app.services.url_scraping_service import scrape_urls

    results = await scrape_urls(
        urls,
        timeout_per_url=timeout_per_url,
        max_urls=max_urls,
    )
    sections: list[str] = []
    urls_used: list[str] = []

    for r in results:
        urls_used.append(r.url)
        if r.error and not r.extracted_text and not r.screenshot_base64:
            logger.debug("Skipping URL (failed): %s", r.url)
            continue

        block_parts: list[str] = [f"Reference URL: {r.url}"]
        if r.extracted_text:
            block_parts.append(r.extracted_text.strip())

        if r.screenshot_base64:
            try:
                llm = get_llm_service()
                analysis_result = await llm.analyze_image(
                    r.screenshot_base64,
                    context=r.url,
                    analysis_type="reference_url_screenshot",
                )
                analysis_text = (analysis_result.get("analysis") or "").strip()
                if analysis_text:
                    block_parts.append(f"Visual reference for {r.url}: {analysis_text}")
            except Exception as e:
                logger.warning("Vision description failed for %s: %s", r.url, e)

        sections.append("\n\n".join(block_parts))

    if not sections:
        logger.info(
            "Reference URL scraping failed for all %d URL(s); omitting reference block",
            len(urls),
        )

    context = "\n\n---\n\n".join(sections) if sections else ""
    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[... truncated ...]"
    return context, urls_used
