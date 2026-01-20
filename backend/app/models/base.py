"""
SQLAlchemy base model and mixins.

This module provides the declarative base and common mixins
for all database models.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column


# Naming convention for database constraints
# This ensures consistent naming across all migrations
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """
    SQLAlchemy declarative base class.

    All models should inherit from this class.
    """

    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    # Enable JSON serialization helper
    def to_dict(self) -> dict[str, Any]:
        """
        Convert model instance to dictionary.

        Returns:
            dict: Dictionary representation of the model.
        """
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                value = value.isoformat()
            elif isinstance(value, uuid.UUID):
                value = str(value)
            result[column.name] = value
        return result


class TimestampMixin:
    """
    Mixin that adds created_at and updated_at timestamp columns.

    Usage:
        class MyModel(Base, TimestampMixin):
            __tablename__ = "my_table"
            # ... other columns
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Timestamp when the record was created",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        doc="Timestamp when the record was last updated",
    )


class UUIDMixin:
    """
    Mixin that adds a UUID primary key column.

    Usage:
        class MyModel(Base, UUIDMixin):
            __tablename__ = "my_table"
            # ... other columns (no need to define 'id')
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Unique identifier for the record",
    )


class SoftDeleteMixin:
    """
    Mixin that adds soft delete functionality.

    Adds an is_active flag and deleted_at timestamp for soft deletes.

    Usage:
        class MyModel(Base, SoftDeleteMixin):
            __tablename__ = "my_table"
            # ... other columns
    """

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        doc="Whether the record is active (False = soft deleted)",
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        doc="Timestamp when the record was soft deleted",
    )


class TableNameMixin:
    """
    Mixin that automatically generates table name from class name.

    Converts CamelCase to snake_case and pluralizes.

    Usage:
        class UserAccount(Base, TableNameMixin):
            # __tablename__ will be "user_accounts"
            pass
    """

    @declared_attr.directive
    @classmethod
    def __tablename__(cls) -> str:
        """Generate table name from class name."""
        import re

        # Convert CamelCase to snake_case
        name = re.sub(r"(?<!^)(?=[A-Z])", "_", cls.__name__).lower()

        # Simple pluralization (add 's' if not ending in 's')
        if not name.endswith("s"):
            name += "s"

        return name
