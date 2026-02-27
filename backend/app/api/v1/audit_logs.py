"""
Audit logs API endpoints.

Admin-only endpoints for viewing system-wide activity logs.
"""

import logging
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AdminUser, DbSession
from app.models.audit_log import AuditLog
from app.models.project import Project
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse, AuditLogsListResponse
from app.schemas.project import PaginationMeta

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Audit Logs"])


@router.get("/admin/audit-logs", response_model=AuditLogsListResponse)
async def list_audit_logs(
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    action: str | None = Query(None, description="Filter by action prefix"),
    user_id: UUID | None = Query(None, description="Filter by actor user ID"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    outcome: str | None = Query(None, description="Filter by outcome (success/failure)"),
    start_date: datetime | None = Query(None, description="Filter by start date (UTC)"),
    end_date: datetime | None = Query(None, description="Filter by end date (UTC)"),
) -> AuditLogsListResponse:
    """
    List all audit logs (admin only).

    Supports filtering by action, user, resource type, outcome, and date range.
    Pagination is required. Returns logs ordered by timestamp descending (most recent first).
    """
    logger.info("Admin %s requested audit logs: page=%d, per_page=%d", current_user.email, page, per_page)

    # Build query with joins to users and projects for names
    query = (
        select(
            AuditLog,
            User.full_name,
            User.email,
            Project.name.label("project_name"),
        )
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .outerjoin(Project, AuditLog.project_id == Project.id)
        .order_by(AuditLog.timestamp.desc())
    )

    # Apply filters
    if action:
        query = query.where(AuditLog.action.like(f"{action}%"))
    if user_id:
        query = query.where(AuditLog.actor_user_id == user_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if outcome:
        query = query.where(AuditLog.outcome == outcome)
    if start_date:
        query = query.where(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.where(AuditLog.timestamp <= end_date)

    # Get total count
    count_query = select(func.count()).select_from(
        query.alias()
    )
    total = await db.scalar(count_query) or 0

    # Paginate
    offset = (page - 1) * per_page
    results = await db.execute(query.offset(offset).limit(per_page))
    rows = results.all()

    # Map to response
    logs = []
    for row in rows:
        audit_log = row[0]
        actor_name = row[1]
        actor_email = row[2]
        project_name = row[3]

        logs.append(
            AuditLogResponse(
                id=audit_log.id,
                actor_user_id=audit_log.actor_user_id,
                actor_role=audit_log.actor_role,
                actor_name=actor_name,
                actor_email=actor_email,
                action=audit_log.action,
                outcome=audit_log.outcome.value,
                resource_type=audit_log.resource_type,
                resource_id=audit_log.resource_id,
                project_id=audit_log.project_id,
                project_name=project_name,
                timestamp=audit_log.timestamp,
                ip_address=audit_log.ip_address,
                metadata=audit_log.metadata_,
            )
        )

    total_pages = (total + per_page - 1) // per_page if total > 0 else 0

    return AuditLogsListResponse(
        success=True,
        data=logs,
        pagination=PaginationMeta(
            page=page,
            page_size=per_page,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )
