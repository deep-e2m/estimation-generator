"""Add documents table for real-time collaborative editing.

Revision ID: 20260121_000002
Revises: 20260121_000001
Create Date: 2026-01-21 00:00:02.000000

This migration creates the documents table for storing document content
with WebSocket-based real-time collaboration support.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260121_000002"
down_revision: Union[str, None] = "20260121_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create documents table."""

    # Create document_type enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE document_type AS ENUM ('quote', 'proposal', 'requirements', 'notes');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create documents table
    op.create_table(
        "documents",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique document identifier",
        ),
        # Project relationship
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            comment="Reference to parent project",
        ),
        # Document information
        sa.Column(
            "title",
            sa.String(500),
            nullable=False,
            comment="Document title",
        ),
        sa.Column(
            "content",
            postgresql.JSONB,
            nullable=True,
            comment="Document content as JSON (rich text editor format)",
        ),
        sa.Column(
            "plain_text",
            sa.Text,
            nullable=True,
            comment="Plain text version of content for search/preview",
        ),
        # Document type
        sa.Column(
            "document_type",
            postgresql.ENUM(
                "quote", "proposal", "requirements", "notes",
                name="document_type",
                create_type=False,
            ),
            nullable=False,
            server_default="quote",
            comment="Type of document",
        ),
        # Version control
        sa.Column(
            "version",
            sa.Integer,
            nullable=False,
            server_default="1",
            comment="Document version for conflict resolution",
        ),
        # Ownership
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            comment="User who created this document",
        ),
        sa.Column(
            "last_edited_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="User who last edited this document",
        ),
        # Additional metadata
        sa.Column(
            "extra_data",
            postgresql.JSONB,
            nullable=True,
            comment="Additional metadata",
        ),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Document creation timestamp",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Last modification timestamp",
        ),
        comment="Documents for real-time collaborative editing",
    )

    # Create indexes
    op.create_index("ix_documents_project_id", "documents", ["project_id"])
    op.create_index("ix_documents_created_by", "documents", ["created_by"])
    op.create_index("ix_documents_document_type", "documents", ["document_type"])
    op.create_index("ix_documents_created_at", "documents", ["created_at"])
    op.create_index("ix_documents_updated_at", "documents", ["updated_at"])

    # Composite index for project + type
    op.create_index(
        "ix_documents_project_type",
        "documents",
        ["project_id", "document_type"],
    )

    # GIN index for JSONB content search
    op.execute("""
        CREATE INDEX ix_documents_content_gin
        ON documents USING gin (content jsonb_path_ops)
    """)


def downgrade() -> None:
    """Drop documents table."""

    # Drop GIN index
    op.execute("DROP INDEX IF EXISTS ix_documents_content_gin")

    # Drop other indexes
    op.drop_index("ix_documents_project_type", table_name="documents")
    op.drop_index("ix_documents_updated_at", table_name="documents")
    op.drop_index("ix_documents_created_at", table_name="documents")
    op.drop_index("ix_documents_document_type", table_name="documents")
    op.drop_index("ix_documents_created_by", table_name="documents")
    op.drop_index("ix_documents_project_id", table_name="documents")

    # Drop table
    op.drop_table("documents")

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS document_type")
