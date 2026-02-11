"""
Knowledge base schemas for request/response validation.

This module defines Pydantic schemas for knowledge base management
including ingestion, search, and statistics.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.auth import APIResponse


# =============================================================================
# Knowledge Ingestion Schemas
# =============================================================================


class KnowledgeIngestRequest(BaseModel):
    """Schema for triggering knowledge base ingestion."""

    source_type: Optional[str] = Field(
        default=None,
        description="Type of source to ingest: 'training_quotes', 'guidelines', 'all'",
        examples=["all", "training_quotes", "guidelines"],
    )
    folder_path: Optional[str] = Field(
        default=None,
        description="Custom folder path to ingest (relative to project root)",
    )
    file_pattern: str = Field(
        default="*.md",
        description="Glob pattern for files to process",
    )


class KnowledgeIngestResult(BaseModel):
    """Result of a knowledge ingestion operation."""

    files_found: int = Field(..., description="Number of files found")
    files_processed: int = Field(..., description="Number of files successfully processed")
    files_failed: int = Field(..., description="Number of files that failed processing")
    total_embeddings: int = Field(..., description="Total embeddings created")
    errors: list[str] = Field(default_factory=list, description="List of error messages")


class KnowledgeIngestResponse(APIResponse):
    """Response schema for knowledge ingestion endpoint."""

    data: KnowledgeIngestResult = Field(..., description="Ingestion results")


class FullIngestionResult(BaseModel):
    """Result of full knowledge base ingestion."""

    training_quotes: KnowledgeIngestResult = Field(..., description="Training quotes ingestion result")
    guidelines: KnowledgeIngestResult = Field(..., description="Guidelines ingestion result")
    root_quotes: KnowledgeIngestResult = Field(..., description="Root-level quotes ingestion result")
    total_embeddings: int = Field(..., description="Total embeddings created across all sources")
    total_files: int = Field(..., description="Total files processed across all sources")
    total_errors: list[str] = Field(default_factory=list, description="All error messages")


class FullIngestionResponse(APIResponse):
    """Response schema for full ingestion endpoint."""

    data: FullIngestionResult = Field(..., description="Full ingestion results")


# =============================================================================
# Knowledge Statistics Schemas
# =============================================================================


class SourceTypeStats(BaseModel):
    """Statistics for a single source type."""

    embeddings: int = Field(..., description="Number of embeddings")
    documents: int = Field(..., description="Number of documents")


class KnowledgeStats(BaseModel):
    """Knowledge base statistics."""

    by_type: dict[str, SourceTypeStats] = Field(
        default_factory=dict,
        description="Statistics by source type",
    )
    total_embeddings: int = Field(default=0, description="Total number of embeddings")
    total_documents: int = Field(default=0, description="Total number of documents")
    error: Optional[str] = Field(default=None, description="Error message if stats retrieval failed")


class KnowledgeStatsResponse(APIResponse):
    """Response schema for knowledge stats endpoint."""

    data: KnowledgeStats = Field(..., description="Knowledge base statistics")


# =============================================================================
# Knowledge Search Schemas
# =============================================================================


class KnowledgeSearchRequest(BaseModel):
    """Schema for knowledge base search request."""

    query: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="Search query text",
        examples=["WordPress WooCommerce e-commerce setup"],
    )
    source_types: Optional[list[str]] = Field(
        default=None,
        description="Filter by source types (e.g., ['quote', 'training_quote', 'guideline'])",
    )
    platform: Optional[str] = Field(
        default=None,
        description="Filter by platform (currently only 'wordpress' is supported)",
    )
    top_k: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Number of results to return",
    )
    similarity_threshold: float = Field(
        default=0.65,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score (0-1)",
    )


class KnowledgeSearchResult(BaseModel):
    """A single search result from the knowledge base."""

    id: str = Field(..., description="Embedding ID")
    content: str = Field(..., description="Text content of the chunk")
    source_type: str = Field(..., description="Type of source document")
    source_id: str = Field(..., description="ID of the source document")
    similarity_score: float = Field(..., description="Cosine similarity score")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    platform: Optional[str] = Field(None, description="Platform (if available in metadata)")
    project_type: Optional[str] = Field(None, description="Project type (if available)")
    total_hours: Optional[float] = Field(None, description="Total hours (if available)")
    summary: Optional[str] = Field(None, description="Document summary (if available)")


class KnowledgeSearchData(BaseModel):
    """Container for search results."""

    results: list[KnowledgeSearchResult] = Field(..., description="Search results")
    query: str = Field(..., description="Original search query")
    result_count: int = Field(..., description="Number of results returned")


class KnowledgeSearchResponse(APIResponse):
    """Response schema for knowledge search endpoint."""

    data: KnowledgeSearchData = Field(..., description="Search results data")


# =============================================================================
# Knowledge Document Schemas
# =============================================================================


class KnowledgeDocumentIngest(BaseModel):
    """Schema for ingesting a single document."""

    content: str = Field(
        ...,
        min_length=10,
        description="Document content to ingest",
    )
    source_type: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Type of source (quote, guideline, documentation)",
    )
    source_id: str = Field(
        ...,
        min_length=1,
        description="Unique identifier for the source",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (platform, total_hours, tags, etc.)",
    )
    chunk_size: int = Field(
        default=512,
        ge=100,
        le=2000,
        description="Character size for document chunks",
    )
    chunk_overlap: int = Field(
        default=50,
        ge=0,
        le=200,
        description="Character overlap between chunks",
    )


class DocumentIngestResult(BaseModel):
    """Result of single document ingestion."""

    source_id: str = Field(..., description="ID of the ingested document")
    embeddings_created: int = Field(..., description="Number of embeddings created")
    chunks_created: int = Field(..., description="Number of text chunks created")


class DocumentIngestResponse(APIResponse):
    """Response schema for document ingestion."""

    data: DocumentIngestResult = Field(..., description="Document ingestion result")


class DocumentDeleteResult(BaseModel):
    """Result of document deletion."""

    source_id: str = Field(..., description="ID of the deleted document")
    embeddings_deleted: int = Field(..., description="Number of embeddings deleted")


class DocumentDeleteResponse(APIResponse):
    """Response schema for document deletion."""

    data: DocumentDeleteResult = Field(..., description="Document deletion result")


# =============================================================================
# Task Status Schemas (for Celery background tasks)
# =============================================================================


class TaskSubmittedResult(BaseModel):
    """Result when a task is submitted to the background queue."""

    task_id: str = Field(..., description="Celery task ID for tracking")
    status: str = Field(default="submitted", description="Task submission status")
    message: str = Field(..., description="Human-readable status message")


class TaskSubmittedResponse(APIResponse):
    """Response schema for task submission."""

    data: TaskSubmittedResult = Field(..., description="Task submission result")


class TaskStatusResult(BaseModel):
    """Status of a background task."""

    task_id: str = Field(..., description="Celery task ID")
    status: str = Field(..., description="Task status (PENDING, STARTED, SUCCESS, FAILURE)")
    ready: bool = Field(..., description="Whether the task has completed")
    result: Optional[dict[str, Any]] = Field(None, description="Task result if completed")
    error: Optional[str] = Field(None, description="Error message if failed")
    info: Optional[dict[str, Any]] = Field(None, description="Task progress info")


class TaskStatusResponse(APIResponse):
    """Response schema for task status endpoint."""

    data: TaskStatusResult = Field(..., description="Task status information")
