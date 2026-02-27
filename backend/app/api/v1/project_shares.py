"""
Project share API endpoints.

This module provides endpoints for sharing projects with other users
and managing per-user access levels.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import (
    ActiveUser,
    DbSession,
    PmOrAbove,
    api_error,
    get_project_with_owner_or_admin,
)
from app.models.project_share import AccessLevel, ProjectShare
from app.models.user import User, UserRole
from app.models.audit_log import ActionOutcome
from app.schemas.auth import UserResponse
from app.schemas.project_share import (
    ProjectShareCreate,
    ProjectShareResponse,
    ProjectShareUpdate,
)
from app.services import audit

logger = logging.getLogger(__name__)

router = APIRouter()


def _allowed_access_levels_for_role(role: UserRole) -> list[AccessLevel]:
    """Return access levels allowed when sharing with a user of this role."""
    if role == UserRole.DEV:
        return [AccessLevel.READ, AccessLevel.EDIT_ESTIMATION]
    return [AccessLevel.READ, AccessLevel.EDIT_CONTENT, AccessLevel.EDIT_ESTIMATION, AccessLevel.EDIT_FULL]


@router.post(
    "/{project_id}/shares",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Share project",
    description="Share a project with another user. Owner or admin only. When sharing with a Developer, only read or edit_estimation is allowed.",
    responses={
        201: {"description": "Share created"},
        400: {"description": "Invalid access level for role"},
        403: {"description": "Not owner or admin"},
        404: {"description": "Project or user not found"},
        409: {"description": "Project already shared with this user"},
    },
)
async def create_share(
    project_id: UUID,
    body: ProjectShareCreate,
    current_user: PmOrAbove,
    db: DbSession,
) -> dict:
    await get_project_with_owner_or_admin(project_id, current_user, db)

    # Resolve shared_with user and check role for allowed access levels
    user_result = await db.execute(
        select(User).where(User.id == body.shared_with_user_id, User.is_active == True)  # noqa: E712
    )
    shared_with_user = user_result.scalar_one_or_none()
    if not shared_with_user:
        raise api_error(404, "USER_NOT_FOUND", "User not found")

    allowed = _allowed_access_levels_for_role(shared_with_user.role)
    if body.access_level not in allowed:
        raise api_error(
            400,
            "INVALID_ACCESS_LEVEL",
            f"Allowed access levels for this user's role: {[a.value for a in allowed]}",
        )

    existing = await db.execute(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.shared_with_user_id == body.shared_with_user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise api_error(409, "ALREADY_SHARED", "Project is already shared with this user")

    share = ProjectShare(
        project_id=project_id,
        shared_with_user_id=body.shared_with_user_id,
        shared_by_user_id=current_user.id,
        access_level=body.access_level,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    await db.refresh(share.shared_with_user)
    await db.refresh(share.shared_by_user)

    # Audit log: share created
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="share.created",
            outcome=ActionOutcome.SUCCESS,
            resource_type="share",
            resource_id=share.id,
            project_id=project_id,
            metadata={
                "shared_with_user_id": str(body.shared_with_user_id),
                "access_level": body.access_level.value,
            },
        )
    except Exception as e:
        logger.error("Failed to log audit for share creation: %s", e)

    response_data = ProjectShareResponse(
        id=share.id,
        project_id=share.project_id,
        shared_with_user=UserResponse.model_validate(share.shared_with_user),
        shared_by_user=UserResponse.model_validate(share.shared_by_user),
        access_level=share.access_level,
        created_at=share.created_at,
        updated_at=share.updated_at,
    )
    return {"success": True, "data": response_data.model_dump()}


@router.get(
    "/{project_id}/shares",
    response_model=dict,
    summary="List project shares",
    description="List all shares for a project. Owner or admin only.",
    responses={
        200: {"description": "List of shares"},
        403: {"description": "Not owner or admin"},
        404: {"description": "Project not found"},
    },
)
async def list_shares(
    project_id: UUID,
    current_user: PmOrAbove,
    db: DbSession,
) -> dict:
    await get_project_with_owner_or_admin(project_id, current_user, db)

    result = await db.execute(
        select(ProjectShare)
        .options(
            selectinload(ProjectShare.shared_with_user),
            selectinload(ProjectShare.shared_by_user),
        )
        .where(ProjectShare.project_id == project_id)
        .order_by(ProjectShare.created_at.desc())
    )
    shares = list(result.scalars().all())

    items = [
        ProjectShareResponse(
            id=s.id,
            project_id=s.project_id,
            shared_with_user=UserResponse.model_validate(s.shared_with_user),
            shared_by_user=UserResponse.model_validate(s.shared_by_user),
            access_level=s.access_level,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in shares
    ]
    return {"success": True, "data": items}


@router.put(
    "/{project_id}/shares/{share_id}",
    response_model=dict,
    summary="Update project share",
    description="Update the access level of a share. Owner or admin only. Developer shares can only be set to read or edit_estimation.",
    responses={
        200: {"description": "Share updated"},
        400: {"description": "Invalid access level for role"},
        403: {"description": "Not owner or admin"},
        404: {"description": "Project or share not found"},
    },
)
async def update_share(
    project_id: UUID,
    share_id: UUID,
    body: ProjectShareUpdate,
    current_user: PmOrAbove,
    db: DbSession,
) -> dict:
    await get_project_with_owner_or_admin(project_id, current_user, db)

    result = await db.execute(
        select(ProjectShare)
        .options(
            selectinload(ProjectShare.shared_with_user),
            selectinload(ProjectShare.shared_by_user),
        )
        .where(
            ProjectShare.id == share_id,
            ProjectShare.project_id == project_id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise api_error(404, "SHARE_NOT_FOUND", "Share not found")

    allowed = _allowed_access_levels_for_role(share.shared_with_user.role)
    if body.access_level not in allowed:
        raise api_error(
            400,
            "INVALID_ACCESS_LEVEL",
            f"Allowed access levels for this user's role: {[a.value for a in allowed]}",
        )

    old_access = share.access_level.value
    share.access_level = body.access_level
    await db.commit()
    await db.refresh(share)

    # Audit log: share updated
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="share.updated",
            outcome=ActionOutcome.SUCCESS,
            resource_type="share",
            resource_id=share.id,
            project_id=project_id,
            metadata={
                "shared_with_user_id": str(share.shared_with_user_id),
                "old_access": old_access,
                "new_access": body.access_level.value,
            },
        )
    except Exception as e:
        logger.error("Failed to log audit for share update: %s", e)

    response_data = ProjectShareResponse(
        id=share.id,
        project_id=share.project_id,
        shared_with_user=UserResponse.model_validate(share.shared_with_user),
        shared_by_user=UserResponse.model_validate(share.shared_by_user),
        access_level=share.access_level,
        created_at=share.created_at,
        updated_at=share.updated_at,
    )
    return {"success": True, "data": response_data.model_dump()}


@router.delete(
    "/{project_id}/shares/{share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove project share",
    description="Remove a share. Owner or admin only.",
    responses={
        204: {"description": "Share removed"},
        403: {"description": "Not owner or admin"},
        404: {"description": "Project or share not found"},
    },
)
async def delete_share(
    project_id: UUID,
    share_id: UUID,
    current_user: PmOrAbove,
    db: DbSession,
) -> None:
    await get_project_with_owner_or_admin(project_id, current_user, db)

    result = await db.execute(
        select(ProjectShare).where(
            ProjectShare.id == share_id,
            ProjectShare.project_id == project_id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise api_error(404, "SHARE_NOT_FOUND", "Share not found")

    # Capture for audit log before deletion
    shared_with_user_id = share.shared_with_user_id
    access_level = share.access_level.value

    await db.delete(share)
    await db.commit()

    # Audit log: share removed
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="share.removed",
            outcome=ActionOutcome.SUCCESS,
            resource_type="share",
            resource_id=share_id,
            project_id=project_id,
            metadata={
                "shared_with_user_id": str(shared_with_user_id),
                "access_level": access_level,
            },
        )
    except Exception as e:
        logger.error("Failed to log audit for share removal: %s", e)
