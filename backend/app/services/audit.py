"""
Audit logging service.

Append-only audit trail. Call log_action() after state-changing or
security-sensitive actions. Never update or delete audit entries.
"""

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import ActionOutcome, AuditLog

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User

logger = logging.getLogger(__name__)


def with_admin_bypass(
    metadata: dict | None,
    project: "Project",
    current_user: "User",
) -> dict:
    """
    Merge metadata with admin_bypass flag when admin accesses a resource they don't own.

    Use for audit logs on project-scoped actions. When an admin performs an action
    on a project they do not own, adds admin_bypass: True for compliance monitoring.
    """
    meta = dict(metadata or {})
    if current_user.is_admin and project.created_by != current_user.id:
        meta["admin_bypass"] = True
    return meta


async def log_action(
    db: AsyncSession,
    actor_user_id: UUID,
    actor_role: str,
    action: str,
    outcome: ActionOutcome = ActionOutcome.SUCCESS,
    resource_type: str | None = None,
    resource_id: UUID | None = None,
    project_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    metadata: dict | None = None,
    *,
    flush_only: bool = False,
) -> AuditLog:
    """
    Append an audit log entry. Call after action succeeds or fails.

    When flush_only=True, only adds and flushes (no commit). Use when the
    caller will commit in the same request to avoid mid-request commit and
    async session/greenlet issues (e.g. in login flow).

    Does not raise; logs errors so main flow is never broken by audit failures.
    """
    try:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            outcome=outcome,
            resource_type=resource_type,
            resource_id=resource_id,
            project_id=project_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            metadata_=metadata,
        )
        db.add(entry)
        if flush_only:
            await db.flush()
            return entry
        await db.commit()
        await db.refresh(entry)
        return entry
    except Exception as e:
        logger.exception("Audit log write failed: %s", e)
        await db.rollback()
        raise
