"""
Document model for real-time collaborative editing.

This module defines the Document model that stores document content
for quotes and proposals with WebSocket-based real-time collaboration.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class DocumentType(str, enum.Enum):
    """Document type enumeration."""

    QUOTE = "quote"
    PROPOSAL = "proposal"
    REQUIREMENTS = "requirements"
    NOTES = "notes"


class Document(Base, UUIDMixin, TimestampMixin):
    """
    Document model for real-time collaborative editing.

    Stores document content in JSON format for rich text editing,
    supporting WebSocket-based real-time collaboration.

    Attributes:
        id: Unique identifier (UUID).
        project_id: Reference to the parent project.
        title: Document title.
        content: Document content as JSON (for rich text editors).
        document_type: Type of document (quote, proposal, etc.).
        version: Document version number for conflict resolution.
        created_by: User who created the document.
        last_edited_by: User who last edited the document.
        extra_data: Additional metadata.
        created_at: Timestamp when document was created.
        updated_at: Timestamp when document was last updated.
    """

    __tablename__ = "documents"

    # Project relationship
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Reference to parent project",
    )

    # Document information
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Document title",
    )

    content: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Document content as JSON (rich text editor format)",
    )

    # Plain text content for search/preview
    plain_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Plain text version of content for search/preview",
    )

    # Document type
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(
            DocumentType,
            name="document_type",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=DocumentType.QUOTE,
        index=True,
        doc="Type of document",
    )

    # Version control for conflict resolution
    version: Mapped[int] = mapped_column(
        nullable=False,
        default=1,
        doc="Document version for conflict resolution",
    )

    # Ownership
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who created this document",
    )

    last_edited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User who last edited this document",
    )

    # Additional metadata
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Additional metadata",
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="documents",
        lazy="selectin",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    last_editor: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[last_edited_by],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        """Return string representation of Document."""
        return f"<Document(id={self.id}, title={self.title}, type={self.document_type.value})>"

    @property
    def is_empty(self) -> bool:
        """Check if document has no content."""
        return self.content is None or not self.content
