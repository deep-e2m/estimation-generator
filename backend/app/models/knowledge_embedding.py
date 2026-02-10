"""
Knowledge embedding model for RAG (Retrieval-Augmented Generation).

This module defines the KnowledgeEmbedding model that stores vector
embeddings of text chunks for similarity search using pgvector.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin

# pgvector Vector type import
# Note: requires pgvector extension and sqlalchemy-pgvector package
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # Fallback for environments without pgvector installed
    # This allows model imports to work even if pgvector is not available
    Vector = None  # type: ignore


class KnowledgeEmbedding(Base, UUIDMixin):
    """
    Knowledge embedding model for vector similarity search.

    Stores text chunks and their vector embeddings for RAG-based
    retrieval. Embeddings are generated using OpenAI's text-embedding
    model (1536 dimensions by default).

    The HNSW index on the embedding column enables fast approximate
    nearest neighbor search for semantic similarity queries.

    Attributes:
        id: Unique identifier (UUID).
        source_type: Type of source document (quote, requirement, guideline).
        source_id: UUID reference to the source document.
        chunk_text: Original text content of the chunk.
        chunk_index: Position of this chunk within the source document.
        embedding: Vector embedding (1536 dimensions for OpenAI ada-002).
        metadata: Additional metadata (platform, complexity, tags).
        created_at: Timestamp when embedding was created.
    """

    __tablename__ = "knowledge_embeddings"

    # Source reference
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Type of source: quote, requirement, or guideline",
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        doc="UUID reference to the source document",
    )

    # Text content
    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Original text content of the chunk",
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        doc="Position of this chunk within the source document",
    )

    # Vector embedding
    # Note: The Vector type is provided by pgvector extension
    # 1536 dimensions is the default for OpenAI text-embedding-ada-002
    # For newer models like text-embedding-3-small, dimensions may vary
    embedding: Mapped[list[float]] = mapped_column(
        Vector(1536) if Vector else Text,  # Fallback to Text if pgvector not available
        nullable=False,
        doc="Vector embedding (1536 dimensions)",
    )

    # Metadata for filtering
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Additional metadata (platform, complexity, tags, etc.)",
    )

    # Timestamp (only created_at, embeddings are immutable)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        doc="Timestamp when embedding was created",
    )

    def __repr__(self) -> str:
        """Return string representation of KnowledgeEmbedding."""
        text_preview = self.chunk_text[:50] + "..." if len(self.chunk_text) > 50 else self.chunk_text
        return f"<KnowledgeEmbedding(id={self.id}, source_type={self.source_type}, text={text_preview!r})>"

    @property
    def has_extra_data(self) -> bool:
        """Check if embedding has extra data."""
        return self.extra_data is not None and len(self.extra_data) > 0

    def get_platform(self) -> str | None:
        """Get platform from extra_data if available."""
        if self.extra_data and "platform" in self.extra_data:
            return self.extra_data["platform"]
        return None

    def get_complexity(self) -> str | None:
        """Get complexity from extra_data if available."""
        if self.extra_data and "complexity" in self.extra_data:
            return self.extra_data["complexity"]
        return None

    def get_tags(self) -> list[str]:
        """Get tags from extra_data if available."""
        if self.extra_data and "tags" in self.extra_data:
            return self.extra_data.get("tags", [])
        return []
