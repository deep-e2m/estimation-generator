"""
URL scraping service using Playwright (screenshot + extracted text).

Used to fetch reference URLs detected in project content. Results are consumed
by the reference URL context builder (Phase 3) for inclusion in the project brief.
See specs/url-scraping-estimation.md.
"""

import base64
import logging
from dataclasses import dataclass

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


async def _scrape_one(
    browser: Browser,
    url: str,
    *,
    timeout_ms: int,
) -> UrlScrapeResult:
    """Scrape a single URL: screenshot + body text. Returns result with error set on failure."""
    page = None
    try:
        page = await browser.new_page(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            ignore_https_errors=True,
        )
        await page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=timeout_ms,
        )
        screenshot_bytes = await page.screenshot(type="png")
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
        if page:
            try:
                await page.close()
            except Exception as exc:
                logger.debug("Error closing page for %s: %s", url, exc)
