#!/bin/sh
set -e
# URL scraping uses Playwright + Chromium. No API keys or tokens required.
# Set ENABLE_URL_SCRAPING=false to disable reference URL scraping.
exec "$@"
