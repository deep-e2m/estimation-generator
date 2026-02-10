"""Add project, quote, chat_message, and knowledge_embedding tables.

Revision ID: 20260121_000001
Revises: 20260120_000001
Create Date: 2026-01-21 00:00:01.000000

This migration creates the core tables for the quote generation application:

Tables:
    projects: Stores project information and extra_data
    quotes: Stores generated quotes with cost/hour estimates
    chat_messages: Stores conversation history between users and AI
    knowledge_embeddings: Stores vector embeddings for RAG retrieval

Extensions:
    pgvector: Enables vector similarity search for embeddings

Indexes:
    - Standard B-tree indexes on frequently queried columns
    - HNSW index on embedding column for fast approximate nearest neighbor search
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260121_000001"
down_revision: Union[str, None] = "20260120_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create project, quote, chat_message, and knowledge_embedding tables."""

    # Enable pgvector extension for vector similarity search
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create enum types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE platform_type AS ENUM ('wordpress', 'shopify', 'woocommerce', 'custom');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE project_status AS ENUM ('active', 'archived', 'completed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE quote_status AS ENUM ('draft', 'published', 'approved', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE complexity_level AS ENUM ('low', 'medium', 'high');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create projects table
    op.create_table(
        "projects",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique project identifier",
        ),
        # Project information
        sa.Column(
            "name",
            sa.String(500),
            nullable=False,
            comment="Project name",
        ),
        sa.Column(
            "description",
            sa.Text,
            nullable=True,
            comment="Detailed project description",
        ),
        # Platform and status
        sa.Column(
            "platform",
            postgresql.ENUM(
                "wordpress", "shopify", "woocommerce", "custom",
                name="platform_type",
                create_type=False,
            ),
            nullable=False,
            comment="Target e-commerce platform",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active", "archived", "completed",
                name="project_status",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
            comment="Current project status",
        ),
        # Ownership
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            comment="User who created this project",
        ),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Project creation timestamp",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Last modification timestamp",
        ),
        comment="Projects for quote generation",
    )

    # Create indexes for projects
    op.create_index("ix_projects_created_by", "projects", ["created_by"])
    op.create_index("ix_projects_platform", "projects", ["platform"])
    op.create_index("ix_projects_status", "projects", ["status"])
    op.create_index("ix_projects_created_at", "projects", ["created_at"])

    # Create quotes table
    op.create_table(
        "quotes",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique quote identifier",
        ),
        # Project relationship
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            comment="Reference to parent project",
        ),
        # Quote information
        sa.Column(
            "title",
            sa.String(500),
            nullable=False,
            comment="Quote title",
        ),
        sa.Column(
            "content",
            sa.Text,
            nullable=False,
            comment="Full quote document content",
        ),
        sa.Column(
            "requirements",
            sa.Text,
            nullable=False,
            comment="Original requirements provided",
        ),
        # Cost estimation
        sa.Column(
            "total_hours",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0.00",
            comment="Estimated total hours",
        ),
        sa.Column(
            "total_cost",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0.00",
            comment="Estimated total cost",
        ),
        # Classification
        sa.Column(
            "platform",
            sa.String(50),
            nullable=False,
            comment="Target platform for the quote",
        ),
        sa.Column(
            "complexity",
            postgresql.ENUM(
                "low", "medium", "high",
                name="complexity_level",
                create_type=False,
            ),
            nullable=False,
            server_default="medium",
            comment="Estimated project complexity",
        ),
        # Status tracking
        sa.Column(
            "status",
            postgresql.ENUM(
                "draft", "published", "approved", "rejected",
                name="quote_status",
                create_type=False,
            ),
            nullable=False,
            server_default="draft",
            comment="Current quote status",
        ),
        # Ownership and approval
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            comment="User who created this quote",
        ),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="User who approved this quote",
        ),
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when quote was approved",
        ),
        # Additional extra_data
        sa.Column(
            "extra_data",
            postgresql.JSONB,
            nullable=True,
            comment="Additional extra_data (AI model, version, etc.)",
        ),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Quote creation timestamp",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Last modification timestamp",
        ),
        comment="Generated quotes with cost estimates",
    )

    # Create indexes for quotes
    op.create_index("ix_quotes_project_id", "quotes", ["project_id"])
    op.create_index("ix_quotes_created_by", "quotes", ["created_by"])
    op.create_index("ix_quotes_platform", "quotes", ["platform"])
    op.create_index("ix_quotes_complexity", "quotes", ["complexity"])
    op.create_index("ix_quotes_status", "quotes", ["status"])
    op.create_index("ix_quotes_created_at", "quotes", ["created_at"])
    # Composite index for common query pattern
    op.create_index(
        "ix_quotes_project_status",
        "quotes",
        ["project_id", "status"],
    )

    # Create chat_messages table
    op.create_table(
        "chat_messages",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique message identifier",
        ),
        # Project relationship
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            comment="Reference to parent project",
        ),
        # User relationship (optional)
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="User who sent the message (null for assistant)",
        ),
        # Message content
        sa.Column(
            "role",
            postgresql.ENUM(
                "user", "assistant", "system",
                name="message_role",
                create_type=False,
            ),
            nullable=False,
            comment="Role of the message sender",
        ),
        sa.Column(
            "content",
            sa.Text,
            nullable=False,
            comment="Message text content",
        ),
        # Attachments and extra_data
        sa.Column(
            "attachments",
            postgresql.JSONB,
            nullable=True,
            comment="Array of file references (id, name, type, url)",
        ),
        sa.Column(
            "extra_data",
            postgresql.JSONB,
            nullable=True,
            comment="Additional extra_data (model, tokens, latency, etc.)",
        ),
        # Timestamp
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Message creation timestamp",
        ),
        comment="Chat conversation history",
    )

    # Create indexes for chat_messages
    op.create_index("ix_chat_messages_project_id", "chat_messages", ["project_id"])
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])
    op.create_index("ix_chat_messages_role", "chat_messages", ["role"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])
    # Composite index for fetching conversation history
    op.create_index(
        "ix_chat_messages_project_created",
        "chat_messages",
        ["project_id", "created_at"],
    )

    # Create knowledge_embeddings table
    op.create_table(
        "knowledge_embeddings",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            comment="Unique embedding identifier",
        ),
        # Source reference
        sa.Column(
            "source_type",
            sa.String(50),
            nullable=False,
            comment="Type of source: quote, requirement, or guideline",
        ),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="UUID reference to the source document",
        ),
        # Text content
        sa.Column(
            "chunk_text",
            sa.Text,
            nullable=False,
            comment="Original text content of the chunk",
        ),
        sa.Column(
            "chunk_index",
            sa.Integer,
            nullable=False,
            server_default="0",
            comment="Position of this chunk within the source document",
        ),
        # Vector embedding (1536 dimensions for OpenAI text-embedding-ada-002)
        sa.Column(
            "embedding",
            postgresql.ARRAY(sa.Float),
            nullable=False,
            comment="Vector embedding (1536 dimensions)",
        ),
        # Metadata for filtering
        sa.Column(
            "extra_data",
            postgresql.JSONB,
            nullable=True,
            comment="Additional extra_data (platform, complexity, tags, etc.)",
        ),
        # Timestamp
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Embedding creation timestamp",
        ),
        comment="Vector embeddings for RAG retrieval",
    )

    # Create indexes for knowledge_embeddings
    op.create_index("ix_knowledge_embeddings_source_type", "knowledge_embeddings", ["source_type"])
    op.create_index("ix_knowledge_embeddings_source_id", "knowledge_embeddings", ["source_id"])
    op.create_index("ix_knowledge_embeddings_created_at", "knowledge_embeddings", ["created_at"])
    # Composite index for source lookups
    op.create_index(
        "ix_knowledge_embeddings_source",
        "knowledge_embeddings",
        ["source_type", "source_id"],
    )

    # Alter the embedding column to use pgvector type and create HNSW index
    # We first create the table with ARRAY(Float) for compatibility, then alter it
    op.execute("""
        ALTER TABLE knowledge_embeddings
        ALTER COLUMN embedding TYPE vector(1536)
        USING embedding::vector(1536)
    """)

    # Create HNSW index for fast approximate nearest neighbor search
    # Using cosine distance (<=>) which is common for text embeddings
    # m=16 and ef_construction=64 are good defaults for most use cases
    op.execute("""
        CREATE INDEX ix_knowledge_embeddings_embedding_hnsw
        ON knowledge_embeddings
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # Create GIN index on JSONB extra_data columns for efficient filtering
    op.execute("""
        CREATE INDEX ix_quotes_extra_data_gin
        ON quotes USING gin (extra_data jsonb_path_ops)
    """)
    op.execute("""
        CREATE INDEX ix_chat_messages_extra_data_gin
        ON chat_messages USING gin (extra_data jsonb_path_ops)
    """)
    op.execute("""
        CREATE INDEX ix_knowledge_embeddings_extra_data_gin
        ON knowledge_embeddings USING gin (extra_data jsonb_path_ops)
    """)


def downgrade() -> None:
    """Drop project, quote, chat_message, and knowledge_embedding tables."""

    # Drop GIN indexes on extra_data
    op.execute("DROP INDEX IF EXISTS ix_knowledge_embeddings_extra_data_gin")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_extra_data_gin")
    op.execute("DROP INDEX IF EXISTS ix_quotes_extra_data_gin")

    # Drop HNSW index
    op.execute("DROP INDEX IF EXISTS ix_knowledge_embeddings_embedding_hnsw")

    # Drop knowledge_embeddings indexes and table
    op.drop_index("ix_knowledge_embeddings_source", table_name="knowledge_embeddings")
    op.drop_index("ix_knowledge_embeddings_created_at", table_name="knowledge_embeddings")
    op.drop_index("ix_knowledge_embeddings_source_id", table_name="knowledge_embeddings")
    op.drop_index("ix_knowledge_embeddings_source_type", table_name="knowledge_embeddings")
    op.drop_table("knowledge_embeddings")

    # Drop chat_messages indexes and table
    op.drop_index("ix_chat_messages_project_created", table_name="chat_messages")
    op.drop_index("ix_chat_messages_created_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_role", table_name="chat_messages")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_project_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    # Drop quotes indexes and table
    op.drop_index("ix_quotes_project_status", table_name="quotes")
    op.drop_index("ix_quotes_created_at", table_name="quotes")
    op.drop_index("ix_quotes_status", table_name="quotes")
    op.drop_index("ix_quotes_complexity", table_name="quotes")
    op.drop_index("ix_quotes_platform", table_name="quotes")
    op.drop_index("ix_quotes_created_by", table_name="quotes")
    op.drop_index("ix_quotes_project_id", table_name="quotes")
    op.drop_table("quotes")

    # Drop projects indexes and table
    op.drop_index("ix_projects_created_at", table_name="projects")
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_index("ix_projects_platform", table_name="projects")
    op.drop_index("ix_projects_created_by", table_name="projects")
    op.drop_table("projects")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS message_role")
    op.execute("DROP TYPE IF EXISTS complexity_level")
    op.execute("DROP TYPE IF EXISTS quote_status")
    op.execute("DROP TYPE IF EXISTS project_status")
    op.execute("DROP TYPE IF EXISTS platform_type")

    # Note: We don't drop the pgvector extension as other migrations might depend on it
