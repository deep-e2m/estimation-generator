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
from app.models.project_share import AccessLevel, ProjectShare
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


async def get_current_pm_or_above(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency to get the current user if they are PM, Super PM, or Admin.

    Raises:
        HTTPException: If user is not PM, Super PM, or Admin.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_PM, UserRole.PM):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_PM_REQUIRED",
                "message": "Project manager or higher role required",
            },
        )
    return current_user


async def get_current_super_pm_or_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency to get the current user if they are Super PM or Admin.

    Raises:
        HTTPException: If user is not Super PM or Admin.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_PM):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_SUPER_PM_REQUIRED",
                "message": "Superior PM or admin required for this action",
            },
        )
    return current_user


async def get_current_super_pm(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """
    Dependency to get the current user if they are Super PM only.
    Admin is tech-level and does not participate in the approval workflow.

    Raises:
        HTTPException: If user is not Super PM.
    """
    if current_user.role != UserRole.SUPER_PM:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_SUPER_PM_REQUIRED",
                "message": "Superior PM required for approval actions",
            },
        )
    return current_user


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
VerifiedUser = Annotated[User, Depends(get_current_verified_user)]
AdminUser = Annotated[User, Depends(get_current_admin_user)]
PmOrAbove = Annotated[User, Depends(get_current_pm_or_above)]
SuperPmOrAdmin = Annotated[User, Depends(get_current_super_pm_or_admin)]
SuperPmOnly = Annotated[User, Depends(get_current_super_pm)]
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

    Access is granted if the user is the owner, an admin, or has a project share.
    Loads the ``creator`` and ``client`` relationships eagerly.

    Raises:
        HTTPException 404: project not found.
        HTTPException 403: user has no access.
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

    if project.created_by == current_user.id or current_user.is_admin:
        return project

    # Check project share
    share_result = await db.execute(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.shared_with_user_id == current_user.id,
        )
    )
    if share_result.scalar_one_or_none() is not None:
        return project

    raise api_error(403, "ACCESS_DENIED", "You don't have access to this project")


async def get_project_with_owner_or_admin(
    project_id: UUID,
    current_user: User,
    db: AsyncSession,
) -> Project:
    """
    Fetch a project by ID and verify the user is the owner or an admin.

    Use this for actions only the owner or admin can do (e.g. share, delete).

    Raises:
        HTTPException 404: project not found.
        HTTPException 403: user is not owner and not admin.
    """
    project = await get_project_with_access(project_id, current_user, db)
    if project.created_by != current_user.id and not current_user.is_admin:
        raise api_error(403, "ACCESS_DENIED", "Only the project owner or admin can perform this action")
    return project


def _effective_access_level(project: Project, current_user: User, share: ProjectShare | None) -> AccessLevel:
    """Return the effective access level for a user on a project."""
    if project.created_by == current_user.id or current_user.is_admin:
        return AccessLevel.EDIT_FULL
    if share is not None:
        return share.access_level
    return AccessLevel.READ  # fallback (should not be used when share is required)


async def get_project_with_permission(
    project_id: UUID,
    current_user: User,
    db: AsyncSession,
    required: AccessLevel,
) -> tuple[Project, AccessLevel]:
    """
    Fetch a project and ensure the user has at least the required access level.

    Returns (project, effective_access_level).
    required is one of READ, EDIT_CONTENT, EDIT_ESTIMATION, EDIT_FULL.
    EDIT_FULL implies all others; EDIT_CONTENT and EDIT_ESTIMATION are independent.

    Raises:
        HTTPException 404: project not found.
        HTTPException 403: access denied or insufficient permission.
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

    share_result = await db.execute(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.shared_with_user_id == current_user.id,
        )
    )
    share = share_result.scalar_one_or_none()

    if project.created_by == current_user.id or current_user.is_admin:
        return project, AccessLevel.EDIT_FULL
    if share is None:
        raise api_error(403, "ACCESS_DENIED", "You don't have access to this project")

    effective = share.access_level

    def has_permission(has: AccessLevel, need: AccessLevel) -> bool:
        if need == AccessLevel.READ:
            return True
        if need == AccessLevel.EDIT_FULL:
            return has == AccessLevel.EDIT_FULL
        if need == AccessLevel.EDIT_CONTENT:
            return has in (AccessLevel.EDIT_CONTENT, AccessLevel.EDIT_FULL)
        if need == AccessLevel.EDIT_ESTIMATION:
            return has in (AccessLevel.EDIT_ESTIMATION, AccessLevel.EDIT_FULL)
        return False

    if not has_permission(effective, required):
        raise api_error(
            403,
            "PERMISSION_DENIED",
            f"This action requires {required.value} access or higher",
        )
    return project, effective
