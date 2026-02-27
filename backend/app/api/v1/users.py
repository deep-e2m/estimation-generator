"""
User management API endpoints.

This module provides endpoints for listing users, updating roles, activating/deactivating,
and soft-deleting users (Admin only for mutations).
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import ActiveUser, AdminUser, DbSession, api_error
from app.models.user import User, UserRole
from app.models.audit_log import ActionOutcome
from app.schemas.auth import UserResponse
from app.services import audit

logger = logging.getLogger(__name__)

router = APIRouter()


class UserRoleUpdate(BaseModel):
    """Body for updating a user's role."""

    role: UserRole = Field(..., description="New role")


class UserUpdate(BaseModel):
    """Body for updating a user (admin only)."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[UserRole] = Field(None)
    is_active: Optional[bool] = Field(None)


@router.get(
    "",
    response_model=dict,
    summary="List users",
    description="List users with optional role and is_active filter. Admin can list inactive users.",
    responses={
        200: {"description": "List of users"},
        401: {"description": "Not authenticated"},
    },
)
async def list_users(
    current_user: ActiveUser,
    db: DbSession,
    role: Optional[UserRole] = Query(default=None, description="Filter by role"),
    search: Optional[str] = Query(default=None, max_length=100, description="Search by name or email"),
    is_active: Optional[bool] = Query(
        default=None,
        description="Filter by active status (admin only: omit for all users)",
    ),
) -> dict:
    # Non-admin: only ever see active users
    if current_user.role != UserRole.ADMIN:
        query = select(User).where(User.is_active == True)  # noqa: E712
    else:
        query = select(User)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
    if role is not None:
        query = query.where(User.role == role)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            (User.full_name.ilike(term)) | (User.email.ilike(term))
        )
    query = query.order_by(User.full_name.asc())
    result = await db.execute(query)
    users = list(result.scalars().all())
    items = [UserResponse.model_validate(u) for u in users]
    return {"success": True, "data": items}


@router.put(
    "/{user_id}/role",
    response_model=dict,
    summary="Update user role",
    description="Change a user's role. Admin only.",
    responses={
        200: {"description": "Role updated"},
        400: {"description": "Invalid role or cannot change own role"},
        403: {"description": "Admin required"},
        404: {"description": "User not found"},
    },
)
async def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    current_user: AdminUser,
    db: DbSession,
) -> dict:
    if user_id == current_user.id:
        raise api_error(400, "CANNOT_CHANGE_OWN_ROLE", "You cannot change your own role")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise api_error(404, "USER_NOT_FOUND", "User not found")

    old_role = user.role.value
    user.role = body.role
    await db.commit()
    await db.refresh(user)

    # Audit log: user role changed
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="user.role.changed",
            outcome=ActionOutcome.SUCCESS,
            resource_type="user",
            resource_id=user.id,
            metadata={
                "target_user_id": str(user.id),
                "old_role": old_role,
                "new_role": user.role.value,
            },
        )
    except Exception as e:
        logger.error("Failed to log audit for role change: %s", e)

    return {"success": True, "data": UserResponse.model_validate(user).model_dump()}


@router.patch(
    "/{user_id}",
    response_model=dict,
    summary="Update user",
    description="Update user profile (full_name, role, is_active). Admin only. Cannot change own role or deactivate self.",
    responses={
        200: {"description": "User updated"},
        400: {"description": "Invalid data or cannot change self"},
        403: {"description": "Admin required"},
        404: {"description": "User not found"},
    },
)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    current_user: AdminUser,
    db: DbSession,
) -> dict:
    if user_id == current_user.id:
        if body.role is not None or body.is_active is False:
            raise api_error(
                400,
                "CANNOT_CHANGE_SELF",
                "You cannot change your own role or deactivate your account",
            )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise api_error(404, "USER_NOT_FOUND", "User not found")
    changes = {}
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
        changes["full_name"] = user.full_name
    if body.role is not None:
        old_role = user.role.value
        user.role = body.role
        changes["role"] = user.role.value
        try:
            await audit.log_action(
                db=db,
                actor_user_id=current_user.id,
                actor_role=current_user.role.value,
                action="user.role.changed",
                outcome=ActionOutcome.SUCCESS,
                resource_type="user",
                resource_id=user.id,
                metadata={
                    "target_user_id": str(user.id),
                    "old_role": old_role,
                    "new_role": user.role.value,
                },
            )
        except Exception as e:
            logger.error("Failed to log audit for role change: %s", e)
    if body.is_active is not None:
        user.is_active = body.is_active
        changes["is_active"] = user.is_active
    await db.commit()
    await db.refresh(user)
    return {"success": True, "data": UserResponse.model_validate(user).model_dump()}


@router.delete(
    "/{user_id}",
    response_model=dict,
    summary="Delete user (soft)",
    description="Soft-delete a user (set is_active=False). Admin only. Cannot delete self.",
    responses={
        200: {"description": "User deleted"},
        400: {"description": "Cannot delete self"},
        403: {"description": "Admin required"},
        404: {"description": "User not found"},
    },
)
async def delete_user(
    user_id: UUID,
    current_user: AdminUser,
    db: DbSession,
) -> dict:
    if user_id == current_user.id:
        raise api_error(400, "CANNOT_DELETE_SELF", "You cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise api_error(404, "USER_NOT_FOUND", "User not found")
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="user.deleted",
            outcome=ActionOutcome.SUCCESS,
            resource_type="user",
            resource_id=user.id,
            metadata={"target_user_id": str(user.id)},
        )
    except Exception as e:
        logger.error("Failed to log audit for user delete: %s", e)
    return {"success": True, "data": UserResponse.model_validate(user).model_dump()}
