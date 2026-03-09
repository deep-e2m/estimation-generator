"""
User model for authentication and authorization.

This module defines the User model with support for different roles
and authentication tracking.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.approval_request import ApprovalRequest
    from app.models.chat_message import ChatMessage
    from app.models.client import Client
    from app.models.project import Project
    from app.models.project_share import ProjectShare
    from app.models.quote import Quote


class UserRole(str, enum.Enum):
    """
    User role enumeration.

    Defines the available roles in the system.
    The enum values (lowercase) match the PostgreSQL enum values.
    """

    ADMIN = "admin"
    PM = "pm"  # Project Manager
    SUPER_PM = "super_pm"  # Superior PM (can approve estimations)
    DEV = "dev"  # Developer


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    User model for authentication and authorization.

    Attributes:
        id: Unique identifier (UUID).
        email: User's email address (unique).
        password_hash: Hashed password using bcrypt.
        full_name: User's full name.
        company_name: User's company name (optional).
        role: User's role (admin or pm).
        is_email_verified: Whether the user's email is verified.
        last_login_at: Timestamp of last successful login.
        avatar_url: URL to user's avatar image (optional).
        refresh_token: Current valid refresh token (hashed).
        created_at: Timestamp when user was created.
        updated_at: Timestamp when user was last updated.
        is_active: Whether the user account is active.
    """

    __tablename__ = "users"

    # Authentication fields
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        doc="User's email address",
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Bcrypt hashed password",
    )

    # Profile fields
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="User's full name",
    )

    company_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="User's company name",
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        doc="URL to user's avatar image",
    )

    # Role and permissions
    # values_callable ensures SQLAlchemy uses enum values (admin, pm) not names (ADMIN, PM)
    # This matches the PostgreSQL enum which stores lowercase values
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            create_constraint=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=UserRole.PM,
        doc="User's role in the system",
    )

    # Email verification
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Whether email has been verified",
    )

    email_verification_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Token for email verification",
    )

    email_verification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When verification email was sent",
    )

    # Password reset
    password_reset_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Token for password reset",
    )

    password_reset_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When password reset token expires",
    )

    # Session management
    refresh_token: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Current refresh token (hashed)",
    )

    refresh_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When refresh token expires",
    )

    # Login tracking
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp of last successful login",
    )

    failed_login_attempts: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        doc="Number of consecutive failed login attempts",
    )

    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Account locked until this timestamp",
    )

    # Relationships (lazy="select" by default — use selectinload() in queries where eager loading is needed)
    clients: Mapped[list["Client"]] = relationship(
        "Client",
        back_populates="creator",
        cascade="all, delete-orphan",
    )

    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="creator",
        cascade="all, delete-orphan",
    )

    created_quotes: Mapped[list["Quote"]] = relationship(
        "Quote",
        foreign_keys="Quote.created_by",
        back_populates="creator",
        cascade="all, delete-orphan",
    )

    approved_quotes: Mapped[list["Quote"]] = relationship(
        "Quote",
        foreign_keys="Quote.approved_by",
        back_populates="approver",
    )

    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="user",
    )

    project_shares_received: Mapped[list["ProjectShare"]] = relationship(
        "ProjectShare",
        foreign_keys="ProjectShare.shared_with_user_id",
        back_populates="shared_with_user",
    )

    project_shares_given: Mapped[list["ProjectShare"]] = relationship(
        "ProjectShare",
        foreign_keys="ProjectShare.shared_by_user_id",
        back_populates="shared_by_user",
    )

    approval_requests_sent: Mapped[list["ApprovalRequest"]] = relationship(
        "ApprovalRequest",
        foreign_keys="ApprovalRequest.requested_by",
        back_populates="requester",
    )

    approval_requests_received: Mapped[list["ApprovalRequest"]] = relationship(
        "ApprovalRequest",
        foreign_keys="ApprovalRequest.assigned_to",
        back_populates="assignee",
    )

    def __repr__(self) -> str:
        """Return string representation of User."""
        return f"<User(id={self.id}, email={self.email}, role={self.role.value})>"

    @property
    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return self.role == UserRole.ADMIN

    @property
    def is_locked(self) -> bool:
        """Check if user account is currently locked."""
        if self.locked_until is None:
            return False
        return datetime.now(self.locked_until.tzinfo) < self.locked_until

    def can_login(self) -> bool:
        """
        Check if user can attempt login.

        Returns:
            bool: True if user can attempt login.
        """
        return self.is_active and not self.is_locked

    @staticmethod
    def can_assign_role(assigner_role: "UserRole", target_role: "UserRole") -> bool:
        """
        Check if a user with assigner_role can assign target_role to another user.
        Prevents privilege escalation: only ADMIN can assign ADMIN/SUPER_PM;
        PM/SUPER_PM can assign PM/DEV; DEV cannot assign any role.

        Role hierarchy: ADMIN > SUPER_PM > PM > DEV
        """
        if assigner_role == UserRole.ADMIN:
            return True
        if assigner_role == UserRole.SUPER_PM:
            return target_role in (UserRole.PM, UserRole.DEV)
        if assigner_role == UserRole.PM:
            return target_role == UserRole.DEV
        return False
