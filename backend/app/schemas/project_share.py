"""
Project share schemas for RBAC and project sharing API.

This module defines Pydantic schemas for creating, updating,
and responding with project share data.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.project_share import AccessLevel
from app.schemas.auth import UserResponse


class ProjectShareCreate(BaseModel):
    """Schema for creating a project share."""

    shared_with_user_id: UUID = Field(
        ...,
        description="UUID of the user to share the project with",
    )
    access_level: AccessLevel = Field(
        default=AccessLevel.READ,
        description="Level of access to grant (read, edit_content, edit_estimation, edit_full)",
    )


class ProjectShareUpdate(BaseModel):
    """Schema for updating a project share's access level."""

    access_level: AccessLevel = Field(
        ...,
        description="New access level",
    )


class ProjectShareResponse(BaseModel):
    """Schema for project share in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Share record ID")
    project_id: UUID = Field(..., description="Project ID")
    shared_with_user: UserResponse = Field(..., description="User the project is shared with")
    shared_by_user: UserResponse = Field(..., description="User who shared the project")
    access_level: AccessLevel = Field(..., description="Granted access level")
    created_at: datetime = Field(..., description="When the share was created")
    updated_at: datetime = Field(..., description="When the share was last updated")
