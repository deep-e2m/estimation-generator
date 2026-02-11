"""
API dependencies for authentication and database access.

This module provides FastAPI dependencies for route protection
and database session management.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.core.security import TokenValidationError, verify_access_token
from app.models.project import Project
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# HTTP Bearer token security scheme
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    """
    Dependency to get the current authenticated user.

    Args:
        credentials: HTTP Bearer token credentials.
        db: Database session.

    Returns:
        User: The authenticated user.

    Raises:
        HTTPException: If authentication fails.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_TOKEN_MISSING",
                "message": "Authentication token is required",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = verify_access_token(credentials.credentials)
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "AUTH_TOKEN_INVALID",
                    "message": "Invalid authentication token",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Fetch user from database
        result = await db.execute(
            select(User).where(
                User.id == UUID(user_id),
                User.is_active == True,  # noqa: E712
            )
        )
        user = result.scalar_one_or_none()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "AUTH_USER_NOT_FOUND",
                    "message": "User not found or inactive",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    except TokenValidationError as e:
        logger.warning("Token validation failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_TOKEN_EXPIRED" if "expired" in str(e).lower() else "AUTH_TOKEN_INVALID",
                "message": str(e),
            },
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Dependency to get the current active user.

    Args:
        current_user: The current authenticated user.

    Returns:
        User: The active user.

    Raises:
        HTTPException: If user is inactive or locked.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_ACCOUNT_SUSPENDED",
                "message": "Your account has been suspended",
            },
        )

    if current_user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_ACCOUNT_LOCKED",
                "message": "Your account is temporarily locked due to too many failed login attempts",
            },
        )

    return current_user


async def get_current_verified_user(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency to get the current verified user.

    Args:
        current_user: The current active user.

    Returns:
        User: The verified user.

    Raises:
        HTTPException: If user email is not verified.
    """
    if not current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_EMAIL_NOT_VERIFIED",
                "message": "Please verify your email address before accessing this resource",
            },
        )

    return current_user


async def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency to get the current admin user.

    Args:
        current_user: The current active user.

    Returns:
        User: The admin user.

    Raises:
        HTTPException: If user is not an admin.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_ADMIN_REQUIRED",
                "message": "Admin privileges required for this action",
            },
        )

    return current_user


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
VerifiedUser = Annotated[User, Depends(get_current_verified_user)]
AdminUser = Annotated[User, Depends(get_current_admin_user)]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]


# ---------------------------------------------------------------------------
# Shared access-control helpers
# ---------------------------------------------------------------------------


def api_error(status_code: int, code: str, message: str) -> HTTPException:
    """Create an HTTPException with a standardised error body."""
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


async def get_project_with_access(
    project_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> Project:
    """
    Fetch a project by ID and verify the user has access.

    Loads the ``creator`` and ``client`` relationships eagerly so
    callers don't need to issue follow-up queries for common fields.

    Raises:
        HTTPException 404: project not found.
        HTTPException 403: user is not the owner and not an admin.
    """
    query = (
        select(Project)
        .options(selectinload(Project.creator), selectinload(Project.client))
        .where(Project.id == project_id)
    )
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if project is None:
        raise api_error(404, "PROJECT_NOT_FOUND", "Project not found")

    if project.created_by != current_user.id and not current_user.is_admin:
        raise api_error(403, "ACCESS_DENIED", "You don't have access to this project")

    return project
