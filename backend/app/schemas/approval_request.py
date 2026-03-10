"""
Approval request schemas for estimation approval workflow API.

This module defines Pydantic schemas for sending projects for approval
and responding to approval requests.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.approval_request import ApprovalStatus
from app.schemas.auth import UserResponse


class ApprovalRequestCreate(BaseModel):
    """Schema for sending a project for approval (single assignee)."""

    assigned_to: UUID = Field(
        ...,
        description="UUID of the Superior PM to assign the approval request to",
    )


class ApprovalRequestCreateBulk(BaseModel):
    """Schema for sending a project for approval to multiple Superior PMs."""

    assigned_to: list[UUID] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="UUIDs of Superior PMs to assign approval requests to",
    )


class ApprovalDecision(BaseModel):
    """Schema for Super PM approve/disapprove decision."""

    approved: bool = Field(
        ...,
        description="True to approve, False to disapprove",
    )
    reason: str | None = Field(
        default=None,
        description="Required when approved=False (disapproval reason)",
    )

    @model_validator(mode="after")
    def reason_required_on_disapprove(self) -> "ApprovalDecision":
        """Require reason when disapproving."""
        if not self.approved and (not self.reason or not self.reason.strip()):
            raise ValueError("Disapproval reason is required when approved is False")
        return self


class ApprovalRequestResponse(BaseModel):
    """Schema for approval request in API responses.

    Always build from explicit (id, project_id, requested_by UserResponse,
    assigned_to UserResponse, ...). Do not use model_validate(orm_request) —
    the ORM has requested_by/assigned_to as UUIDs and relationships may not
    load in async context.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Approval request ID")
    project_id: UUID = Field(..., description="Project ID")
    project_name: str | None = Field(None, description="Project name for display")
    requested_by: UserResponse = Field(
        ...,
        description="User who sent for approval",
    )
    assigned_to: UserResponse = Field(
        ...,
        description="Superior PM assigned to approve",
    )
    status: ApprovalStatus = Field(..., description="Current status")
    disapproval_reason: str | None = Field(None, description="Reason when disapproved")
    created_at: datetime = Field(..., description="When the request was created")
    updated_at: datetime = Field(..., description="When the request was last updated")
    responded_at: datetime | None = Field(None, description="When the Super PM responded")
