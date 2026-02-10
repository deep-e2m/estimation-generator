"""
FastAPI application entry point.

This module initializes the FastAPI application with all middleware,
routes, and event handlers.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import auth, chat, documents, knowledge, projects, quotes
from app.config import settings
from app.core.database import close_db_connection, init_db_connection

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format=settings.LOG_FORMAT,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler for startup and shutdown events.

    Args:
        app: FastAPI application instance.

    Yields:
        None
    """
    # Startup
    logger.info("Starting up %s v%s", settings.APP_NAME, settings.APP_VERSION)
    logger.info("Environment: %s", settings.ENVIRONMENT)

    # Initialize database connection pool
    await init_db_connection()
    logger.info("Database connection pool initialized")

    yield

    # Shutdown
    logger.info("Shutting down %s", settings.APP_NAME)

    # Close database connection pool
    await close_db_connection()
    logger.info("Database connection pool closed")


def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        FastAPI: Configured FastAPI application instance.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "AI-powered quote generation assistant API for creating professional "
            "software development estimates and proposals."
        ),
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # Register exception handlers
    register_exception_handlers(app)

    # Include API routers
    app.include_router(
        auth.router,
        prefix=f"{settings.API_V1_PREFIX}/auth",
        tags=["Authentication"],
    )

    app.include_router(
        projects.router,
        prefix=f"{settings.API_V1_PREFIX}/projects",
        tags=["Projects"],
    )

    app.include_router(
        quotes.router,
        prefix=f"{settings.API_V1_PREFIX}",
        tags=["Quotes"],
    )

    app.include_router(
        chat.router,
        prefix=f"{settings.API_V1_PREFIX}",
        tags=["Chat"],
    )

    app.include_router(
        knowledge.router,
        prefix=f"{settings.API_V1_PREFIX}/knowledge",
        tags=["Knowledge Base"],
    )

    app.include_router(
        documents.router,
        prefix=f"{settings.API_V1_PREFIX}",
        tags=["Documents"],
    )

    return app


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register global exception handlers.

    Args:
        app: FastAPI application instance.
    """

    @app.exception_handler(Exception)
    async def _global_exception_handler(  # pyright: ignore[reportUnusedFunction]
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Handle unexpected exceptions."""
        logger.exception(
            "Unhandled exception for %s %s: %s",
            request.method,
            request.url.path,
            str(exc),
        )

        # Don't expose internal errors in production
        if settings.is_production:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "success": False,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "An unexpected error occurred. Our team has been notified.",
                    },
                },
            )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(exc),
                    "type": type(exc).__name__,
                },
            },
        )


# Create the application instance
app = create_application()


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """
    Health check endpoint.

    Returns:
        dict: Health status of the application.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
async def root() -> dict:
    """
    Root endpoint returning API information.

    Returns:
        dict: API information.
    """
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs_url": "/docs" if settings.DEBUG else "Disabled in production",
        "health_url": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
