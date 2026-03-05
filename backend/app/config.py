"""
Application configuration using Pydantic Settings.

This module provides centralized configuration management with support for
environment variables and .env files.
"""

import json
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_list_env(v: object, default: list[str]) -> list[str]:
    """Parse env value for list[str] fields: empty/invalid JSON -> default."""
    if v is None:
        return default
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return default
        if s.startswith("["):
            try:
                parsed = json.loads(s)
                return [str(x).strip() for x in parsed if str(x).strip()] or default
            except (json.JSONDecodeError, TypeError):
                return default
        return [x.strip() for x in s.split(",") if x.strip()] or default
    return default


# Defaults for list-from-env fields (env source does JSON decode before validators;
# we store these as str and expose list via properties to avoid empty/invalid JSON errors)
_DEFAULT_ALLOWED_FILE_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/markdown", "text/csv",
]
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000",
    "http://frontend:3000", "http://localhost:80", "http://frontend:80",
]
_DEFAULT_CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
_DEFAULT_CORS_HEADERS = ["Authorization", "Content-Type", "X-Request-ID", "Accept"]
_DEFAULT_ALLOWED_URL_SCHEMES = ["https"]


class Settings(BaseSettings):
    """
    Application settings with environment variable support.

    All settings can be overridden via environment variables or .env file.
    Environment variables take precedence over .env file values.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),  # Look in current dir and parent dir
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application Settings
    APP_NAME: str = "Quote Generation Assistant"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # API Settings
    API_V1_PREFIX: str = "/api/v1"

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database Settings
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/quote_assistant",
        description="PostgreSQL connection URL with asyncpg driver",
    )
    DATABASE_POOL_SIZE: int = Field(default=5, ge=1, le=20)
    DATABASE_MAX_OVERFLOW: int = Field(default=10, ge=0, le=50)
    DATABASE_POOL_TIMEOUT: int = Field(default=30, ge=10, le=120)
    DATABASE_POOL_RECYCLE: int = Field(default=1800, ge=300)
    DATABASE_ECHO: bool = False

    # Redis Settings
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 10

    # JWT Authentication Settings
    SECRET_KEY: str = Field(
        default="CHANGE_THIS_TO_A_SECURE_SECRET_KEY_IN_PRODUCTION",
        description="Secret key for JWT token signing. Must be changed in production.",
        min_length=32,
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=5, le=1440)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=30)

    # Password Settings
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True
    BCRYPT_ROUNDS: int = Field(default=12, ge=4, le=31)

    # Storage Settings
    STORAGE_PROVIDER: Literal["database", "s3"] = "database"

    # AWS S3 Settings (only required if STORAGE_PROVIDER=s3)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""
    S3_PRESIGNED_URL_EXPIRY: int = Field(default=3600, ge=60, le=86400)

    # File Upload Settings
    MAX_FILE_SIZE_MB: int = Field(default=10, ge=1, le=100)
    # Stored as str from env to avoid pydantic-settings JSON decode of empty/invalid values
    allowed_file_types_raw: str = Field(default="", alias="ALLOWED_FILE_TYPES")

    # CORS Settings
    cors_origins_raw: str = Field(default="", alias="CORS_ORIGINS")
    CORS_ALLOW_CREDENTIALS: bool = True
    cors_allow_methods_raw: str = Field(default="", alias="CORS_ALLOW_METHODS")
    cors_allow_headers_raw: str = Field(default="", alias="CORS_ALLOW_HEADERS")

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # ==================== OpenRouter Settings ====================
    # API key for OpenRouter - provides access to multiple LLM providers
    OPENROUTER_API_KEY: str = Field(
        default="",
        description="OpenRouter API key for multi-model LLM access",
    )
    # Application name shown in OpenRouter dashboard
    OPENROUTER_APP_NAME: str = "Estimate AI"
    # HTTP referer for OpenRouter requests (used for tracking)
    OPENROUTER_HTTP_REFERER: str = Field(
        default="http://localhost:3000",
        description="HTTP referer for OpenRouter API requests",
    )

    # ==================== LLM Settings ====================
    # Default temperature for LLM requests (0.0 = deterministic, 2.0 = creative)
    LLM_DEFAULT_TEMPERATURE: float = Field(
        default=0.3,
        ge=0.0,
        le=2.0,
        description="Default sampling temperature for LLM requests",
    )
    # Default maximum tokens for LLM responses
    LLM_DEFAULT_MAX_TOKENS: int = Field(
        default=4096,
        ge=256,
        le=16384,
        description="Default maximum tokens for LLM responses",
    )
    # Request timeout in seconds
    LLM_REQUEST_TIMEOUT: int = Field(
        default=120,
        ge=30,
        le=600,
        description="Timeout in seconds for LLM API requests",
    )

    # ==================== RAG Settings ====================
    # Number of similar documents to retrieve
    RAG_TOP_K_RESULTS: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of similar documents to retrieve for RAG",
    )
    # Minimum similarity score for retrieval (0-1)
    RAG_SIMILARITY_THRESHOLD: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score for RAG retrieval",
    )
    # Embedding vector dimensions (must match the embedding model)
    EMBEDDING_DIMENSIONS: int = Field(
        default=1536,
        description="Dimensions for embedding vectors (OpenAI text-embedding-3-small)",
    )
    # Maximum context length for RAG
    RAG_MAX_CONTEXT_LENGTH: int = Field(
        default=8000,
        ge=1000,
        le=32000,
        description="Maximum character length for RAG context",
    )
    # Reference estimates (similar quotes) for calibration band and context
    RAG_REFERENCE_TOP_K: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of similar quotes to retrieve for reference estimates and calibration band",
    )
    RAG_REFERENCE_SIMILARITY_THRESHOLD: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score for reference-estimates RAG retrieval (similar quotes)",
    )

    # ==================== Knowledge Base Settings ====================
    # Path to knowledge base files (relative to project root)
    KNOWLEDGE_BASE_PATH: str = "knowledge-based"
    # Chunk size for document embedding (in tokens; ~4 chars per token for English)
    KNOWLEDGE_CHUNK_SIZE: int = Field(
        default=512,
        ge=100,
        le=2000,
        description="Token size for document chunks (used with tiktoken)",
    )
    # Overlap between chunks (in tokens)
    KNOWLEDGE_CHUNK_OVERLAP: int = Field(
        default=50,
        ge=0,
        le=200,
        description="Token overlap between document chunks",
    )

    # ==================== URL Scraping (Reference URLs for Estimation) ====================
    # When enabled, URLs in description/instructions/docs are scraped (screenshot + text)
    # and added to the project brief. Set to False to disable (e.g. no browser/Chromium in env).
    ENABLE_URL_SCRAPING: bool = Field(
        default=True,
        description="Enable scraping of reference URLs found in project content",
    )
    MAX_REFERENCE_URLS: int = Field(
        default=4,
        ge=1,
        le=10,
        description="Maximum number of reference URLs to scrape per request",
    )
    URL_SCRAPE_TIMEOUT_SEC: int = Field(
        default=18,
        ge=5,
        le=120,
        description="Timeout in seconds per URL when scraping (Playwright)",
    )
    # Maximum character length for the combined reference URL block in the brief
    URL_REFERENCE_CONTEXT_MAX_CHARS: int = Field(
        default=12_000,
        ge=1000,
        le=50_000,
        description="Cap for reference URL context (scraped text + vision descriptions)",
    )
    # Allowed URL schemes (stored as str from env to avoid JSON decode errors)
    allowed_url_schemes_raw: str = Field(
        default="",
        alias="ALLOWED_URL_SCHEMES",
        description="URL schemes allowed for reference scraping (e.g. https,http)",
    )

    # ==================== Site crawl (full-site screenshots from one URL) ====================
    # When enabled, "crawl=full" preview discovers same-host pages (sitemap + links) and scrapes each.
    SITE_CRAWL_ENABLED: bool = Field(
        default=True,
        description="Enable full-site crawl from a seed URL (discover + scrape all pages)",
    )
    MAX_SITE_PAGES: int = Field(
        default=12,
        ge=1,
        le=50,
        description="Maximum number of pages to discover and scrape when crawling a site",
    )
    SITE_CRAWL_DEPTH: int = Field(
        default=2,
        ge=1,
        le=3,
        description="Crawl depth: 1=seed+same-page links, 2=one more hop from those pages",
    )
    SITE_CRAWL_TIMEOUT_SEC: int = Field(
        default=55,
        ge=30,
        le=300,
        description="Total timeout in seconds for the crawl phase (discovering URLs)",
    )

    # ==================== Reference site video (optional; was Playwright) ====================
    # When set, full-site preview can record a video of the crawl (navigate through each page).
    # Directory must exist and be writable; leave empty to disable video recording.
    REFERENCE_VIDEO_STORAGE_PATH: str = Field(
        default="",
        description="Directory to store reference site videos (e.g. /tmp/estimate-ai-videos). Empty = disabled.",
    )
    REFERENCE_VIDEO_SECONDS_PER_PAGE: int = Field(
        default=3,
        ge=1,
        le=15,
        description="Seconds to stay on each page while recording (viewport + interactions visible)",
    )

    # List-like settings: stored as str from env, exposed as list via properties
    @property
    def ALLOWED_FILE_TYPES(self) -> list[str]:
        return _parse_list_env(self.allowed_file_types_raw, _DEFAULT_ALLOWED_FILE_TYPES)

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return _parse_list_env(self.cors_origins_raw, _DEFAULT_CORS_ORIGINS)

    @property
    def CORS_ALLOW_METHODS(self) -> list[str]:
        return _parse_list_env(self.cors_allow_methods_raw, _DEFAULT_CORS_METHODS)

    @property
    def CORS_ALLOW_HEADERS(self) -> list[str]:
        return _parse_list_env(self.cors_allow_headers_raw, _DEFAULT_CORS_HEADERS)

    @property
    def ALLOWED_URL_SCHEMES(self) -> list[str]:
        raw = (self.allowed_url_schemes_raw or "").strip()
        if not raw:
            return _DEFAULT_ALLOWED_URL_SCHEMES.copy()
        return [s.strip().lower() for s in raw.split(",") if s.strip()] or _DEFAULT_ALLOWED_URL_SCHEMES.copy()

    _DEFAULT_SECRET_KEY = "CHANGE_THIS_TO_A_SECURE_SECRET_KEY_IN_PRODUCTION"

    @model_validator(mode="after")
    def validate_secret_key_not_default(self) -> "Settings":
        """Reject the default SECRET_KEY when not in development mode."""
        if (
            self.SECRET_KEY == self._DEFAULT_SECRET_KEY
            and self.ENVIRONMENT != "development"
        ):
            raise ValueError(
                "SECRET_KEY must be changed from the default value in "
                f"{self.ENVIRONMENT} environment. Generate a secure key with: "
                "python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return self

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure the database URL uses asyncpg driver."""
        if not v.startswith("postgresql+asyncpg://"):
            # Convert standard PostgreSQL URL to asyncpg
            if v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    @property
    def max_file_size_bytes(self) -> int:
        """Return max file size in bytes."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "production"

    @property
    def database_url_sync(self) -> str:
        """Return synchronous database URL for Alembic migrations."""
        return self.DATABASE_URL.replace(
            "postgresql+asyncpg://", "postgresql+psycopg://"
        )


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Returns:
        Settings: Application settings singleton.
    """
    return Settings()


# Global settings instance
settings = get_settings()
