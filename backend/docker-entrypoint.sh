#!/bin/sh
set -e
# When /app is volume-mounted (e.g. docker-compose dev), the image's
# /app/.playwright-browsers can be hidden by a named volume that is empty on first run.
# Install Chromium before starting the app so the backend is reliable.
# Set ENABLE_URL_SCRAPING=false in .env to skip install and start in seconds (no URL scraping).
if [ "${ENABLE_URL_SCRAPING}" = "false" ] || [ "${ENABLE_URL_SCRAPING}" = "0" ]; then
  echo "ENABLE_URL_SCRAPING is false; skipping Playwright install."
elif [ -n "${PLAYWRIGHT_BROWSERS_PATH}" ]; then
  if ! ls "${PLAYWRIGHT_BROWSERS_PATH}"/chromium* 1>/dev/null 2>&1; then
    echo "Playwright browsers not found at ${PLAYWRIGHT_BROWSERS_PATH}; installing Chromium (this may take ~2 min on first run)..."
    if ! playwright install chromium; then
      echo "Warning: Playwright Chromium install failed. Reference URL scraping will not work until browsers are installed."
    fi
  fi
fi
exec "$@"
