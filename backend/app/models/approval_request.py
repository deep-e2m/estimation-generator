"""
Approval request model for estimation approval workflow.

This module defines the ApprovalRequest model for sending project
estimations to Superior PMs for approval/disapproval.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ApprovalStatus(str, enum.Enum):
    """
    Approval request status enumeration.
    """

    PENDING = "pending"
    APPROVED = "approved"
    DISAPPROVED = "disapproved"


class ApprovalRequest(Base, UUIDMixin, TimestampMixin):
    """
    Approval request model for estimation approval workflow.

    When a PM sends a project estimation for approval, an ApprovalRequest
    is created and assigned to a Superior PM who can approve or disapprove.

    Attributes:
        id: Unique identifier (UUID).
        project_id: UUID of the project being approved.
        requested_by: UUID of the user who sent for approval (PM).
        assigned_to: UUID of the Superior PM assigned to approve.
        status: Current approval status.
        disapproval_reason: Required text when status is DISAPPROVED.
        responded_at: Timestamp when Super PM responded.
        created_at: Timestamp when request was created.
        updated_at: Timestamp when request was last updated.
    """

    __tablename__ = "approval_requests"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Project sent for approval",
    )

    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who sent for approval",
    )

    assigned_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Superior PM assigned to approve",
    )

    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(
            ApprovalStatus,
            name="approval_status",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ApprovalStatus.PENDING,
        index=True,
        doc="Current approval status",
    )

    disapproval_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Reason when disapproved (required on disapprove)",
    )

    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When the assigned Super PM responded",
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="approval_requests",
    )

    requester: Mapped["User"] = relationship(
        "User",
        foreign_keys=[requested_by],
        back_populates="approval_requests_sent",
    )

    assignee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[assigned_to],
        back_populates="approval_requests_received",
    )

    def __repr__(self) -> str:
        """Return string representation of ApprovalRequest."""
        return (
            f"<ApprovalRequest(project_id={self.project_id}, "
            f"assigned_to={self.assigned_to}, status={self.status.value})>"
        )
