"""
Database connection and session management.

This module provides async database connectivity using SQLAlchemy
with asyncpg driver for PostgreSQL.
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import settings

logger = logging.getLogger(__name__)

# Global engine instance
_engine: AsyncEngine | None = None

# Session factory
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """
    Get or create the SQLAlchemy async engine.

    Returns:
        AsyncEngine: SQLAlchemy async engine instance.

    Raises:
        RuntimeError: If database connection is not initialized.
    """
    global _engine

    if _engine is None:
        raise RuntimeError(
            "Database connection not initialized. Call init_db_connection() first."
        )

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Get the async session factory.

    Returns:
        async_sessionmaker: Session factory for creating async sessions.

    Raises:
        RuntimeError: If database connection is not initialized.
    """
    global _async_session_factory

    if _async_session_factory is None:
        raise RuntimeError(
            "Database connection not initialized. Call init_db_connection() first."
        )

    return _async_session_factory


async def init_db_connection() -> None:
    """
    Initialize the database connection pool.

    Creates the async engine and session factory. Should be called
    during application startup.
    """
    global _engine, _async_session_factory

    logger.info("Initializing database connection to: %s", settings.DATABASE_URL[:50] + "...")

    # Use NullPool for testing or when connection pooling is handled externally
    pool_class = NullPool if settings.ENVIRONMENT == "test" else None

    engine_kwargs = {
        "echo": settings.DATABASE_ECHO,
        "pool_pre_ping": True,
    }

    # Add connection pool settings for non-test environments
    if pool_class is None:
        engine_kwargs.update({
            "pool_size": settings.DATABASE_POOL_SIZE,
            "max_overflow": settings.DATABASE_MAX_OVERFLOW,
            "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
            "pool_recycle": settings.DATABASE_POOL_RECYCLE,
        })
    else:
        engine_kwargs["poolclass"] = pool_class

    _engine = create_async_engine(
        settings.DATABASE_URL,
        **engine_kwargs,
    )

    _async_session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    logger.info("Database connection pool initialized successfully")


async def close_db_connection() -> None:
    """
    Close the database connection pool.

    Should be called during application shutdown to properly
    clean up database connections.
    """
    global _engine, _async_session_factory

    if _engine is not None:
        logger.info("Closing database connection pool")
        await _engine.dispose()
        _engine = None
        _async_session_factory = None
        logger.info("Database connection pool closed successfully")


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get a database session.

    Yields:
        AsyncSession: Database session for the current request.

    Example:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db_session)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    session_factory = get_session_factory()

    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_session_no_commit() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get a database session without auto-commit.

    Use this when you need manual transaction control.

    Yields:
        AsyncSession: Database session for the current request.
    """
    session_factory = get_session_factory()

    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
