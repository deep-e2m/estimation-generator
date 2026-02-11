"""
Project model for quote generation application.

This module defines the Project model that represents client projects
for which quotes are generated.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.chat_message import ChatMessage
    from app.models.client import Client
    from app.models.document import Document
    from app.models.quote import Quote
    from app.models.user import User


class Platform(str, enum.Enum):
    """
    Supported e-commerce platforms.

    Currently only WordPress is supported.
    """

    WORDPRESS = "wordpress"


class ProjectStatus(str, enum.Enum):
    """
    Project status enumeration.

    Tracks the lifecycle state of a project.
    """

    ACTIVE = "active"
    ARCHIVED = "archived"
    COMPLETED = "completed"


class Project(Base, UUIDMixin, TimestampMixin):
    """
    Project model for organizing quotes and chat conversations.

    A project represents a client engagement for which one or more
    quotes may be generated. It serves as the parent container for
    quotes and chat messages.

    Attributes:
        id: Unique identifier (UUID).
        name: Project name (max 500 characters).
        description: Optional detailed project description.
        additional_instructions: Optional additional information or instructions.
        platform: Target e-commerce platform.
        status: Current project status.
        created_by: UUID of the user who created the project.
        created_at: Timestamp when project was created.
        updated_at: Timestamp when project was last updated.
    """

    __tablename__ = "projects"

    # Project information
    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Project name",
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Detailed project description",
    )

    additional_instructions: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Additional information or instructions for the project",
    )

    # Client relationship
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Client associated with this project (optional)",
    )

    # Platform selection
    platform: Mapped[Platform] = mapped_column(
        Enum(
            Platform,
            name="platform_type",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
        doc="Target e-commerce platform",
    )

    # Status tracking
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(
            ProjectStatus,
            name="project_status",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=ProjectStatus.ACTIVE,
        index=True,
        doc="Current project status",
    )

    # Ownership
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who created this project",
    )

    # Relationships (lazy="select" by default — use selectinload() in queries where eager loading is needed)
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="projects",
    )

    client: Mapped[Optional["Client"]] = relationship(
        "Client",
        foreign_keys=[client_id],
        back_populates="projects",
    )

    quotes: Mapped[list["Quote"]] = relationship(
        "Quote",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        """Return string representation of Project."""
        return f"<Project(id={self.id}, name={self.name}, platform={self.platform.value})>"

    @property
    def is_active(self) -> bool:
        """Check if project is currently active."""
        return self.status == ProjectStatus.ACTIVE

    @property
    def is_completed(self) -> bool:
        """Check if project is completed."""
        return self.status == ProjectStatus.COMPLETED
