"""
Knowledge Base Ingestion Service.

Manages the ingestion of documents into the knowledge base,
including approved quotes and training files.
"""

import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_session_factory
from app.core.redis import knowledge_cache
from app.services.ai.openrouter_client import OpenRouterClient
from app.services.ai.rag_service import RAGService

logger = logging.getLogger(__name__)


class KnowledgeService:
    """
    Manages knowledge base ingestion and updates.

    Handles ingestion of various document types into the vector
    knowledge base for RAG retrieval.

    Supported document types:
    - Approved quotes (from database)
    - Training files (markdown, text)
    - Guidelines and documentation

    Example:
        >>> service = KnowledgeService()
        >>> await service.ingest_approved_quote("quote-123")
        >>> stats = await service.ingest_training_files()
        >>> print(f"Ingested {stats['files_processed']} files")
    """

    # Default paths
    TRAINING_QUOTES_PATH = "knowledge-based/training/quotes"
    GUIDELINES_PATH = "knowledge-based/guidelines"
    FORMATTING_PATH = "knowledge-based/formatting"

    def __init__(
        self,
        rag_service: Optional[RAGService] = None,
        base_path: Optional[str] = None,
    ):
        """
        Initialize the Knowledge Service.

        Args:
            rag_service: Optional RAGService instance.
            base_path: Base path for knowledge files.
                Defaults to project root.
        """
        self._rag_service = rag_service
        self.base_path = Path(base_path) if base_path else self._get_project_root()

    @property
    def rag_service(self) -> RAGService:
        """Get or create the RAG service."""
        if self._rag_service is None:
            self._rag_service = RAGService()
        return self._rag_service

    def _get_project_root(self) -> Path:
        """Get the project root directory."""
        # Navigate from this file's location
        current = Path(__file__).resolve()
        # Go up: ai -> services -> app -> backend -> project_root
        return current.parent.parent.parent.parent.parent

    async def ingest_approved_quote(
        self,
        quote_id: str,
        db_session: Optional[AsyncSession] = None,
    ) -> int:
        """
        Ingest an approved quote into the knowledge base.

        Fetches the quote from the database, extracts relevant
        content, and creates embeddings for RAG retrieval.

        Args:
            quote_id: ID of the quote to ingest.
            db_session: Optional database session.

        Returns:
            Number of embeddings created.

        Raises:
            ValueError: If quote not found or not approved.

        Example:
            >>> count = await service.ingest_approved_quote("quote-123")
            >>> print(f"Created {count} embeddings")
        """
        logger.info("Ingesting approved quote: %s", quote_id)

        # Fetch quote from database
        quote_query = """
            SELECT
                q.id,
                q.content,
                q.requirements,
                q.platform,
                q.total_hours,
                q.status,
                p.name as project_name
            FROM quotes q
            LEFT JOIN projects p ON q.project_id = p.id
            WHERE q.id = :quote_id
        """

        try:
            if db_session:
                result = await db_session.execute(
                    text(quote_query),
                    {"quote_id": quote_id},
                )
                quote = result.fetchone()
            else:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    result = await session.execute(
                        text(quote_query),
                        {"quote_id": quote_id},
                    )
                    quote = result.fetchone()

            if not quote:
                raise ValueError(f"Quote not found: {quote_id}")

            if quote.status != "approved":
                logger.warning(
                    "Quote %s is not approved (status: %s). Ingesting anyway.",
                    quote_id,
                    quote.status,
                )

            # Build content for embedding
            content = self._build_quote_content(quote)

            # Extract metadata
            metadata = {
                "platform": quote.platform,
                "total_hours": quote.total_hours,
                "project_name": quote.project_name,
                "summary": self._extract_summary(quote.content),
                "project_type": self._infer_project_type(quote.content, quote.requirements),
            }

            # Delete existing embeddings for this quote
            await self.rag_service.delete_document_embeddings(
                source_id=f"quote-{quote_id}",
                db_session=db_session,
            )

            # Ingest with token-based chunking (sizes from settings)
            count = await self.rag_service.ingest_document(
                content=content,
                source_type="quote",
                source_id=f"quote-{quote_id}",
                metadata=metadata,
                chunk_size=settings.KNOWLEDGE_CHUNK_SIZE,
                chunk_overlap=settings.KNOWLEDGE_CHUNK_OVERLAP,
                db_session=db_session,
            )

            logger.info(
                "Ingested quote %s: %d embeddings",
                quote_id,
                count,
            )
            return count

        except Exception as e:
            logger.error("Failed to ingest quote %s: %s", quote_id, str(e))
            raise

    def _build_quote_content(self, quote) -> str:
        """
        Build content string from quote data.

        Combines requirements and quote content into a format
        optimized for embedding and retrieval.
        """
        parts = []

        if quote.requirements:
            parts.append(f"## Requirements\n{quote.requirements}")

        if quote.content:
            parts.append(f"## Quote\n{quote.content}")

        return "\n\n".join(parts)

    def _extract_summary(self, content: str, max_length: int = 200) -> str:
        """
        Extract a summary from quote content.

        Looks for project overview section or takes first paragraph.
        """
        if not content:
            return ""

        # Try to find project overview section
        overview_patterns = [
            r"##\s*Project Overview\s*\n(.*?)(?=\n##|\n\n\n|$)",
            r"##\s*Overview\s*\n(.*?)(?=\n##|\n\n\n|$)",
            r"\*\*Project Overview\*\*:?\s*(.*?)(?=\n\*\*|\n\n|$)",
        ]

        for pattern in overview_patterns:
            match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if match:
                summary = match.group(1).strip()
                if summary:
                    if len(summary) > max_length:
                        summary = summary[:max_length].rsplit(" ", 1)[0] + "..."
                    return summary

        # Fallback: take first paragraph
        paragraphs = content.split("\n\n")
        for p in paragraphs:
            p = p.strip()
            if p and not p.startswith("#") and len(p) > 50:
                if len(p) > max_length:
                    p = p[:max_length].rsplit(" ", 1)[0] + "..."
                return p

        return ""

    def _infer_project_type(
        self,
        content: str,
        requirements: str,
    ) -> str:
        """
        Infer project type from content.

        Returns type like: full_build, redesign, branding_refresh, etc.
        """
        text = (content + " " + (requirements or "")).lower()

        type_keywords = {
            "full_build": ["full build", "new website", "new site", "ground up"],
            "redesign": ["redesign", "rebuild", "overhaul", "migration"],
            "branding_refresh": ["branding refresh", "visual refresh", "styling"],
            "ecommerce": ["woocommerce", "ecommerce", "e-commerce", "online store"],
            "landing_page": ["landing page", "campaign page", "single page"],
            "maintenance": ["maintenance", "updates", "support"],
            "custom_development": ["custom development", "plugin development", "wordpress plugin"],
        }

        for project_type, keywords in type_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    return project_type

        return "general"

    async def ingest_training_files(
        self,
        folder_path: Optional[str] = None,
        file_pattern: str = "*.md",
        db_session: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """
        Ingest all training files from a folder.

        Processes markdown files containing historical quotes
        or documentation for the knowledge base.

        Args:
            folder_path: Path to folder containing training files.
                Relative to project root if not absolute.
            file_pattern: Glob pattern for files to process.
            db_session: Optional database session.

        Returns:
            Dictionary with ingestion statistics:
            - files_found: Number of files found
            - files_processed: Number successfully processed
            - files_failed: Number that failed
            - total_embeddings: Total embeddings created
            - errors: List of error messages

        Example:
            >>> stats = await service.ingest_training_files(
            ...     folder_path="knowledge-based/training/quotes",
            ... )
            >>> print(f"Processed {stats['files_processed']} files")
        """
        # Resolve path
        if folder_path is None:
            folder_path = self.TRAINING_QUOTES_PATH

        if not os.path.isabs(folder_path):
            full_path = self.base_path / folder_path
        else:
            full_path = Path(folder_path)

        logger.info("Ingesting training files from: %s", full_path)

        stats: Dict[str, Any] = {
            "files_found": 0,
            "files_processed": 0,
            "files_failed": 0,
            "total_embeddings": 0,
            "errors": [],
        }

        if not full_path.exists():
            logger.warning("Training folder not found: %s", full_path)
            stats["errors"].append(f"Folder not found: {full_path}")
            return stats

        # Find all matching files
        files = list(full_path.glob(file_pattern))
        stats["files_found"] = len(files)

        logger.info("Found %d training files", len(files))

        for file_path in files:
            try:
                count = await self._ingest_training_file(
                    file_path=file_path,
                    db_session=db_session,
                )
                stats["files_processed"] += 1
                stats["total_embeddings"] += count
                logger.debug(
                    "Ingested %s: %d embeddings",
                    file_path.name,
                    count,
                )

            except Exception as e:
                stats["files_failed"] += 1
                error_msg = f"{file_path.name}: {str(e)}"
                stats["errors"].append(error_msg)
                logger.error("Failed to ingest %s: %s", file_path.name, str(e))

        logger.info(
            "Training ingestion complete: %d/%d files, %d embeddings",
            stats["files_processed"],
            stats["files_found"],
            stats["total_embeddings"],
        )

        return stats

    async def _ingest_training_file(
        self,
        file_path: Path,
        db_session: Optional[AsyncSession] = None,
    ) -> int:
        """
        Ingest a single training file.

        Args:
            file_path: Path to the file.
            db_session: Database session.

        Returns:
            Number of embeddings created.
        """
        logger.debug("Processing file: %s", file_path)

        # Read file content
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract metadata from filename and content
        metadata = self._extract_file_metadata(file_path, content)

        # Generate source ID from filename
        source_id = f"training-{file_path.stem}"

        # Delete existing embeddings
        await self.rag_service.delete_document_embeddings(
            source_id=source_id,
            db_session=db_session,
        )

        # Ingest document (token-based chunking from settings)
        count = await self.rag_service.ingest_document(
            content=content,
            source_type="training_quote",
            source_id=source_id,
            metadata=metadata,
            chunk_size=settings.KNOWLEDGE_CHUNK_SIZE,
            chunk_overlap=settings.KNOWLEDGE_CHUNK_OVERLAP,
            db_session=db_session,
        )

        return count

    def _extract_file_metadata(
        self,
        file_path: Path,
        content: str,
    ) -> Dict[str, Any]:
        """
        Extract metadata from file and content.

        Attempts to parse platform, project type, and other
        metadata from filename patterns and content.
        """
        filename = file_path.stem.lower()
        metadata: Dict[str, Any] = {}

        # Try to extract platform from filename (WordPress only)
        platforms = ["wordpress"]
        for platform in platforms:
            if platform in filename:
                metadata["platform"] = platform
                break

        # Try to extract from content
        content_lower = content.lower()

        # Platform from content
        if "platform" not in metadata:
            for platform in platforms:
                if f"platform: {platform}" in content_lower or f"platform:{platform}" in content_lower:
                    metadata["platform"] = platform
                    break

        # Look for elementor, bricks, etc.
        if "elementor" in content_lower:
            metadata["page_builder"] = "elementor"
        elif "bricks" in content_lower:
            metadata["page_builder"] = "bricks"

        # Extract hours if present
        hours_match = re.search(
            r"(?:total|estimated).*?(\d+)\s*(?:to|-)\s*(\d+)\s*hours?",
            content_lower,
        )
        if hours_match:
            min_hours = int(hours_match.group(1))
            max_hours = int(hours_match.group(2))
            metadata["total_hours"] = (min_hours + max_hours) / 2
            metadata["hours_min"] = min_hours
            metadata["hours_max"] = max_hours
        else:
            hours_match = re.search(r"(\d+)\s*hours?", content_lower)
            if hours_match:
                metadata["total_hours"] = int(hours_match.group(1))

        # Project type
        metadata["project_type"] = self._infer_project_type(content, "")

        # Summary
        metadata["summary"] = self._extract_summary(content)

        return metadata

    async def ingest_guidelines(
        self,
        folder_path: Optional[str] = None,
        db_session: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """
        Ingest estimation guidelines into knowledge base.

        Args:
            folder_path: Path to guidelines folder.
            db_session: Database session.

        Returns:
            Ingestion statistics.
        """
        if folder_path is None:
            folder_path = self.GUIDELINES_PATH

        logger.info("Ingesting guidelines from: %s", folder_path)

        return await self.ingest_training_files(
            folder_path=folder_path,
            file_pattern="*.md",
            db_session=db_session,
        )

    async def ingest_all_knowledge(
        self,
        db_session: Optional[AsyncSession] = None,
    ) -> Dict[str, Any]:
        """
        Ingest all knowledge sources.

        Processes training quotes, guidelines, and any other
        knowledge sources.

        Args:
            db_session: Database session.

        Returns:
            Combined statistics from all ingestion operations.
        """
        logger.info("Starting full knowledge base ingestion")

        results: Dict[str, Any] = {
            "training_quotes": {},
            "guidelines": {},
            "root_quotes": {},
            "total_embeddings": 0,
            "total_files": 0,
            "total_errors": [],
        }

        # Ingest training quotes
        results["training_quotes"] = await self.ingest_training_files(
            folder_path=self.TRAINING_QUOTES_PATH,
            db_session=db_session,
        )
        results["total_embeddings"] += results["training_quotes"]["total_embeddings"]
        results["total_files"] += results["training_quotes"]["files_processed"]

        # Ingest guidelines
        results["guidelines"] = await self.ingest_guidelines(
            db_session=db_session,
        )
        results["total_embeddings"] += results["guidelines"]["total_embeddings"]
        results["total_files"] += results["guidelines"]["files_processed"]

        # Ingest root-level quote files (requirements-quote-*.md)
        results["root_quotes"] = await self.ingest_training_files(
            folder_path="knowledge-based",
            file_pattern="requirements-quote-*.md",
            db_session=db_session,
        )
        results["total_embeddings"] += results["root_quotes"]["total_embeddings"]
        results["total_files"] += results["root_quotes"]["files_processed"]

        # Collect all errors
        for key in ["training_quotes", "guidelines", "root_quotes"]:
            results["total_errors"].extend(results[key].get("errors", []))

        logger.info(
            "Full ingestion complete: %d files, %d embeddings",
            results["total_files"],
            results["total_embeddings"],
        )

        return results

    def chunk_document(
        self,
        text: str,
        chunk_size: int = 512,
        overlap: int = 50,
    ) -> List[str]:
        """
        Chunk a document for embedding.

        Public interface for document chunking that can be used
        independently of the ingestion pipeline.

        Args:
            text: Text to chunk.
            chunk_size: Target chunk size in characters.
            overlap: Overlap between consecutive chunks.

        Returns:
            List of text chunks.

        Example:
            >>> chunks = service.chunk_document(
            ...     "Long document text...",
            ...     chunk_size=500,
            ...     overlap=50,
            ... )
            >>> print(f"Created {len(chunks)} chunks")
        """
        return self.rag_service._chunk_text(text, chunk_size, overlap)

    async def get_knowledge_stats(
        self,
        db_session: Optional[AsyncSession] = None,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        Get statistics about the knowledge base.

        Results are cached in Redis for 2 minutes.

        Args:
            db_session: Optional database session.
            use_cache: Whether to use Redis cache (default True).

        Returns:
            Dictionary with knowledge base statistics.
        """
        # Try cache first
        if use_cache:
            cached_stats = await knowledge_cache.get("stats")
            if cached_stats is not None:
                logger.debug("Cache hit for knowledge stats")
                return cached_stats

        stats_query = """
            SELECT
                source_type,
                COUNT(*) as embedding_count,
                COUNT(DISTINCT source_id) as document_count
            FROM knowledge_embeddings
            GROUP BY source_type
        """

        try:
            if db_session:
                result = await db_session.execute(text(stats_query))
                rows = result.fetchall()
            else:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    result = await session.execute(text(stats_query))
                    rows = result.fetchall()

            stats: Dict[str, Any] = {
                "by_type": {},
                "total_embeddings": 0,
                "total_documents": 0,
            }

            for row in rows:
                stats["by_type"][row.source_type] = {
                    "embeddings": row.embedding_count,
                    "documents": row.document_count,
                }
                stats["total_embeddings"] += row.embedding_count
                stats["total_documents"] += row.document_count

            # Cache the stats
            if use_cache:
                await knowledge_cache.set("stats", stats)

            return stats

        except Exception as e:
            logger.error("Failed to get knowledge stats: %s", str(e))
            return {
                "error": str(e),
                "by_type": {},
                "total_embeddings": 0,
                "total_documents": 0,
            }


# Singleton instance
_knowledge_service: Optional[KnowledgeService] = None


def get_knowledge_service() -> KnowledgeService:
    """
    Get the singleton Knowledge service instance.

    Returns:
        KnowledgeService instance.
    """
    global _knowledge_service
    if _knowledge_service is None:
        _knowledge_service = KnowledgeService()
    return _knowledge_service
