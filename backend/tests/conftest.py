"""Shared test fixtures."""

import pytest


@pytest.fixture
def app_settings():
    """Override settings for testing."""
    from app.config import Settings

    return Settings(
        ENVIRONMENT="development",
        SECRET_KEY="test-secret-key-that-is-long-enough-for-validation",
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/test_quote_assistant",
    )
