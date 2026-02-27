"""
Audit log model for activity and compliance tracking.

This module defines the AuditLog model for append-only audit trail.
No updated_at or soft delete - entries are immutable once written.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ActionOutcome(str, enum.Enum):
    """Outcome of the audited action."""

    SUCCESS = "success"
    FAILURE = "failure"


class AuditLog(Base, UUIDMixin):
    """
    Append-only audit log entry.

    Tracks who did what, when, and with what outcome. No updates or deletes.
    """

    __tablename__ = "audit_logs"

    # Actor (who did it)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="User who performed the action (null if user was deleted)",
    )
    actor_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Role of the actor at time of action",
    )

    # Action (what happened)
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        doc="Stable action code e.g. auth.login.success, project.created",
    )
    outcome: Mapped[ActionOutcome] = mapped_column(
        Enum(
            ActionOutcome,
            name="action_outcome",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ActionOutcome.SUCCESS,
        index=True,
        doc="Whether the action succeeded or failed",
    )

    # Resource (what was affected)
    resource_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        doc="Type of resource: project, quote, user, share, approval, document",
    )
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        doc="ID of the affected resource",
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Project id when action is project-scoped (denormalized for queries)",
    )

    # Context
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        doc="When the action occurred (UTC)",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        doc="Client IP (IPv4 or IPv6)",
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="User-Agent header",
    )
    request_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="Request id for correlation",
    )

    # Details (old/new values, error messages)
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        doc="Action-specific details (old_role, new_role, reason, etc.)",
    )

    # Relationships
    actor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[actor_user_id],
        backref="audit_logs",
    )
    project: Mapped["Project | None"] = relationship(
        "Project",
        foreign_keys=[project_id],
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action}, outcome={self.outcome.value})>"
