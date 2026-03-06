"""
Build reference URL context for the project brief (quote generation + content quality).

When URL scraping is enabled, extracts URLs from project content, scrapes each
(screenshot + text), describes screenshots via vision, and returns a single
block of text to append to the brief. See specs/url-scraping-estimation.md.

Also returns raw scraped data (extracted_text, screenshot_base64) per URL so it
can be persisted and reused when the user opens the reference URL preview
(eye icon) without re-scraping.
"""

import asyncio
import logging
from typing import Any, Optional

from app.config import get_settings
from app.services.url_extraction import canonicalize_url_for_cache, extract_urls
from app.services.url_scraping_service import is_figma_url

logger = logging.getLogger(__name__)

# Section header used in the brief
REFERENCE_URLS_HEADER = "Reference URLs (scraped content and visual description):"

# Patterns that indicate the scrape hit a login wall, bot challenge, or error page
# rather than actual site content. Checked on short extracted text (< 400 chars).
_SUSPECT_PATTERNS = (
    "verify you are human",
    "access denied",
    "cloudflare",
    "enable javascript",
    "javascript is required",
    "sign in to",
    "log in to",
    "please log in",
    "you need to sign in",
    "enable cookies",
    "ray id",       # Cloudflare Ray ID footer
    "403 forbidden",
    "401 unauthorized",
    "this site is protected",
)


def _is_suspect_content(
    extracted_text: str,
    screenshot_base64: str | None,
    extra_screenshots: list[str] | None = None,
) -> bool:
    """
    Return True if the scrape result looks like a bot-challenge, login wall,
    or error page rather than real site content.

    Only triggers when extracted_text is short (< 400 chars) AND contains
    known challenge/auth phrases, OR when there is literally no content at all.
    Long pages with these phrases in context are not suspect.

    IMPORTANT: When we have a screenshot (primary or extra), do NOT reject based
    on text. Public Figma embeds and many design sites show "Sign in" / "Open in
    Figma" in the UI—the screenshot contains the actual design. Rejecting on text
    alone would discard valid content.
    """
    has_screenshot = bool(screenshot_base64) or bool(extra_screenshots)
    text = (extracted_text or "").strip()
    if not text and not has_screenshot:
        return True
    if has_screenshot:
        return False
    if text and len(text) < 400:
        text_lower = text.lower()
        for pattern in _SUSPECT_PATTERNS:
            if pattern in text_lower:
                return True
    return False


