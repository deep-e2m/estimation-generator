"""
URL scraping service: all URLs scraped with Selenium (Chrome).

Used to fetch reference URLs detected in project content. Results are consumed
by the reference URL context builder for inclusion in the project brief.

All URLs (including Figma design links) are opened in a headless browser for
screenshot + body text. No Figma API or token required.

When Selenium/ChromeDriver fails (e.g. in Docker), an HTTP fallback fetches HTML
and extracts visible text so estimation still has reference content.

Optional: scrape_urls_with_video delegates to scrape_urls and returns (results, None)
since Selenium does not provide built-in video recording like Playwright did.
"""

import asyncio
import base64
import logging
import time

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

# Wait this long after load so JS-rendered and lazy content can appear (ms)
POST_LOAD_WAIT_MS = 2000


async def _fetch_text_via_http(url: str, timeout_sec: float = 25.0) -> str:
    """
    Fetch URL with httpx and extract visible text from HTML (no JS).
    Used as fallback when Selenium/ChromeDriver fails so estimation still gets content.
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


def _scrape_urls_selenium_sync(
    urls: list[str],
    *,
    timeout_per_url: int,
) -> list[UrlScrapeResult]:
    """
    Synchronous Selenium scrape: launch Chrome/Chromium, for each URL get page, wait,
    screenshot, body text. Run from thread to avoid blocking event loop.
    """
    import os

    from selenium import webdriver
    from selenium.common.exceptions import TimeoutException, WebDriverException
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from webdriver_manager.chrome import ChromeDriverManager

    results: list[UrlScrapeResult] = []
    if not urls:
        return results

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument(f"--window-size={VIEWPORT_WIDTH},{VIEWPORT_HEIGHT}")
    # Use system Chromium in Docker when available
    for chromium_bin in ("/usr/bin/chromium", "/usr/bin/chromium-browser"):
        if os.path.isfile(chromium_bin):
            options.binary_location = chromium_bin
            break

    driver = None
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(timeout_per_url)
        driver.implicitly_wait(2)

        for url in urls:
            try:
                driver.get(url)
                driver.implicitly_wait(0)
                time.sleep(POST_LOAD_WAIT_MS / 1000.0)
                screenshot_bytes = driver.get_screenshot_as_png()
                screenshot_base64 = base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
                try:
                    body = driver.find_element(By.TAG_NAME, "body")
                    text = (body.text or "").strip()
                except Exception:
                    text = ""
                if text and len(text) > EXTRACTED_TEXT_MAX_CHARS:
                    text = text[:EXTRACTED_TEXT_MAX_CHARS] + "\n\n[... truncated ...]"
                results.append(
                    UrlScrapeResult(
                        url=url,
                        screenshot_base64=screenshot_base64,
                        extracted_text=text or "",
                        error=None,
                    )
                )
            except TimeoutException as e:
                logger.warning("URL scrape timeout: url=%s, error=%s", url, e)
                results.append(
                    UrlScrapeResult(url=url, screenshot_base64=None, extracted_text="", error=f"Timeout: {e!s}")
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
                driver.implicitly_wait(2)
    except WebDriverException as e:
        logger.exception("Failed to launch Chrome for URL scraping: %s", e)
        for url in urls:
            results.append(
                UrlScrapeResult(
                    url=url,
                    screenshot_base64=None,
                    extracted_text="",
                    error=f"Browser launch failed: {e!s}",
                )
            )
    finally:
        if driver:
            try:
                driver.quit()
            except Exception as exc:
                logger.debug("Error closing Chrome driver: %s", exc)

    return results


async def scrape_urls(
    urls: list[str],
    *,
    timeout_per_url: int = 25,
    max_urls: int = 5,
) -> list[UrlScrapeResult]:
    """
    Scrape each URL with Selenium (screenshot + body text).

    Returns list of UrlScrapeResult in the same order as urls (up to max_urls).
    """
    if not urls:
        return []

    to_process = urls[:max_urls]
    loop = asyncio.get_event_loop()
    ordered = await loop.run_in_executor(
        None,
        lambda: _scrape_urls_selenium_sync(to_process, timeout_per_url=timeout_per_url),
    )

    # When Selenium/ChromeDriver failed, fallback to HTTP so estimation still gets text
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
                    "Selenium failed for %s; used HTTP fallback for estimation text",
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

    With Selenium we do not support video recording (previously Playwright did).
    When record_video is True we still run the scrape but return (results, None).
    """
    results = await scrape_urls(
        urls,
        timeout_per_url=timeout_per_url,
        max_urls=max_urls,
    )
    return (results, None)
