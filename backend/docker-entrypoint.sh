#!/bin/sh
set -e
# URL scraping uses Selenium + Chromium (in image) and/or Figma API (FIGMA_ACCESS_TOKEN).
# Set ENABLE_URL_SCRAPING=false to disable reference URL scraping.
exec "$@"
