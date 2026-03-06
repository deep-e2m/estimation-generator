#!/usr/bin/env python3
"""
Verify Playwright + Chromium for URL scraping (Figma, reference sites).

Run from backend directory:
  python scripts/verify_playwright.py

Or with optional Figma URL to test:
  python scripts/verify_playwright.py "https://www.figma.com/design/..."
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend/app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.url_scraping_service import scrape_urls


async def main() -> int:
    test_url = (sys.argv[1] if len(sys.argv) > 1 else "https://example.com").strip()
    print(f"Verifying Playwright + Chromium for URL scraping...")
    print(f"Test URL: {test_url}")
    print()

    # Check for system Chromium (Docker)
    for p in ("/usr/bin/chromium", "/usr/bin/chromium-browser"):
        if os.path.isfile(p):
            print(f"  Found system Chromium: {p}")
            break
    else:
        print("  Using Playwright's bundled Chromium (run 'playwright install chromium' if missing)")

    try:
        results = await scrape_urls(
            [test_url],
            timeout_per_url=60 if "figma.com" in test_url else 15,
            max_urls=1,
        )
    except Exception as e:
        print(f"  FAILED: {e}")
        return 1

    r = results[0] if results else None
    if not r:
        print("  FAILED: No result returned")
        return 1

    if r.error:
        if r.screenshot_base64:
            print(f"  PARTIAL: {r.error}")
            print(f"  Screenshot captured (~{len(r.screenshot_base64) // 1024}KB) — UI will show it")
            return 0
        print(f"  FAILED: {r.error}")
        if "figma.com" in test_url:
            print()
            print("  Figma tips:")
            print("    - Run: playwright install chromium")
            print("    - For Docker: Chromium is pre-installed")
        return 1

    b64_len = len(r.screenshot_base64 or "")
    print(f"  OK: Screenshot captured (~{b64_len // 1024}KB base64)")
    print(f"  Extracted text length: {len(r.extracted_text or '')} chars")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
