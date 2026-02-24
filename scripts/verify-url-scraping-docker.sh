#!/usr/bin/env bash
# Verify URL scraping (Playwright/Chromium) works inside the backend Docker image.
# Run from repo root. See specs/url-scraping-estimation.md §7.2.

set -e

echo "Building backend image..."
docker-compose build backend

echo "Running one scrape inside container (https://example.com/)..."
docker-compose run --rm backend python3 -c "
import asyncio
from app.services.url_scraping_service import scrape_urls

async def main():
    results = await scrape_urls(['https://example.com/'], max_urls=1, timeout_per_url=15)
    r = results[0]
    print('URL:', r.url)
    print('Error:', r.error)
    print('Text length:', len(r.extracted_text or ''))
    print('Screenshot (base64) length:', len(r.screenshot_base64 or 0))
    if r.error:
        raise SystemExit(1)
    if not (r.extracted_text or r.screenshot_base64):
        raise SystemExit(1)
    print('OK: Chromium scrape succeeded.')

asyncio.run(main())
"

echo "Done: URL scraping (Chromium) verified in container."
