"""
URL scraping service: all URLs scraped with Playwright (Chromium).

Used to fetch reference URLs detected in project content. Results are consumed
by the reference URL context builder for inclusion in the project brief.

All URLs (including Figma design links) are opened directly in a headless browser
for screenshot + body text. No API keys or tokens required — shared Figma links
work as plain URLs.

For Figma: when FIGMA_PAGE_EXPLORATION_ENABLED, explores the Pages sidebar (Home,
Internal pages, etc.), clicks each page, and captures a screenshot per page so
the full scope (e.g. 10 pages) is captured for accurate estimation.

Flow: open URL → wait for load → (Figma: discover & click each page) → screenshot(s)
"""

import asyncio
import base64
import logging
import os

import httpx
from bs4 import BeautifulSoup

from app.services.url_scraping_types import UrlScrapeResult

# Re-export for callers that import from this module
__all__ = ["UrlScrapeResult", "scrape_urls", "is_figma_url"]

logger = logging.getLogger(__name__)

# Per-URL text truncation to control token usage
EXTRACTED_TEXT_MAX_CHARS = 15_000

# Viewport for screenshot — high resolution for accurate design and text capture
# 2560x1440 matches common design canvas sizes; ensures legible text and structure
VIEWPORT_WIDTH = 2560
VIEWPORT_HEIGHT = 1440

# Device scale for sharper screenshots (1 = default, 2 = retina)
DEVICE_SCALE_FACTOR = 2

# Wait after load for content to render (ms)
# Figma/SPAs need ~8s for design canvas; standard sites ~3s
WAIT_AFTER_LOAD_MS = 3000
WAIT_AFTER_LOAD_FIGMA_MS = 8000

# Minimum timeout for Figma (sec); design files can be large
FIGMA_MIN_TIMEOUT_SEC = 45

# Real Chrome user-agent — reduces bot detection
CHROME_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def is_figma_url(url: str) -> bool:
    """True if URL is a Figma design/file link. Shared for consistency across scraping and context builder."""
    u = (url or "").strip().lower()
    return "figma.com/design/" in u or "figma.com/file/" in u


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


# JS to discover Figma page names from the Pages sidebar.
# Figma uses a tree: "Pages" header, then items (Home, Internal pages, etc.).
# "Internal pages" is expandable; we expand first, then collect all leaf names in order.
_FIGMA_DISCOVER_PAGES_JS = """
() => {
  const SKIP = ['Pages','Layers','Assets','Search','Prototype','Inspect','Components','Styles'];
  const names = [];
  const seen = new Set();

  const add = (s) => {
    const t = (s || '').trim();
    if (t.length >= 2 && t.length <= 80 && !SKIP.includes(t) && !seen.has(t)) {
      seen.add(t);
      names.push(t);
    }
  };

  const leftPanel = document.querySelector('[data-testid="left-sidebar"]') ||
    document.querySelector('[class*="sidebar"]') ||
    document.querySelector('[class*="panel"]') ||
    document.body;

  const findText = (el, txt) => {
    if ((el.textContent || '').trim() === txt) return el;
    for (const c of (el.children || [])) {
      const r = findText(c, txt);
      if (r) return r;
    }
    return null;
  };

  const pagesHeader = findText(leftPanel, 'Pages');
  if (!pagesHeader) {
    const walk = (el, d) => {
      if (d > 6) return;
      const t = (el.textContent || '').trim().split(/[\\n\\r]+/)[0]?.trim();
      if (t && !SKIP.includes(t)) add(t);
      for (const c of (el.children || [])) {
        if (c.getBoundingClientRect().height > 8) walk(c, d + 1);
      }
    };
    walk(leftPanel, 0);
    return { names, count: names.length };
  }

  let root = pagesHeader;
  for (let i = 0; i < 10; i++) {
    const p = root.parentElement;
    if (!p) break;
    root = p;
  }

  const collectVisible = (el, depth) => {
    if (depth > 8) return;
    const rect = el.getBoundingClientRect();
    if (rect.height < 8 || rect.width < 20) return;
    const txt = (el.textContent || '').replace(/\\s+/g, ' ').trim().split('\\n')[0]?.trim();
    if (txt) add(txt);
    for (const c of (el.children || [])) collectVisible(c, depth + 1);
  };

  const next = root.nextElementSibling || (root.parentElement && Array.from(root.parentElement.children).find(c => c !== root && c.compareDocumentPosition(root) === 4));
  if (next) collectVisible(next, 0);
  collectVisible(root, 0);

  return { names: names.slice(0, 30), count: names.length };
}
"""

