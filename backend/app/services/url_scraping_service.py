"""
URL scraping service: all URLs scraped with Playwright (Chromium).

Used to fetch reference URLs detected in project content. Results are consumed
by the reference URL context builder for inclusion in the project brief.

All URLs (including Figma design links) are opened in a headless browser for
screenshot + body text. No Figma API or token required.

Playwright provides auto-waiting, better SPA/Figma handling. When Playwright
fails (e.g. not installed), an HTTP fallback fetches HTML and extracts visible
text so estimation still has reference content.

Figma-specific handling (browser-only, no API):
- URL transformed to Figma embed format (strips chrome, shows canvas directly)
- Extended post-load wait (8s) to allow SPA + canvas to fully render
- Full-page screenshot to capture design frames below the fold
- Two additional scroll-offset screenshots stored in extra_screenshots so
  vision receives the full canvas area, not just the initial viewport
"""

import asyncio
import base64
import logging
import os
from urllib.parse import quote as url_quote

import httpx
from bs4 import BeautifulSoup

from app.services.url_scraping_types import UrlScrapeResult

# Re-export for callers that import from this module
__all__ = ["UrlScrapeResult", "scrape_urls"]

logger = logging.getLogger(__name__)

# Per-URL text truncation to control token usage
EXTRACTED_TEXT_MAX_CHARS = 15_000

# Default viewport for screenshot — wide enough for desktop designs and Figma canvas
VIEWPORT_WIDTH = 1920
VIEWPORT_HEIGHT = 1080

# Wait after load for standard sites (ms)
WAIT_AFTER_LOAD_MS = 1500

# Extended wait for Figma SPA + canvas render (ms)
WAIT_AFTER_LOAD_FIGMA_MS = 8000

# Real Chrome user-agent — reduces bot detection (403 from Figma/CloudFront)
CHROME_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _is_figma_url(url: str) -> bool:
    """True if URL is a Figma design/file link."""
    u = (url or "").strip().lower()
    return "figma.com/design/" in u or "figma.com/file/" in u


def _to_figma_embed_url(url: str) -> str:
    """
    Transform a Figma design/file URL to the embed format.
    Embed mode removes Figma app chrome and shows the canvas directly,
    which gives vision a cleaner view of the actual design frames.
    e.g. https://www.figma.com/design/KEY/Name → https://www.figma.com/embed?embed_host=share&url=<encoded>
    """
    encoded = url_quote(url, safe="")
    return f"https://www.figma.com/embed?embed_host=share&url={encoded}"


async def _fetch_text_via_http(url: str, timeout_sec: float = 25.0) -> str:
    """
    Fetch URL with httpx and extract visible text from HTML (no JS).
    Used as fallback when Playwright fails so estimation still gets content.
    """
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout_sec,
            headers={"User-Agent": CHROME_USER_AGENT},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup.find_all(["script", "style", "noscript"]):
                tag.decompose()
            body = soup.find("body") or soup
            text = (body.get_text(separator="\n", strip=True) if body else "") or ""
            if text and len(text) > EXTRACTED_TEXT_MAX_CHARS:
                text = text[:EXTRACTED_TEXT_MAX_CHARS] + "\n\n[... truncated ...]"
            return text.strip()
    except Exception as e:
        logger.debug("HTTP fallback for %s failed: %s", url, e)
        return ""


def _truncate_text(text: str) -> str:
    """Truncate extracted text to max chars."""
    if not text or len(text) <= EXTRACTED_TEXT_MAX_CHARS:
        return (text or "").strip()
    return (text[:EXTRACTED_TEXT_MAX_CHARS] + "\n\n[... truncated ...]").strip()


async def _scrape_single_url(
    context,  # playwright.async_api.BrowserContext
    url: str,
    *,
    timeout_per_url: int,
) -> UrlScrapeResult:
    """
    Scrape one URL (screenshot + body text). Runs in parallel with other URLs.

    Figma URLs get special treatment:
    - Loaded as embed URL (canvas-only view, no app chrome)
    - Extended post-load wait for SPA + canvas render
    - Full-page screenshot
    - Two extra scroll-offset screenshots in extra_screenshots (25% and 55% of page height)
      so vision sees the full design canvas, not just initial viewport

    All other URLs:
    - Full-page screenshot (captures below-fold content)
    - Standard post-load wait
    """
    page = None
    figma = _is_figma_url(url)
    load_url = _to_figma_embed_url(url) if figma else url
    wait_sec = WAIT_AFTER_LOAD_FIGMA_MS / 1000.0 if figma else WAIT_AFTER_LOAD_MS / 1000.0

    try:
        page = await context.new_page()

        # Try networkidle first (best for SPAs); fallback to load for slow sites
        try:
            await page.goto(load_url, wait_until="networkidle", timeout=timeout_per_url * 1000)
        except Exception:
            await page.goto(load_url, wait_until="load", timeout=timeout_per_url * 1000)

        await asyncio.sleep(wait_sec)

        # Primary: full-page screenshot to capture below-fold content
        screenshot_bytes = await page.screenshot(full_page=True, type="png")
        screenshot_base64 = (
            base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
        )

        # For Figma: take two additional scroll-offset screenshots so vision
        # receives the full canvas area. Figma's embed renders frames vertically
        # so scrolling reveals additional screens/pages.
        extra_screenshots: list[str] | None = None
        if figma:
            extra_shots: list[str] = []
            try:
                page_height: int = await page.evaluate("() => document.body.scrollHeight")
                for scroll_frac in (0.25, 0.55):
                    scroll_y = int(page_height * scroll_frac)
                    await page.evaluate(f"window.scrollTo(0, {scroll_y})")
                    await asyncio.sleep(0.8)
                    shot = await page.screenshot(full_page=False, type="png")
                    if shot:
                        extra_shots.append(base64.b64encode(shot).decode("ascii"))
                # Scroll back to top for text extraction
                await page.evaluate("window.scrollTo(0, 0)")
            except Exception as e:
                logger.debug("Figma extra screenshots failed for %s: %s", url, e)
            if extra_shots:
                extra_screenshots = extra_shots

        # Extract visible text from body
        try:
            body = await page.query_selector("body")
            text = await body.inner_text() if body else ""
        except Exception:
            text = ""

        # For Figma: inner_text() returns SPA shell noise. Also try page title
        # and any visible label/heading elements to capture file/page names.
        if figma:
            try:
                title = await page.title()
                if title and title.strip() and title.strip() not in (text or ""):
                    text = f"{title.strip()}\n{text or ''}".strip()
            except Exception:
                pass

        text = _truncate_text((text or "").strip())

        return UrlScrapeResult(
            url=url,
            screenshot_base64=screenshot_base64,
            extracted_text=text,
            error=None,
            extra_screenshots=extra_screenshots,
        )
    except Exception as e:
        logger.warning("URL scrape failed: url=%s, error=%s", url, e)
        return UrlScrapeResult(
            url=url,
            screenshot_base64=None,
            extracted_text="",
            error=f"{type(e).__name__}: {e!s}",
        )
    finally:
        if page:
            await page.close()


