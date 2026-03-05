"""
URL scraping service: all URLs scraped with Playwright (Chromium).

Used to fetch reference URLs detected in project content. Results are consumed
by the reference URL context builder for inclusion in the project brief.

All URLs (including Figma design links) are opened in a headless browser for
screenshot + body text. No Figma API or token required.

Playwright provides auto-waiting, better SPA/Figma handling, and optional
video recording. When Playwright fails (e.g. not installed), an HTTP fallback
fetches HTML and extracts visible text so estimation still has reference content.
"""

import asyncio
import base64
import logging
import os

import httpx
from bs4 import BeautifulSoup

from app.services.url_scraping_types import UrlScrapeResult

# Re-export for callers that import from this module
__all__ = ["UrlScrapeResult", "scrape_urls", "scrape_urls_with_video"]

logger = logging.getLogger(__name__)

# Per-URL text truncation to control token usage
EXTRACTED_TEXT_MAX_CHARS = 15_000

# Default viewport for screenshot (controls image size)
VIEWPORT_WIDTH = 1200
VIEWPORT_HEIGHT = 800

# Wait for network to be idle before screenshot (ms); Playwright auto-waits
WAIT_AFTER_LOAD_MS = 1500


async def _fetch_text_via_http(url: str, timeout_sec: float = 25.0) -> str:
    """
    Fetch URL with httpx and extract visible text from HTML (no JS).
    Used as fallback when Playwright fails so estimation still gets content.
    """
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout_sec,
            headers={"User-Agent": "Mozilla/5.0 (compatible; EstimationGenerator/1.0)"},
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


async def _scrape_urls_playwright(
    urls: list[str],
    *,
    timeout_per_url: int,
    record_video: bool = False,
    video_storage_dir: str | None = None,
) -> tuple[list[UrlScrapeResult], str | None]:
    """
    Scrape each URL with Playwright (screenshot + body text).
    Returns (results, video_path or None).
    """
    from playwright.async_api import async_playwright

    results: list[UrlScrapeResult] = []
    video_path: str | None = None

    if not urls:
        return results, None

    try:
        async with async_playwright() as p:
            launch_opts: dict = {
                "headless": True,
                "args": [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
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
            }
            if record_video and video_storage_dir:
                os.makedirs(video_storage_dir, exist_ok=True)
                context_opts["record_video_dir"] = video_storage_dir

            context = await browser.new_context(**context_opts)
            context.set_default_timeout(timeout_per_url * 1000)

            for url in urls:
                page = None
                try:
                    page = await context.new_page()
                    await page.goto(url, wait_until="networkidle", timeout=timeout_per_url * 1000)
                    await asyncio.sleep(min(WAIT_AFTER_LOAD_MS / 1000.0, 2.0))

                    screenshot_bytes = await page.screenshot(full_page=False, type="png")
                    screenshot_base64 = (
                        base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
                    )

                    try:
                        body = await page.query_selector("body")
                        text = await body.inner_text() if body else ""
                    except Exception:
                        text = ""

                    text = _truncate_text((text or "").strip())

                    results.append(
                        UrlScrapeResult(
                            url=url,
                            screenshot_base64=screenshot_base64,
                            extracted_text=text,
                            error=None,
                        )
                    )
                except Exception as e:
                    logger.warning("URL scrape failed: url=%s, error=%s", url, e)
                    results.append(
                        UrlScrapeResult(
                            url=url,
                            screenshot_base64=None,
                            extracted_text="",
                            error=f"{type(e).__name__}: {e!s}",
                        )
                    )
                finally:
                    if page:
                        await page.close()

            if record_video and video_storage_dir:
                # Playwright saves per-context; first page's video is typically used
                # For multi-URL we'd need per-page video - simplified: store dir path
                video_path = video_storage_dir

            await context.close()
            await browser.close()

    except Exception as e:
        logger.exception("Failed to launch Playwright for URL scraping: %s", e)
        for url in urls:
            results.append(
                UrlScrapeResult(
                    url=url,
                    screenshot_base64=None,
                    extracted_text="",
                    error=f"Browser launch failed: {e!s}",
                )
            )

    return results, video_path


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
        ordered, _ = await _scrape_urls_playwright(
            to_process,
            timeout_per_url=timeout_per_url,
            record_video=False,
        )
    except Exception as e:
        logger.exception("Playwright scrape failed: %s", e)
        ordered = [
            UrlScrapeResult(url=u, screenshot_base64=None, extracted_text="", error=str(e))
            for u in to_process
        ]

    # When Playwright failed, fallback to HTTP so estimation still gets text
    for i, r in enumerate(ordered):
        if r.error and not (r.extracted_text or "").strip():
            fallback_text = await _fetch_text_via_http(r.url, timeout_sec=float(timeout_per_url))
            if fallback_text:
                ordered[i] = UrlScrapeResult(
                    url=r.url,
                    screenshot_base64=r.screenshot_base64,
                    extracted_text=fallback_text,
                    error=r.error,
                )
                logger.info(
                    "Playwright failed for %s; used HTTP fallback for estimation text",
                    r.url,
                )

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


async def scrape_urls_with_video(
    urls: list[str],
    *,
    timeout_per_url: int = 25,
    max_urls: int = 25,
    record_video: bool = False,
    video_storage_dir: str | None = None,
    seconds_per_page: int = 3,
) -> tuple[list[UrlScrapeResult], str | None]:
    """
    Scrape each URL; optionally record video.

    When record_video is True and video_storage_dir is set, Playwright records
    a video of the browsing session. Returns (results, video_dir or None).
    """
    if not urls:
        return [], None

    to_process = urls[:max_urls]
    storage = video_storage_dir if (record_video and video_storage_dir) else None

    try:
        results, video_path = await _scrape_urls_playwright(
            to_process,
            timeout_per_url=timeout_per_url,
            record_video=bool(storage),
            video_storage_dir=storage,
        )
    except Exception as e:
        logger.exception("Playwright scrape with video failed: %s", e)
        results = [
            UrlScrapeResult(url=u, screenshot_base64=None, extracted_text="", error=str(e))
            for u in to_process
        ]
        video_path = None

    return results, video_path
