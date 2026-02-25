"""
URL scraping service using Playwright (screenshot + extracted text).

Used to fetch reference URLs detected in project content. Results are consumed
by the reference URL context builder (Phase 3) for inclusion in the project brief.
See specs/url-scraping-estimation.md.

Optional: scrape_urls_with_video records a single video (one page, navigate
through each URL in sequence) for full-site preview.
"""

import base64
import logging
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from playwright.async_api import (
    Browser,
    async_playwright,
    TimeoutError as PlaywrightTimeoutError,
)

logger = logging.getLogger(__name__)

# Per-URL text truncation to control token usage
EXTRACTED_TEXT_MAX_CHARS = 15_000

# Default viewport for screenshot (controls image size)
VIEWPORT_WIDTH = 1200
VIEWPORT_HEIGHT = 800

# Wait this long after load event so JS-rendered and lazy content can appear
POST_LOAD_WAIT_MS = 2000


@dataclass
class UrlScrapeResult:
    """Result of scraping a single URL."""

    url: str
    screenshot_base64: str | None
    extracted_text: str
    error: str | None


async def scrape_urls(
    urls: list[str],
    *,
    timeout_per_url: int = 25,
    max_urls: int = 5,
) -> list[UrlScrapeResult]:
    """
    Scrape each URL with Playwright: screenshot (PNG, viewport) + body text.

    Uses a single browser instance; creates a new page per URL. On failure for
    a URL, returns a result with error set and empty text/screenshot; does not
    fail the whole batch.

    Args:
        urls: List of URLs to scrape (should be normalized and scheme-allowed).
        timeout_per_url: Timeout in seconds per URL for page load.
        max_urls: Maximum number of URLs to process (extra URLs are skipped).

    Returns:
        List of UrlScrapeResult, one per requested URL (up to max_urls), in order.
    """
    if not urls:
        return []

    to_process = urls[:max_urls]
    results: list[UrlScrapeResult] = []

    timeout_ms = timeout_per_url * 1000

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
        except Exception as e:
            logger.exception("Failed to launch Chromium: %s", e)
            for url in to_process:
                results.append(
                    UrlScrapeResult(
                        url=url,
                        screenshot_base64=None,
                        extracted_text="",
                        error=f"Browser launch failed: {e!s}",
                    )
                )
            return results

        try:
            for url in to_process:
                result = await _scrape_one(
                    browser,
                    url,
                    timeout_ms=timeout_ms,
                )
                results.append(result)
        finally:
            await browser.close()

    succeeded = sum(1 for r in results if r.error is None)
    logger.info(
        "URL scraping complete: urls=%d, succeeded=%d, failed=%d",
        len(results),
        succeeded,
        len(results) - succeeded,
    )
    return results


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
    Scrape each URL and optionally record one video of the full session.

    When record_video is True and video_storage_dir is set, uses a single
    Playwright context with record_video_dir, one page, and navigates through
    each URL in sequence (screenshot + text per URL, wait seconds_per_page).
    After closing the page, the recording is saved to video_storage_dir as
    {uuid}.webm. Returns (list of UrlScrapeResult, video_id or None).

    When record_video is False or video_storage_dir is empty, delegates to
    scrape_urls() and returns (results, None).
    """
    if not record_video or not (video_storage_dir and video_storage_dir.strip()):
        results = await scrape_urls(
            urls,
            timeout_per_url=timeout_per_url,
            max_urls=max_urls,
        )
        return (results, None)

    to_process = urls[:max_urls]
    results: list[UrlScrapeResult] = []
    timeout_ms = timeout_per_url * 1000
    wait_ms = seconds_per_page * 1000
    storage_path = Path(video_storage_dir.strip())
    storage_path.mkdir(parents=True, exist_ok=True)
    video_id: str | None = None

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
        except Exception as e:
            logger.exception("Failed to launch Chromium for video scrape: %s", e)
            for url in to_process:
                results.append(
                    UrlScrapeResult(
                        url=url,
                        screenshot_base64=None,
                        extracted_text="",
                        error=f"Browser launch failed: {e!s}",
                    )
                )
            return (results, None)

        try:
            tmpdir = tempfile.mkdtemp(prefix="ref-video-")
            try:
                context = await browser.new_context(
                    viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                    ignore_https_errors=True,
                    record_video_dir=tmpdir,
                    record_video_size={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                )
                page = await context.new_page()
                try:
                    for url in to_process:
                        result = await _scrape_one(
                            browser=None,
                            url=url,
                            timeout_ms=timeout_ms,
                            page=page,
                            wait_after_load_ms=wait_ms,
                        )
                        results.append(result)
                finally:
                    await page.close()
                    # Video is finalized after page close; path is available before context close.
                    if page.video:
                        try:
                            raw_path = await page.video.path()
                            if raw_path and Path(raw_path).exists():
                                vid = str(uuid4())
                                dest = storage_path / f"{vid}.webm"
                                shutil.copy2(raw_path, dest)
                                video_id = vid
                                logger.info("Reference site video saved: %s", dest)
                        except Exception as e:
                            logger.warning("Could not save reference video: %s", e)
                    await context.close()
            finally:
                try:
                    shutil.rmtree(tmpdir, ignore_errors=True)
                except Exception as e:
                    logger.debug("Cleanup tmpdir %s: %s", tmpdir, e)
        finally:
            await browser.close()

    succeeded = sum(1 for r in results if r.error is None)
    logger.info(
        "URL scrape with video: urls=%d, succeeded=%d, video_id=%s",
        len(results),
        succeeded,
        video_id,
    )
    return (results, video_id)


async def _scrape_one(
    browser: Browser | None,
    url: str,
    *,
    timeout_ms: int,
    page=None,
    wait_after_load_ms: int = 0,
) -> UrlScrapeResult:
    """Scrape a single URL: screenshot + body text. Returns result with error set on failure.
    If page is provided, use it (and optionally wait wait_after_load_ms after load); else create and close a new page.
    """
    own_page = False
    if page is None:
        if browser is None:
            return UrlScrapeResult(
                url=url,
                screenshot_base64=None,
                extracted_text="",
                error="No browser or page provided",
            )
        page = await browser.new_page(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            ignore_https_errors=True,
        )
        own_page = True
    try:
        await page.goto(
            url,
            wait_until="load",
            timeout=timeout_ms,
        )
        # Allow JS-rendered and lazy content to appear before screenshot and text
        wait_ms = wait_after_load_ms or POST_LOAD_WAIT_MS
        await page.wait_for_timeout(wait_ms)
        # Full-page screenshot so the whole scrollable page is captured
        screenshot_bytes = await page.screenshot(type="png", full_page=True)
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode("ascii")

        text = await page.inner_text("body")
        if text:
            text = text.strip()
            if len(text) > EXTRACTED_TEXT_MAX_CHARS:
                text = text[:EXTRACTED_TEXT_MAX_CHARS] + "\n\n[... truncated ...]"
        else:
            text = ""

        return UrlScrapeResult(
            url=url,
            screenshot_base64=screenshot_base64,
            extracted_text=text,
            error=None,
        )
    except PlaywrightTimeoutError as e:
        logger.warning("URL scrape timeout: url=%s, error=%s", url, e)
        return UrlScrapeResult(
            url=url,
            screenshot_base64=None,
            extracted_text="",
            error=f"Timeout: {e!s}",
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
        if own_page and page:
            try:
                await page.close()
            except Exception as exc:
                logger.debug("Error closing page for %s: %s", url, exc)
