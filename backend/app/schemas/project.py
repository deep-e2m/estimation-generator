"""
Project schemas for request/response validation.

This module defines Pydantic schemas for project-related endpoints
including CRUD operations and listing.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.project import Platform, ProjectStatus
from app.schemas.auth import APIResponse
from app.schemas.client import ClientCreate, ClientResponse


# =============================================================================
# Owner Schema (for project detail)
# =============================================================================


class ProjectOwner(BaseModel):
    """Schema for project owner information."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Owner's unique identifier")
    full_name: str = Field(..., description="Owner's full name")
    email: str = Field(..., description="Owner's email address")
    avatar_url: Optional[str] = Field(None, description="URL to owner's avatar")


# =============================================================================
# Project Base Schemas
# =============================================================================


class ProjectBase(BaseModel):
    """Base project schema with common fields."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Project name",
        examples=["E-commerce Website Redesign"],
    )
    description: Optional[str] = Field(
        default=None,
        description="Detailed project description",
        examples=["Complete redesign of the client's WordPress e-commerce site with new branding"],
    )
    additional_instructions: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Additional information or instructions for the project",
        examples=["Please ensure all forms have custom validation. Client prefers blue color scheme."],
    )
    platform: Optional[Platform] = Field(
        default=Platform.WORDPRESS,
        description="Target e-commerce platform (defaults to WordPress)",
        examples=[Platform.WORDPRESS],
    )


class ProjectCreate(ProjectBase):
    """Schema for project creation request."""

    # Client selection: provide either client_id OR new_client
    client_id: Optional[UUID] = Field(
        default=None,
        description="Existing client ID (if selecting existing client)",
    )

    new_client: Optional[ClientCreate] = Field(
        default=None,
        description="New client data (if creating new client)",
    )

    @model_validator(mode="after")
    def validate_client_selection(self) -> "ProjectCreate":
        """Ensure at most one of client_id or new_client is provided."""
        if self.client_id and self.new_client:
            raise ValueError("Provide either client_id or new_client, not both")
        return self


class ProjectUpdate(BaseModel):
    """Schema for project update request. All fields are optional."""

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
        description="Project name",
    )
    description: Optional[str] = Field(
        default=None,
        description="Detailed project description",
    )
    additional_instructions: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Additional information or instructions for the project",
    )
    platform: Optional[Platform] = Field(
        default=None,
        description="Target e-commerce platform",
    )
    status: Optional[ProjectStatus] = Field(
        default=None,
        description="Project status",
    )


# =============================================================================
# Project Response Schemas
# =============================================================================


class ProjectResponse(BaseModel):
    """Schema for project data in responses (list view)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    additional_instructions: Optional[str] = Field(None, description="Additional information or instructions")
    platform: Platform = Field(..., description="Target e-commerce platform")
    status: ProjectStatus = Field(..., description="Current project status")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    quotes_count: int = Field(
        default=0,
        description="Number of quotes associated with this project",
    )
    # Client information (from relationship)
    client: ClientResponse | None = Field(None, description="Associated client (optional)")


class ProjectDetailResponse(ProjectResponse):
    """Extended project response with owner and team information."""

    owner: ProjectOwner = Field(..., description="Project owner information")
    team_members: list[ProjectOwner] = Field(
        default_factory=list,
        description="List of team members on the project",
    )
    target_completion_date: Optional[str] = Field(
        None,
        description="Target completion date for the project",
    )
    requirements_count: Optional[int] = Field(
        default=0,
        description="Number of requirements for this project",
    )


# =============================================================================
# List Response Schemas
# =============================================================================


class CursorPaginationMeta(BaseModel):
    """Cursor-based pagination metadata schema for frontend compatibility."""

    cursor: Optional[str] = Field(None, description="Cursor for next page")
    has_more: bool = Field(..., description="Whether there are more items")
    total_count: int = Field(..., description="Total number of items")


class PaginationMeta(BaseModel):
    """Page-based pagination metadata schema (aligned with quotes, chat endpoints)."""

    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_items: int = Field(..., description="Total number of items")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")

    @computed_field
    @property
    def total_count(self) -> int:
        """Alias for total_items (frontend compatibility)."""
        return self.total_items


class ProjectListData(BaseModel):
    """Data container for project list response."""

    data: list[ProjectResponse] = Field(..., description="List of projects")
    pagination: PaginationMeta = Field(..., description="Pagination information")


class ProjectListResponse(APIResponse):
    """Response schema for project listing endpoint."""

    data: ProjectListData = Field(..., description="Project list data with pagination")


# =============================================================================
# Single Project Response Schemas
# =============================================================================


class ProjectDataResponse(APIResponse):
    """Response schema for single project operations."""

    data: ProjectResponse = Field(..., description="Project data")


class ProjectDetailDataResponse(APIResponse):
    """Response schema for project detail view."""

    data: ProjectDetailResponse = Field(..., description="Detailed project data")


class ProjectDeleteResponse(APIResponse):
    """Response schema for project deletion."""

    data: dict = Field(
        default={"message": "Project deleted successfully"},
        description="Deletion confirmation",
    )
