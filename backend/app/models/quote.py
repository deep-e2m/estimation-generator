"""
Quote model for project estimation.

This module defines the Quote model that represents generated
quotes/estimates for client projects.
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class QuoteStatus(str, enum.Enum):
    """
    Quote status enumeration.

    Tracks the lifecycle state of a quote from creation to approval.
    """

    DRAFT = "draft"
    PUBLISHED = "published"
    APPROVED = "approved"
    REJECTED = "rejected"


class Complexity(str, enum.Enum):
    """
    Project complexity levels.

    Used to categorize the complexity of the work being quoted.
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Quote(Base, UUIDMixin, TimestampMixin):
    """
    Quote model for project estimates.

    A quote represents a formal estimate document containing hours,
    costs, and detailed requirements for a project. Quotes go through
    a lifecycle from draft to published to approved/rejected.

    Attributes:
        id: Unique identifier (UUID).
        project_id: Reference to the parent project.
        title: Quote title (max 500 characters).
        content: Full quote document content.
        requirements: Original requirements provided.
        total_hours: Estimated total hours (decimal).
        total_cost: Estimated total cost (decimal).
        platform: Target platform for the quote.
        complexity: Estimated project complexity.
        status: Current quote status.
        created_by: UUID of the user who created the quote.
        approved_by: UUID of the user who approved the quote (optional).
        approved_at: Timestamp when quote was approved (optional).
        metadata: Additional metadata as JSONB.
        created_at: Timestamp when quote was created.
        updated_at: Timestamp when quote was last updated.
    """

    __tablename__ = "quotes"

    # Project relationship
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Reference to parent project",
    )

    # Quote information
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        doc="Quote title",
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Full quote document content",
    )

    requirements: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Original requirements provided",
    )

    # Cost estimation
    total_hours: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        doc="Estimated total hours",
    )

    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        doc="Estimated total cost",
    )

    # Classification
    platform: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Target platform for the quote",
    )

    complexity: Mapped[Complexity] = mapped_column(
        Enum(
            Complexity,
            name="complexity_level",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=Complexity.MEDIUM,
        index=True,
        doc="Estimated project complexity",
    )

    # Status tracking
    status: Mapped[QuoteStatus] = mapped_column(
        Enum(
            QuoteStatus,
            name="quote_status",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=QuoteStatus.DRAFT,
        index=True,
        doc="Current quote status",
    )

    # Ownership and approval
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who created this quote",
    )

    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User who approved this quote",
    )

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp when quote was approved",
    )

    # Additional metadata
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Additional metadata (AI model used, version, etc.)",
    )

    # Relationships (lazy="select" by default — use selectinload() in queries where eager loading is needed)
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="quotes",
    )

    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_quotes",
    )

    approver: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[approved_by],
        back_populates="approved_quotes",
    )

    def __repr__(self) -> str:
        """Return string representation of Quote."""
        return f"<Quote(id={self.id}, title={self.title}, status={self.status.value})>"

    @property
    def is_draft(self) -> bool:
        """Check if quote is in draft status."""
        return self.status == QuoteStatus.DRAFT

    @property
    def is_approved(self) -> bool:
        """Check if quote has been approved."""
        return self.status == QuoteStatus.APPROVED

    @property
    def is_finalized(self) -> bool:
        """Check if quote is in a final state (approved or rejected)."""
        return self.status in (QuoteStatus.APPROVED, QuoteStatus.REJECTED)
