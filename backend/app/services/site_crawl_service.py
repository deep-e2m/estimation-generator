"""
Site crawl service: discover same-host URLs from a seed URL.

Used for "full site" reference preview: find all (or N) pages on a site via
sitemap.xml, JS-rendered links (Selenium), or raw HTML links, then scrape each
with the URL scraping service so every internal page gets a screenshot and content.
"""

import asyncio
import logging
import re
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlparse

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Wait after page load so JS-rendered links appear in the DOM (Selenium discovery)
_SELENIUM_WAIT_AFTER_LOAD_MS = 2500

# Sitemap namespace (common)
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
SITEMAP_INDEX_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"

# Regex to find href values in HTML (fallback if we don't want to pull in a parser)
_HREF_PATTERN = re.compile(
    r'\bhref\s*=\s*["\']([^"\'>\s]+)["\']',
    re.IGNORECASE,
)

# Timeout per HTTP request during crawl
_CRAWL_REQUEST_TIMEOUT = 15.0


def _normalize_base(url: str) -> str:
    """Return scheme + netloc (origin) for the URL, or empty if invalid."""
    try:
        parsed = urlparse(url.strip())
        if not parsed.scheme or not parsed.netloc:
            return ""
        return f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return ""


def _is_likely_sitemap_file(url: str) -> bool:
    """True if URL looks like a sitemap/index file (e.g. .xml or path contains sitemap), not a real page."""
    try:
        parsed = urlparse(url.strip())
        path = (parsed.path or "").lower()
        return path.endswith(".xml") or "sitemap" in path
    except Exception:
        return False


# Extensions and path segments that indicate static assets, feeds, or API endpoints (not content pages)
_PAGE_LIKE_BAD_PATH_PARTS = ("/feed/", "/wp-json/", "/xmlrpc", "/oembed", "/comments/feed/")
_PAGE_LIKE_BAD_EXTENSIONS = (
    ".css", ".js", ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
    ".pdf", ".zip", ".php",  # .php for xmlrpc.php, etc.
)


def _is_page_like_url(url: str) -> bool:
    """True if URL looks like a content page (not a static asset, feed, or API endpoint)."""
    try:
        parsed = urlparse(url.strip())
        path = (parsed.path or "/").lower()
        if path == "/":
            return True
        for part in _PAGE_LIKE_BAD_PATH_PARTS:
            if part in path:
                return False
        for ext in _PAGE_LIKE_BAD_EXTENSIONS:
            if path.endswith(ext) or ext + "?" in path:
                return False
        return True
    except Exception:
        return False


def _same_origin(base_origin: str, candidate: str) -> bool:
    """True if candidate URL has the same origin (scheme + netloc) as base."""
    if not base_origin or not candidate:
        return False
    try:
        cand_origin = _normalize_base(candidate)
        return cand_origin == base_origin
    except Exception:
        return False


def _resolve_url(base_url: str, href: str) -> str | None:
    """Resolve href against base_url to an absolute URL. Returns None if invalid."""
    try:
        resolved = urljoin(base_url, href.strip())
        parsed = urlparse(resolved)
        if not parsed.scheme or not parsed.netloc:
            return None
        if parsed.scheme not in ("http", "https"):
            return None
        # Drop fragment for deduplication
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}{('?' + parsed.query) if parsed.query else ''}"
    except Exception:
        return None