async def build_reference_url_context(
    project_description: str,
    additional_instructions: Optional[str] = None,
    document_summary: Optional[str] = None,
    document_plain_texts: Optional[list[str]] = None,
    *,
    explicit_urls: Optional[list[str]] = None,
    crawl_site_from_url: Optional[str] = None,
) -> tuple[str, list[str], list[str]]:
    """
    Build the reference URL context string and list of URLs used.

    Combines all text sources, extracts URLs (and merges explicit_urls),
    scrapes each URL (screenshot + body text), runs vision on screenshots,
    and returns one truncated block plus the list of URLs processed.

    When crawl_site_from_url is set and SITE_CRAWL_ENABLED, discovers same-host
    pages from that seed (sitemap + Playwright links) and uses them for scraping instead of
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
        (context_string, urls_used, urls_failed, scraped_data_by_url, crawl_seed).
        context_string is truncated to URL_REFERENCE_CONTEXT_MAX_CHARS.
        urls_used is URLs that produced usable content.
        urls_failed is URLs that failed or returned suspect content.
        scraped_data_by_url maps url -> {"extracted_text": str, "screenshot_base64": str | None}
        for reuse in preview (no re-scrape when user opens eye icon).
        crawl_seed is the seed URL if full-site crawl was used, else None.
    """
    settings = get_settings()
    if not settings.ENABLE_URL_SCRAPING:
        return "", [], [], {}, None

    # Normalize inputs so callers cannot break us (e.g. frontend sends list for crawl_site_from_url)
    if crawl_site_from_url is not None:
        if isinstance(crawl_site_from_url, str) and crawl_site_from_url.strip():
            crawl_site_from_url = crawl_site_from_url.strip()
        elif isinstance(crawl_site_from_url, list) and crawl_site_from_url:
            first = crawl_site_from_url[0]
            crawl_site_from_url = first.strip() if isinstance(first, str) and first.strip() else None
        else:
            crawl_site_from_url = None
    if explicit_urls is not None:
        if isinstance(explicit_urls, str):
            explicit_urls = [explicit_urls.strip()] if explicit_urls.strip() else None
        else:
            explicit_urls = [u.strip() for u in explicit_urls if isinstance(u, str) and (u or "").strip()] or None

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

    # Determine crawl seed: explicit crawl_site_from_url, or first URL from content/explicit.
    # Figma design/file URLs are single-page — do NOT crawl figma.com (would get unrelated pages).
    crawl_seed: Optional[str] = None
    if crawl_site_from_url and crawl_site_from_url.strip():
        candidate = crawl_site_from_url.strip()
        if not is_figma_url(candidate):
            crawl_seed = candidate
    elif getattr(settings, "SITE_CRAWL_ENABLED", False):
        extracted_from_parts = extract_urls(
            *combined_parts,
            allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
            max_urls=10,
            reject_local_private=settings.is_production,
        )
        if extracted_from_parts and not is_figma_url(extracted_from_parts[0]):
            crawl_seed = extracted_from_parts[0]
        if not crawl_seed and explicit_urls:
            for u in explicit_urls:
                if u and u.strip() and not is_figma_url(u):
                    crawl_seed = u.strip()
                    break

    urls_to_scrape: list[str] = []
    used_crawl = False
    if crawl_seed and getattr(settings, "SITE_CRAWL_ENABLED", False):
        from app.services.site_crawl_service import crawl_site

        normalized = extract_urls(
            crawl_seed,
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
            logger.warning("Crawl from %s produced no URLs; falling back to extracted/explicit", crawl_seed)

    if not urls_to_scrape:
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
                if isinstance(u, str) and u.strip() and u.strip() not in seen:
                    urls_to_scrape.append(u.strip())
                    seen.add(u.strip())
            urls_to_scrape = urls_to_scrape[: settings.MAX_REFERENCE_URLS]

    if not urls_to_scrape:
        return "", [], [], {}, None

    max_urls_for_scrape = len(urls_to_scrape) if used_crawl else min(settings.MAX_REFERENCE_URLS, len(urls_to_scrape))

    figma_count = sum(1 for u in urls_to_scrape if is_figma_url(u))
    logger.info(
        "Reference URLs to scrape: count=%d, figma=%d (crawl=%s)",
        len(urls_to_scrape),
        figma_count,
        used_crawl,
    )

    # Timeout calculation:
    # - Crawl mode: crawl_time + urls*(scrape_time + vision_estimate), capped at crawl_max
    # - Non-crawl: dynamic based on url count so last URLs aren't cut off.
    #   Formula: urls * scrape_time + vision_buffer (vision runs in parallel so ~15s flat)
    base_timeout = getattr(settings, "REFERENCE_URL_TOTAL_TIMEOUT_SEC", 60) or 60
    crawl_max = getattr(settings, "REFERENCE_URL_CRAWL_MAX_TIMEOUT_SEC", 180) or 180
    vision_buffer = 15  # vision runs in parallel; flat overhead
    if used_crawl:
        vision_estimate_per_url = 5
        needed = (
            settings.SITE_CRAWL_TIMEOUT_SEC
            + max_urls_for_scrape * (settings.URL_SCRAPE_TIMEOUT_SEC + vision_estimate_per_url)
        )
        timeout = min(max(base_timeout, needed), crawl_max)
    else:
        # Dynamic: each URL scraped in parallel. Figma multi-page explores N pages per file.
        needed = max_urls_for_scrape * settings.URL_SCRAPE_TIMEOUT_SEC + vision_buffer
        if figma_count > 0:
            max_figma = getattr(settings, "MAX_FIGMA_PAGES", 20)
            figma_extra = figma_count * (
                settings.URL_SCRAPE_TIMEOUT_SEC + max_figma * 3
            )
            needed = max(needed, figma_extra)
        timeout = max(base_timeout, needed)

    try:
        context, urls_used, urls_failed, scraped_data_by_url = await asyncio.wait_for(
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
        crawl_seed_return: Optional[str] = crawl_seed if used_crawl else None
        return context, urls_used, urls_failed, scraped_data_by_url, crawl_seed_return
    except asyncio.TimeoutError:
        logger.warning("Reference URL context build timed out after %ds", timeout)
        return "", [], [], {}, None
    except Exception as e:
        logger.warning("Reference URL context build failed: %s", e)
        return "", [], [], {}, None


async def _describe_single_result(
    r,  # UrlScrapeResult
    llm,  # LLMService
) -> tuple[str | None, str, bool, str]:
    """
    Build context block for one URL result (text + vision/design inference).
    Returns (section_text or None, url, is_failed, vision_analysis).
    vision_analysis is the AI description of the screenshot(s), used for estimation.
    """
    # Treat as failed only when we have no usable content (no screenshot, no text).
    # Figma/design URLs often return screenshot with optional error (partial success) — still use them.
    if r.error and not (r.extracted_text or "").strip() and not r.screenshot_base64:
        logger.debug("Skipping URL (failed, no content): %s", r.url)
        return None, r.url, True, ""

    if _is_suspect_content(
        r.extracted_text,
        r.screenshot_base64,
        getattr(r, "extra_screenshots", None),
    ):
        logger.info(
            "Skipping URL (suspect content — likely login/challenge page): %s", r.url
        )
        return None, r.url, True, ""

    page_name = getattr(r, "page_name", None)
    url_label = f"{r.url} (page: {page_name})" if page_name else r.url
    block_parts: list[str] = [f"Reference URL: {url_label}"]
    if r.extracted_text:
        block_parts.append(r.extracted_text.strip())

    vision_parts: list[str] = []
    all_screenshots: list[str] = []
    if r.screenshot_base64:
        all_screenshots.append(r.screenshot_base64)
    if getattr(r, "extra_screenshots", None):
        all_screenshots.extend(r.extra_screenshots)
    if all_screenshots:
        for idx, img_b64 in enumerate(all_screenshots):
            try:
                analysis_result = await llm.analyze_image(
                    img_b64,
                    context=url_label,
                    analysis_type="reference_url_screenshot",
                )
                analysis_text = (analysis_result.get("analysis") or "").strip()
                if analysis_text:
                    vision_parts.append(analysis_text)
                    label = (
                        f"Visual reference for {url_label} (screenshot {idx + 1} of {len(all_screenshots)}):"
                        if len(all_screenshots) > 1
                        else f"Visual reference for {url_label}:"
                    )
                    block_parts.append(f"{label} {analysis_text}")
            except Exception as e:
                logger.warning("Vision description failed for %s (screenshot %s): %s", r.url, idx + 1, e)
    elif (r.extracted_text or "").strip():
        try:
            design_inference = await llm.infer_reference_design_from_text(
                r.extracted_text.strip(),
                r.url,
            )
            if design_inference:
                vision_parts.append(design_inference)
                block_parts.append(
                    f"Design inference (from reference content; no screenshot available): {design_inference}"
                )
        except Exception as e:
            logger.warning("Design inference from text failed for %s: %s", r.url, e)

    vision_analysis = "\n\n".join(vision_parts).strip() if vision_parts else ""
    return "\n\n".join(block_parts), r.url, False, vision_analysis


async def _scrape_and_describe(
    urls: list[str],
    *,
    timeout_per_url: int,
    max_urls: int,
    max_context_chars: int,
) -> tuple[str, list[str], list[str], dict[str, dict[str, Any]]]:
    """
    Scrape URLs in parallel, then describe each result (vision/design inference) in parallel.
    Returns (context, urls_used, urls_failed, scraped_data_by_url).
    urls_failed contains URLs that produced no usable content (scrape error or suspect page).
    scraped_data_by_url maps url -> {extracted_text, screenshot_base64} for urls_used.
    """
    from app.services.ai.llm_service import get_llm_service
    from app.services.url_scraping_service import scrape_urls

    results = await scrape_urls(
        urls,
        timeout_per_url=timeout_per_url,
        max_urls=max_urls,
    )
    llm = get_llm_service()

    # Run vision/design inference for each result in parallel
    describe_tasks = [_describe_single_result(r, llm) for r in results]
    describe_results = await asyncio.gather(*describe_tasks)

    sections: list[str] = []
    urls_used: list[str] = []
    urls_failed: list[str] = []
    for section, url, is_failed, _ in describe_results:
        if is_failed:
            urls_failed.append(url)
        else:
            urls_used.append(url)
        if section:
            sections.append(section)

    # Build scraped_data_by_url from successful results (canonical keys for cache matching).
    # For Figma multi-page: store per-page keys and base URL -> first page for preview.
    # Include vision_analysis (AI description of screenshot) so preview shows what drives estimation.
    scraped_data_by_url: dict[str, dict[str, Any]] = {}
    figma_page_names_by_url: dict[str, set[str]] = {}
    for r, (_, _url, is_failed, vision_analysis) in zip(results, describe_results):
        if r.url in urls_used and not is_failed:
            base_key = canonicalize_url_for_cache(r.url)
            page_name = getattr(r, "page_name", None)
            key = f"{base_key} (page: {page_name})" if page_name else base_key
            entry: dict[str, Any] = {
                "extracted_text": r.extracted_text or "",
                "screenshot_base64": r.screenshot_base64,
            }
            if vision_analysis:
                entry["vision_analysis"] = vision_analysis
            if page_name:
                entry["page_name"] = page_name
                figma_page_names_by_url.setdefault(r.url, set()).add(page_name)
            if r.error:
                entry["error"] = r.error
            extra = getattr(r, "extra_screenshots", None)
            if extra:
                entry["extra_screenshots"] = extra
            scraped_data_by_url[key] = entry
            if page_name and base_key not in scraped_data_by_url:
                scraped_data_by_url[base_key] = entry

    # Enrich Figma base entry: set extracted_text to full page list for clearer preview
    for url, names in figma_page_names_by_url.items():
        if len(names) > 1:
            base_key = canonicalize_url_for_cache(url)
            if base_key in scraped_data_by_url:
                scraped_data_by_url[base_key]["extracted_text"] = (
                    "Figma pages: " + ", ".join(sorted(names))
                )

    if not sections:
        logger.info(
            "Reference URL scraping failed for all %d URL(s); omitting reference block",
            len(urls),
        )

    context = "\n\n---\n\n".join(sections) if sections else ""
    if len(context) > max_context_chars:
        context = context[:max_context_chars] + "\n\n[... truncated ...]"
    return context, urls_used, urls_failed, scraped_data_by_url