async def _scrape_urls_playwright(
    urls: list[str],
    *,
    timeout_per_url: int,
) -> list[UrlScrapeResult]:
    """
    Scrape each URL with Playwright (screenshot + body text).
    URLs are scraped in parallel; results are merged in input order.
    """
    from playwright.async_api import async_playwright

    results: list[UrlScrapeResult] = []

    if not urls:
        return results

    try:
        async with async_playwright() as p:
            launch_opts: dict = {
                "headless": True,
                "args": [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",
                ],
            }
            # Use system Chromium in Docker when Playwright browsers not installed
            for chromium_bin in ("/usr/bin/chromium", "/usr/bin/chromium-browser"):
                if os.path.isfile(chromium_bin):
                    launch_opts["executable_path"] = chromium_bin
                    break

            browser = await p.chromium.launch(**launch_opts)

            context_opts: dict = {
                "viewport": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                "ignore_https_errors": True,
                "user_agent": CHROME_USER_AGENT,
                "locale": "en-US",
                "extra_http_headers": {
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                },
            }

            context = await browser.new_context(**context_opts)
            context.set_default_timeout(timeout_per_url * 1000)

            # Scrape all URLs in parallel (each URL gets its own page/task)
            scrape_tasks = [
                _scrape_single_url(context, url, timeout_per_url=timeout_per_url)
                for url in urls
            ]
            results = list(await asyncio.gather(*scrape_tasks))

            await context.close()
            await browser.close()

    except Exception as e:
        logger.exception("Failed to launch Playwright for URL scraping: %s", e)
        results = [
            UrlScrapeResult(
                url=url,
                screenshot_base64=None,
                extracted_text="",
                error=f"Browser launch failed: {e!s}",
            )
            for url in urls
        ]

    return results


async def scrape_urls(
    urls: list[str],
    *,
    timeout_per_url: int = 25,
    max_urls: int = 5,
) -> list[UrlScrapeResult]:
    """
    Scrape each URL with Playwright (screenshot + body text).

    Returns list of UrlScrapeResult in the same order as urls (up to max_urls).
    """
    if not urls:
        return []

    to_process = urls[:max_urls]

    try:
        ordered = await _scrape_urls_playwright(
            to_process,
            timeout_per_url=timeout_per_url,
        )
    except Exception as e:
        logger.exception("Playwright scrape failed: %s", e)
        ordered = [
            UrlScrapeResult(url=u, screenshot_base64=None, extracted_text="", error=str(e))
            for u in to_process
        ]

    # When Playwright failed, fallback to HTTP so estimation still gets text (parallel)
    async def _maybe_fallback(r: UrlScrapeResult) -> UrlScrapeResult:
        if r.error and not (r.extracted_text or "").strip():
            fallback_text = await _fetch_text_via_http(r.url, timeout_sec=float(timeout_per_url))
            if fallback_text:
                logger.info(
                    "Playwright failed for %s; used HTTP fallback for estimation text",
                    r.url,
                )
                return UrlScrapeResult(
                    url=r.url,
                    screenshot_base64=r.screenshot_base64,
                    extracted_text=fallback_text,
                    error=r.error,
                )
        return r

    ordered = list(await asyncio.gather(*[_maybe_fallback(r) for r in ordered]))

    succeeded = sum(1 for r in ordered if r.error is None)
    with_fallback = sum(1 for r in ordered if r.error and (r.extracted_text or "").strip())
    logger.info(
        "URL scraping complete: urls=%d, succeeded=%d, failed=%d, fallback_text=%d",
        len(ordered),
        succeeded,
        len(ordered) - succeeded,
        with_fallback,
    )
    return ordered


