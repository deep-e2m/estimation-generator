# Stage 1: Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime stage
FROM python:3.11-slim as runtime

WORKDIR /app

# Install runtime dependencies (WeasyPrint: cairo/pango; pdf2image: poppler for PDF→image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 \
    libcairo2 \
    libffi8 \
    libglib2.0-0t64 \
    shared-mime-info \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Playwright/Chromium for URL scraping (reference URLs in estimation).
# Set INSTALL_PLAYWRIGHT=false for celery-worker and migrations to skip ~3min install.
ARG INSTALL_PLAYWRIGHT=true
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN useradd --create-home --shell /bin/bash appuser \
    && if [ "$INSTALL_PLAYWRIGHT" = "true" ]; then \
        playwright install --with-deps chromium \
        && chown -R appuser:appuser /app/.playwright-browsers; \
    fi
USER appuser

# Copy application code
COPY --chown=appuser:appuser . .
# Entrypoint at /entrypoint.sh survives volume mount at /app (installs Playwright browsers when missing)
COPY --chown=appuser:appuser docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application (entrypoint installs Playwright Chromium when /app is volume-mounted)
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
