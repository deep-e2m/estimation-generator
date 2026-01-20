"""Create file storage tables.

Revision ID: 20260120_000001
Revises:
Create Date: 2026-01-20 00:00:01.000000

This migration creates the file_uploads and file_blobs tables for
the storage abstraction layer.

Tables:
    file_uploads: Stores metadata for all uploaded files
    file_blobs: Stores binary data for database-backed files

The two-table design separates metadata from binary data for:
    - Efficient metadata queries without loading file content
    - Easy migration from database to S3 (metadata stays, blobs move)
    - Cascade deletion of blobs when uploads are removed
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260120_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create file storage tables."""

    # Create file_uploads table
    op.create_table(
        "file_uploads",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique file identifier",
        ),
        # File information
        sa.Column(
            "filename",
            sa.String(255),
            nullable=False,
            comment="Original filename from client",
        ),
        sa.Column(
            "content_type",
            sa.String(100),
            nullable=False,
            comment="MIME type of the file",
        ),
        sa.Column(
            "file_size_bytes",
            sa.BigInteger,
            nullable=False,
            comment="File size in bytes",
        ),
        # Storage information
        sa.Column(
            "storage_provider",
            sa.String(20),
            nullable=False,
            comment="Storage backend: 'database' or 's3'",
        ),
        sa.Column(
            "storage_key",
            sa.String(1024),
            nullable=False,
            comment="Storage location: 'blob:{id}' or 's3://{bucket}/{key}'",
        ),
        # Ownership and organization
        sa.Column(
            "uploaded_by",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="User ID who uploaded the file",
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Optional project association",
        ),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Upload timestamp",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Last modification timestamp",
        ),
        # Additional metadata
        sa.Column(
            "metadata",
            postgresql.JSONB,
            nullable=True,
            comment="Additional metadata as key-value pairs",
        ),
        # Table constraints
        sa.CheckConstraint(
            "storage_provider IN ('database', 's3')",
            name="ck_file_uploads_storage_provider",
        ),
        sa.CheckConstraint(
            "file_size_bytes >= 0",
            name="ck_file_uploads_file_size_positive",
        ),
        comment="File upload metadata table",
    )

    # Create indexes for file_uploads
    op.create_index(
        "ix_file_uploads_uploaded_by",
        "file_uploads",
        ["uploaded_by"],
    )
    op.create_index(
        "ix_file_uploads_project_id",
        "file_uploads",
        ["project_id"],
    )
    op.create_index(
        "ix_file_uploads_created_at",
        "file_uploads",
        ["created_at"],
    )
    op.create_index(
        "ix_file_uploads_project_created",
        "file_uploads",
        ["project_id", "created_at"],
    )

    # Create file_blobs table
    op.create_table(
        "file_blobs",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique blob identifier",
        ),
        # Foreign key to file_uploads
        sa.Column(
            "file_upload_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("file_uploads.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            comment="Reference to file_uploads table",
        ),
        # Binary data
        sa.Column(
            "blob_data",
            sa.LargeBinary,
            nullable=False,
            comment="File content as binary data",
        ),
        # Timestamp
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Blob creation timestamp",
        ),
        comment="File binary data storage for database backend",
    )

    # Create index for file_blobs
    op.create_index(
        "ix_file_blobs_file_upload_id",
        "file_blobs",
        ["file_upload_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop file storage tables."""

    # Drop file_blobs table (must be dropped first due to FK)
    op.drop_index("ix_file_blobs_file_upload_id", table_name="file_blobs")
    op.drop_table("file_blobs")

    # Drop file_uploads indexes
    op.drop_index("ix_file_uploads_project_created", table_name="file_uploads")
    op.drop_index("ix_file_uploads_created_at", table_name="file_uploads")
    op.drop_index("ix_file_uploads_project_id", table_name="file_uploads")
    op.drop_index("ix_file_uploads_uploaded_by", table_name="file_uploads")

    # Drop file_uploads table
    op.drop_table("file_uploads")