# Fallback: XPath for treeitem/row elements in the left panel
_FIGMA_DISCOVER_PAGES_FALLBACK_JS = """
() => {
  const SKIP = ['Pages','Layers','Assets','Search','Prototype','Inspect'];
  const names = [];
  const sel = document.querySelectorAll('[role="treeitem"], [role="button"], [class*="row"], [class*="item"]');
  for (const el of sel) {
    const r = el.getBoundingClientRect();
    if (r.left > window.innerWidth * 0.4) continue;
    const t = (el.textContent || '').trim().split(/[\\n\\r]+/)[0]?.trim();
    if (t && t.length >= 2 && t.length <= 80 && !SKIP.includes(t) && !names.includes(t)) {
      names.push(t);
    }
  }
  return { names: names.slice(0, 25), count: names.length };
}
"""


async def _scrape_figma_multi_page(
    context,  # playwright.async_api.BrowserContext
    url: str,
    *,
    timeout_per_url: int,
    max_pages: int,
) -> list[UrlScrapeResult]:
    """
    Explore Figma Pages sidebar, click each page, and capture a screenshot per page.
    Returns one UrlScrapeResult per page (with page_name set) for accurate scope.
    Falls back to single-page capture if page discovery fails.
    """
    from app.config import get_settings

    page = None
    effective_timeout_ms = max(timeout_per_url, FIGMA_MIN_TIMEOUT_SEC) * 1000
    wait_sec = WAIT_AFTER_LOAD_FIGMA_MS / 1000.0
    results: list[UrlScrapeResult] = []

    try:
        page = await context.new_page()
        page.set_default_timeout(effective_timeout_ms)
        page.set_default_navigation_timeout(effective_timeout_ms)

        await page.goto(url, wait_until="load", timeout=effective_timeout_ms)
        try:
            await page.wait_for_load_state("networkidle", timeout=20000)
        except Exception:
            pass
        await asyncio.sleep(wait_sec)

        # Expand collapsible sections (e.g. "Internal pages") under Pages to discover sub-pages
        try:
            loc = page.get_by_text("Internal pages", exact=False).first
            await loc.scroll_into_view_if_needed(timeout=3000)
            await loc.click(timeout=3000)
            await asyncio.sleep(0.8)
        except Exception:
            pass

        # Discover page names from the Pages sidebar
        discovered = await page.evaluate(_FIGMA_DISCOVER_PAGES_JS)
        names: list[str] = discovered.get("names") or []

        if not names:
            discovered = await page.evaluate(_FIGMA_DISCOVER_PAGES_FALLBACK_JS)
            names = discovered.get("names") or []

        if not names:
            logger.info(
                "Figma page discovery found no pages for %s; falling back to single-page capture",
                url[:80],
            )
            screenshot_bytes = await page.screenshot(full_page=True, type="png")
            screenshot_base64 = (
                base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
            )
            try:
                body = await page.query_selector("body")
                text = await body.inner_text() if body else ""
            except Exception:
                text = ""
            title = await page.title()
            if title and title.strip():
                text = f"{title.strip()}\n{text or ''}".strip()
            results.append(
                UrlScrapeResult(
                    url=url,
                    screenshot_base64=screenshot_base64,
                    extracted_text=_truncate_text(text),
                    error=None,
                    page_name=None,
                )
            )
            return results

        names = names[:max_pages]
        logger.info("Figma page exploration: discovered %d pages for %s", len(names), url[:80])

        # Click each page and capture screenshot
        for i, page_name in enumerate(names):
            try:
                locator = page.get_by_text(page_name, exact=False).first
                await locator.scroll_into_view_if_needed(timeout=5000)
                await locator.click(timeout=5000)
                await asyncio.sleep(1.2)

                screenshot_bytes = await page.screenshot(full_page=True, type="png")
                screenshot_base64 = (
                    base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
                )
                results.append(
                    UrlScrapeResult(
                        url=url,
                        screenshot_base64=screenshot_base64,
                        extracted_text=f"Figma page: {page_name}",
                        error=None,
                        page_name=page_name,
                    )
                )
            except Exception as e:
                logger.warning(
                    "Figma page capture failed for '%s': %s; skipping",
                    page_name,
                    e,
                )

        if not results:
            screenshot_bytes = await page.screenshot(full_page=True, type="png")
            screenshot_base64 = (
                base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
            )
            results.append(
                UrlScrapeResult(
                    url=url,
                    screenshot_base64=screenshot_base64,
                    extracted_text=await page.title() or "",
                    error=None,
                    page_name=None,
                )
            )
        return results

    except Exception as e:
        logger.warning("Figma multi-page scrape failed for %s: %s", url, e)
        return [
            UrlScrapeResult(
                url=url,
                screenshot_base64=None,
                extracted_text="",
                error=f"{type(e).__name__}: {e!s}",
                page_name=None,
            )
        ]
    finally:
        if page:
            await page.close()


