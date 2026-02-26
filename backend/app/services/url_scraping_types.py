"""Shared types for URL scraping (Selenium screenshot + text)."""

from dataclasses import dataclass


@dataclass
class UrlScrapeResult:
    """Result of scraping a single URL (browser or Figma API)."""

    url: str
    screenshot_base64: str | None
    extracted_text: str
    error: str | None
    # Optional extra screenshots (e.g. Figma multiple frames); vision runs on each for richer context
    extra_screenshots: list[str] | None = None
