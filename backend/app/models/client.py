"""Client model for managing project clients."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Client(Base, UUIDMixin, TimestampMixin):
    """
    Client model for tracking project clients.

    Each user manages their own clients (per-user isolation).
    Clients can be associated with multiple projects.
    """

    __tablename__ = "clients"

    # Client information
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Client name or contact person",
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Client email address",
    )

    # Ownership (per-user clients)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="User who created this client record",
    )

    # Relationships (lazy="select" by default — use selectinload() in queries where eager loading is needed)
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="clients",
    )

    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="client",
    )

    def __repr__(self) -> str:
        return f"<Client(id={self.id}, name={self.name})>"