async def _scrape_single_url(
    context,  # playwright.async_api.BrowserContext
    url: str,
    *,
    timeout_per_url: int,
) -> UrlScrapeResult:
    """
    Scrape one URL (screenshot + body text). Open URL directly, wait for load
    and render, take full-page screenshot at high resolution.
    """
    page = None
    figma = is_figma_url(url)
    effective_timeout_ms = (
        max(timeout_per_url, FIGMA_MIN_TIMEOUT_SEC) * 1000 if figma else timeout_per_url * 1000
    )
    wait_sec = WAIT_AFTER_LOAD_FIGMA_MS / 1000.0 if figma else WAIT_AFTER_LOAD_MS / 1000.0

    try:
        page = await context.new_page()
        page.set_default_timeout(effective_timeout_ms)
        page.set_default_navigation_timeout(effective_timeout_ms)

        # Open URL directly (Figma shared links work as plain URLs, no token/embed)
        try:
            await page.goto(url, wait_until="load", timeout=effective_timeout_ms)
        except Exception:
            await page.goto(url, wait_until="domcontentloaded", timeout=effective_timeout_ms)
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass

        await asyncio.sleep(wait_sec)

        # Full-page screenshot at viewport resolution for accurate design and text capture
        screenshot_bytes = await page.screenshot(full_page=True, type="png")
        screenshot_base64 = (
            base64.b64encode(screenshot_bytes).decode("ascii") if screenshot_bytes else None
        )

        # For Figma: scroll and capture additional views (design often extends below fold)
        extra_screenshots: list[str] | None = None
        if figma:
            extra_shots: list[str] = []
            try:
                page_height: int = await page.evaluate("() => document.body.scrollHeight")
                viewport_height = await page.evaluate("() => window.innerHeight")
                if page_height > viewport_height * 1.2:
                    for scroll_frac in (0.3, 0.6):
                        scroll_y = int(page_height * scroll_frac)
                        await page.evaluate(f"window.scrollTo(0, {scroll_y})")
                        await asyncio.sleep(0.6)
                        shot = await page.screenshot(full_page=False, type="png")
                        if shot:
                            extra_shots.append(base64.b64encode(shot).decode("ascii"))
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


async def _scrape_one_url(
    context,
    url: str,
    *,
    timeout_per_url: int,
    figma_page_exploration: bool,
    max_figma_pages: int,
) -> list[UrlScrapeResult]:
    """
    Scrape one URL. For Figma with exploration enabled, returns multiple results
    (one per page). Otherwise returns a single-result list.
    """
    if is_figma_url(url) and figma_page_exploration:
        return await _scrape_figma_multi_page(
            context,
            url,
            timeout_per_url=timeout_per_url,
            max_pages=max_figma_pages,
        )
    r = await _scrape_single_url(context, url, timeout_per_url=timeout_per_url)
    return [r]


async def _scrape_urls_playwright(
    urls: list[str],
    *,
    timeout_per_url: int,
    figma_page_exploration: bool = True,
    max_figma_pages: int = 20,
) -> list[UrlScrapeResult]:
    """
    Scrape each URL with Playwright (screenshot + body text).
    For Figma URLs with exploration enabled, explores Pages sidebar and returns
    one result per page. Otherwise one result per URL.
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
                "device_scale_factor": DEVICE_SCALE_FACTOR,
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

            async def _scrape(url: str) -> list[UrlScrapeResult]:
                return await _scrape_one_url(
                    context,
                    url,
                    timeout_per_url=timeout_per_url,
                    figma_page_exploration=figma_page_exploration,
                    max_figma_pages=max_figma_pages,
                )

            scrape_tasks = [_scrape(url) for url in urls]
            per_url_results = await asyncio.gather(*scrape_tasks)

            for url, rlist in zip(urls, per_url_results):
                results.extend(rlist)

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
                page_name=None,
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
    For Figma URLs, explores Pages sidebar and returns one result per page when
    FIGMA_PAGE_EXPLORATION_ENABLED.

    Returns list of UrlScrapeResult (one per page for Figma; one per URL otherwise).
    """
    if not urls:
        return []

    to_process = urls[:max_urls]
    try:
        from app.config import get_settings

        settings = get_settings()
        figma_explore = getattr(settings, "FIGMA_PAGE_EXPLORATION_ENABLED", True)
        max_figma = getattr(settings, "MAX_FIGMA_PAGES", 20)
    except Exception:
        figma_explore = True
        max_figma = 20

    try:
        ordered = await _scrape_urls_playwright(
            to_process,
            timeout_per_url=timeout_per_url,
            figma_page_exploration=figma_explore,
            max_figma_pages=max_figma,
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


