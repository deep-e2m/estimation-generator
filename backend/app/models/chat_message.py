"""
Chat message model for AI conversation history.

This module defines the ChatMessage model that stores the conversation
history between users and the AI assistant for quote generation.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class MessageRole(str, enum.Enum):
    """
    Chat message role enumeration.

    Defines who sent the message in the conversation.
    """

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(Base, UUIDMixin):
    """
    Chat message model for conversation history.

    Stores individual messages in a conversation between users and
    the AI assistant. Messages are organized by project and include
    metadata about the AI model used, tokens consumed, etc.

    Attributes:
        id: Unique identifier (UUID).
        project_id: Reference to the parent project.
        user_id: Reference to the user (null for assistant messages).
        role: Message role (user, assistant, or system).
        content: Message text content.
        attachments: Array of file references as JSONB.
        metadata: Additional metadata (model, tokens, etc.) as JSONB.
        created_at: Timestamp when message was created.
    """

    __tablename__ = "chat_messages"

    # Project relationship
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Reference to parent project",
    )

    # User relationship (optional - null for assistant messages)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="User who sent the message (null for assistant)",
    )

    # Message content
    role: Mapped[MessageRole] = mapped_column(
        Enum(
            MessageRole,
            name="message_role",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
        doc="Role of the message sender",
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Message text content",
    )

    # Attachments and metadata
    attachments: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Array of file references (id, name, type, url)",
    )

    extra_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Additional metadata (model, tokens, latency, etc.)",
    )

    # Timestamp (only created_at, messages are immutable)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        doc="Timestamp when message was created",
    )

    # Relationships (lazy="select" by default — use selectinload() in queries where eager loading is needed)
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="chat_messages",
    )

    user: Mapped["User | None"] = relationship(
        "User",
        back_populates="chat_messages",
    )

    def __repr__(self) -> str:
        """Return string representation of ChatMessage."""
        content_preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"<ChatMessage(id={self.id}, role={self.role.value}, content={content_preview!r})>"

    @property
    def is_user_message(self) -> bool:
        """Check if message is from a user."""
        return self.role == MessageRole.USER

    @property
    def is_assistant_message(self) -> bool:
        """Check if message is from the assistant."""
        return self.role == MessageRole.ASSISTANT

    @property
    def is_system_message(self) -> bool:
        """Check if message is a system message."""
        return self.role == MessageRole.SYSTEM

    @property
    def has_attachments(self) -> bool:
        """Check if message has any attachments."""
        return self.attachments is not None and len(self.attachments) > 0
