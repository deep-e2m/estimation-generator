"""
Audit log schemas for request/response validation.

This module defines Pydantic schemas for audit log endpoints.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.auth import APIResponse
from app.schemas.project import PaginationMeta


class AuditLogResponse(BaseModel):
    """Response schema for a single audit log entry."""

    id: UUID = Field(..., description="Audit log unique identifier")
    actor_user_id: UUID | None = Field(None, description="User who performed the action")
    actor_role: str = Field(..., description="Role of actor at time of action")
    actor_name: str | None = Field(None, description="Actor's full name")
    actor_email: str | None = Field(None, description="Actor's email")
    action: str = Field(..., description="Action code (e.g. auth.login.success)")
    outcome: str = Field(..., description="Action outcome: success or failure")
    resource_type: str | None = Field(None, description="Type of affected resource")
    resource_id: UUID | None = Field(None, description="ID of affected resource")
    project_id: UUID | None = Field(None, description="Project ID if action is project-scoped")
    project_name: str | None = Field(None, description="Project name from join")
    timestamp: datetime = Field(..., description="When the action occurred (UTC)")
    ip_address: str | None = Field(None, description="Client IP address")
    metadata: dict | None = Field(None, description="Action-specific details")


class AuditLogsListResponse(APIResponse):
    """Response schema for audit logs list endpoint."""

    data: list[AuditLogResponse] = Field(..., description="List of audit log entries")
    pagination: PaginationMeta = Field(..., description="Pagination metadata")