def _normalize_absolute_url(url: str) -> str | None:
    """Normalize absolute URL (drop fragment) for deduplication. Returns None if invalid."""
    try:
        parsed = urlparse(url.strip())
        if not parsed.scheme or not parsed.netloc:
            return None
        if parsed.scheme not in ("http", "https"):
            return None
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}{('?' + parsed.query) if parsed.query else ''}"
    except Exception:
        return None


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str | None:
    """Fetch URL and return response text, or None on failure."""
    try:
        resp = await client.get(url, follow_redirects=True, timeout=_CRAWL_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.debug("Crawl fetch failed for %s: %s", url, e)
        return None


def _extract_links_from_html(html: str, base_url: str, base_origin: str) -> list[str]:
    """Extract same-origin links from HTML. Returns absolute URLs, deduped."""
    seen: set[str] = set()
    result: list[str] = []
    for m in _HREF_PATTERN.finditer(html):
        href = m.group(1).strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        resolved = _resolve_url(base_url, href)
        if not resolved or not _same_origin(base_origin, resolved):
            continue
        if resolved not in seen:
            seen.add(resolved)
            result.append(resolved)
    return result


def _parse_sitemap_xml(text: str, base_origin: str) -> list[str]:
    """Parse sitemap XML and return same-origin <loc> URLs. Handles both urlset and sitemapindex."""
    urls: list[str] = []
    try:
        root = ET.fromstring(text)
        # Sitemaps use namespace; match with or without ns
        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag == "loc" and elem.text:
                loc = elem.text.strip()
                if _same_origin(base_origin, loc):
                    urls.append(loc)
    except ET.ParseError as e:
        logger.debug("Sitemap XML parse error: %s", e)
    return urls


async def _discover_via_sitemap(client: httpx.AsyncClient, base_origin: str, seed_url: str) -> list[str]:
    """Try common sitemap paths and return same-origin URLs (seed first, then rest).
    If the sitemap is an index (lists other .xml sitemaps), fetch those and collect real page URLs."""
    candidates = [
        urljoin(seed_url, "/sitemap.xml"),
        urljoin(seed_url, "/sitemap_index.xml"),
        urljoin(seed_url, "/sitemap-index.xml"),
        urljoin(seed_url, "/sitemap/sitemap.xml"),
    ]
    for sitemap_url in candidates:
        text = await _fetch_text(client, sitemap_url)
        if not text:
            continue
        urls = _parse_sitemap_xml(text, base_origin)
        if not urls:
            continue
        # If we got sitemap index files (e.g. page-sitemap.xml), fetch them for real page URLs
        sitemap_files = [u for u in urls if _is_likely_sitemap_file(u)]
        page_urls = [u for u in urls if not _is_likely_sitemap_file(u)]
        for child_url in sitemap_files:
            child_text = await _fetch_text(client, child_url)
            if child_text:
                page_urls.extend(_parse_sitemap_xml(child_text, base_origin))
        # Seed first, then rest (dedupe)
        seen: set[str] = set()
        ordered: list[str] = [seed_url]
        n_seed = _normalize_absolute_url(seed_url)
        if n_seed:
            seen.add(n_seed)
        for u in page_urls:
            if _is_likely_sitemap_file(u) or not _is_page_like_url(u):
                continue
            n = _normalize_absolute_url(u)
            if n and n not in seen:
                seen.add(n)
                ordered.append(u)
        if ordered:
            return ordered
    return []


async def _discover_via_links(
    client: httpx.AsyncClient,
    base_origin: str,
    seed_url: str,
    max_pages: int,
    depth: int,
) -> list[str]:
    """Discover URLs by fetching seed page and optionally one more level of same-origin links."""
    text = await _fetch_text(client, seed_url)
    if not text:
        return [seed_url]
    first_level = _extract_links_from_html(text, seed_url, base_origin)
    # Seed first, then first-level links
    seen = {seed_url}
    ordered: list[str] = [seed_url]
    for u in first_level:
        if u not in seen and len(ordered) < max_pages:
            seen.add(u)
            ordered.append(u)

    if depth <= 1 or len(ordered) >= max_pages:
        return ordered[:max_pages]

    # Depth 2: fetch each first-level page and collect links (same order: seed, then by discovery)
    to_fetch = [u for u in ordered[1:] if len(ordered) < max_pages]
    for url in to_fetch:
        if len(ordered) >= max_pages:
            break
        page_text = await _fetch_text(client, url)
        if not page_text:
            continue
        links = _extract_links_from_html(page_text, url, base_origin)
        for link in links:
            if link not in seen and len(ordered) < max_pages:
                seen.add(link)
                ordered.append(link)
    return ordered[:max_pages]


def _discover_via_selenium_sync(
    seed_url: str,
    base_origin: str,
    max_pages: int,
    depth: int,
    page_load_timeout_sec: int = 20,
) -> list[str]:
    """
    Discover same-origin URLs by loading the seed page in Chrome (Selenium) so
    JS-rendered links are present. Returns seed first, then discovered links.
    Synchronous; run via run_in_executor from async code.
    """
    import time

    from selenium import webdriver
    from selenium.common.exceptions import TimeoutException, WebDriverException
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from webdriver_manager.chrome import ChromeDriverManager

    js_collect_links = """
    return Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => h && typeof h === 'string' && !h.startsWith('javascript:') && !h.startsWith('#') && (h.startsWith('http:') || h.startsWith('https:')));
    """
    ordered: list[str] = [seed_url]
    seen: set[str] = {_normalize_absolute_url(seed_url) or seed_url}

    import os

    try:
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-setuid-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1280,720")
        for chromium_bin in ("/usr/bin/chromium", "/usr/bin/chromium-browser"):
            if os.path.isfile(chromium_bin):
                options.binary_location = chromium_bin
                break
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(page_load_timeout_sec)
        try:
            driver.get(seed_url)
            time.sleep(_SELENIUM_WAIT_AFTER_LOAD_MS / 1000.0)
            raw_urls: list[str] = driver.execute_script(js_collect_links)
            for raw in raw_urls or []:
                if len(ordered) >= max_pages:
                    break
                norm = _normalize_absolute_url(raw)
                if not norm or not _same_origin(base_origin, norm) or norm in seen:
                    continue
                seen.add(norm)
                ordered.append(norm)

            if depth >= 2 and len(ordered) > 1:
                to_visit = [u for u in ordered[1:] if len(ordered) < max_pages]
                for url in to_visit:
                    if len(ordered) >= max_pages:
                        break
                    try:
                        driver.get(url)
                        time.sleep(_SELENIUM_WAIT_AFTER_LOAD_MS / 1000.0)
                        extra: list[str] = driver.execute_script(js_collect_links)
                        for raw in extra or []:
                            if len(ordered) >= max_pages:
                                break
                            norm = _normalize_absolute_url(raw)
                            if not norm or not _same_origin(base_origin, norm) or norm in seen:
                                continue
                            seen.add(norm)
                            ordered.append(norm)
                    except Exception as e:
                        logger.debug("Selenium discovery: skip subpage %s: %s", url, e)
            return ordered[:max_pages]
        finally:
            driver.quit()
    except TimeoutException as e:
        logger.warning("Selenium discovery: seed page load timeout: %s", e)
        return ordered
    except WebDriverException as e:
        logger.warning("Selenium discovery: browser failed: %s", e)
        return ordered
    except Exception as e:
        logger.warning("Selenium discovery failed: %s", e)
        return ordered


async def _discover_via_selenium(
    seed_url: str,
    base_origin: str,
    max_pages: int,
    depth: int,
    page_load_timeout_ms: int = 20000,
) -> list[str]:
    """Async wrapper: run Selenium discovery in executor."""
    loop = asyncio.get_event_loop()
    timeout_sec = max(1, page_load_timeout_ms // 1000)
    return await loop.run_in_executor(
        None,
        lambda: _discover_via_selenium_sync(
            seed_url,
            base_origin,
            max_pages,
            depth,
            page_load_timeout_sec=timeout_sec,
        ),
    )


async def crawl_site(
    seed_url: str,
    *,
    max_pages: int | None = None,
    depth: int | None = None,
    timeout_sec: float | None = None,
    allowed_schemes: tuple[str, ...] = ("https", "http"),
) -> list[str]:
    """
    Discover same-host URLs starting from seed_url.

    Tries sitemap.xml first; if none or few URLs, discovers links from the seed page
    and optionally one more level (depth). Returns a deduplicated list with seed first,
    capped at max_pages.

    Args:
        seed_url: Starting URL (e.g. https://example.com/).
        max_pages: Cap on number of URLs to return (default from settings).
        depth: 1 = seed + same-page links, 2 = + one hop (default from settings).
        timeout_sec: Total timeout for crawl phase (default from settings).
        allowed_schemes: Only include URLs with these schemes.

    Returns:
        List of absolute same-origin URLs, seed first, then others, length <= max_pages.
    """
    settings = get_settings()
    if max_pages is None:
        max_pages = settings.MAX_SITE_PAGES
    if depth is None:
        depth = settings.SITE_CRAWL_DEPTH
    if timeout_sec is None:
        timeout_sec = float(settings.SITE_CRAWL_TIMEOUT_SEC)

    base_origin = _normalize_base(seed_url)
    if not base_origin:
        logger.warning("Invalid seed URL for crawl: %s", seed_url)
        return []
    parsed = urlparse(seed_url)
    if parsed.scheme not in allowed_schemes:
        return []

    async with httpx.AsyncClient(
        follow_redirects=True,
        headers={"User-Agent": "EstimateAI-SiteCrawl/1.0"},
    ) as client:

        async def _run() -> list[str]:
            # 1) Try sitemap (may return 0 or many URLs; can include sitemap index .xml files)
            sitemap_urls = await _discover_via_sitemap(client, base_origin, seed_url)
            page_urls_from_sitemap = [u for u in sitemap_urls if not _is_likely_sitemap_file(u)]
            # Only use sitemap alone when it found multiple real pages; else discover via Selenium/links
            if len(page_urls_from_sitemap) > 1:
                return page_urls_from_sitemap[:max_pages]
            # 2) Discover via Selenium (JS-rendered links: nav, footers, etc.) so we get internal pages
            seen: set[str] = set()
            ordered: list[str] = [seed_url]
            seen.add(_normalize_absolute_url(seed_url) or seed_url)
            for u in sitemap_urls:
                if _is_likely_sitemap_file(u):
                    continue
                n = _normalize_absolute_url(u)
                if n and n not in seen:
                    seen.add(n)
                    ordered.append(u)
            selenium_timeout = min(timeout_sec, 75)
            try:
                sel_urls = await asyncio.wait_for(
                    _discover_via_selenium(
                        seed_url,
                        base_origin,
                        max_pages,
                        depth,
                        page_load_timeout_ms=20000,
                    ),
                    timeout=selenium_timeout,
                )
                for u in sel_urls:
                    if len(ordered) >= max_pages:
                        break
                    if not _is_page_like_url(u):
                        continue
                    n = _normalize_absolute_url(u)
                    if n and n not in seen:
                        seen.add(n)
                        ordered.append(u)
                if len(ordered) > 1:
                    logger.info(
                        "Selenium discovery found %d URLs from %s",
                        len(ordered),
                        seed_url,
                    )
                    return ordered[:max_pages]
            except asyncio.TimeoutError:
                logger.debug("Selenium discovery timed out")
            except Exception as e:
                logger.debug("Selenium discovery error: %s", e)
            # 3) Fallback: raw HTML link extraction (no JS)
            link_urls = await _discover_via_links(client, base_origin, seed_url, max_pages, depth)
            for u in link_urls:
                if len(ordered) >= max_pages:
                    break
                if not _is_page_like_url(u):
                    continue
                n = _normalize_absolute_url(u)
                if n and n not in seen:
                    seen.add(n)
                    ordered.append(u)
            return ordered[:max_pages]

        try:
            urls = await asyncio.wait_for(_run(), timeout=timeout_sec)
            logger.info("Site crawl from %s: discovered %d URLs (max=%d)", seed_url, len(urls), max_pages)
            return urls
        except asyncio.TimeoutError:
            logger.warning("Site crawl timed out for %s", seed_url)
            return [seed_url]
