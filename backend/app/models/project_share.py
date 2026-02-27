"""
Project share model for RBAC and project collaboration.

This module defines the ProjectShare model for sharing projects
with other users and the AccessLevel enum for granular permissions.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class AccessLevel(str, enum.Enum):
    """
    Access level for project sharing.

    Defines what a shared user can do with the project.
    """

    READ = "read"
    EDIT_CONTENT = "edit_content"
    EDIT_ESTIMATION = "edit_estimation"
    EDIT_FULL = "edit_full"


class ProjectShare(Base, UUIDMixin, TimestampMixin):
    """
    Project share model for sharing projects with other users.

    Attributes:
        id: Unique identifier (UUID).
        project_id: UUID of the shared project.
        shared_with_user_id: UUID of the user the project is shared with.
        shared_by_user_id: UUID of the user who shared the project.
        access_level: Level of access granted.
        created_at: Timestamp when share was created.
        updated_at: Timestamp when share was last updated.
    """

    __tablename__ = "project_shares"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Project being shared",
    )

    shared_with_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User the project is shared with",
    )

    shared_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who shared the project",
    )

    access_level: Mapped[AccessLevel] = mapped_column(
        Enum(
            AccessLevel,
            name="access_level",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=AccessLevel.READ,
        doc="Level of access granted",
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="shares",
    )

    shared_with_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[shared_with_user_id],
        back_populates="project_shares_received",
    )

    shared_by_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[shared_by_user_id],
        back_populates="project_shares_given",
    )

    def __repr__(self) -> str:
        """Return string representation of ProjectShare."""
        return (
            f"<ProjectShare(project_id={self.project_id}, "
            f"shared_with={self.shared_with_user_id}, access={self.access_level.value})>"
        )
