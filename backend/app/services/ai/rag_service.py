"""
RAG (Retrieval-Augmented Generation) Service.

Provides vector similarity search for finding relevant historical quotes
and knowledge base content to enhance quote generation.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_session_factory
from app.services.ai.openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)


class RAGService:
    """
    Retrieval-Augmented Generation service.

    Searches similar historical quotes using vector similarity
    and builds context for LLM prompts.

    Uses pgvector extension for efficient similarity search.

    Example:
        >>> rag = RAGService()
        >>> results = await rag.search_similar_quotes(
        ...     query="WordPress WooCommerce site",
        ...     platform="wordpress",
        ...     top_k=5,
        ... )
        >>> context = await rag.build_rag_context(
        ...     query="WordPress WooCommerce site",
        ... )
    """

    def __init__(
        self,
        client: Optional[OpenRouterClient] = None,
        embedding_dimensions: Optional[int] = None,
    ):
        """
        Initialize the RAG service.

        Args:
            client: Optional OpenRouterClient for embeddings.
            embedding_dimensions: Dimension of embedding vectors.
                Defaults to settings.EMBEDDING_DIMENSIONS.
        """
        self._client: Optional[OpenRouterClient] = client
        self.embedding_dimensions = embedding_dimensions or settings.EMBEDDING_DIMENSIONS

    @property
    def client(self) -> OpenRouterClient:
        """Get or create the OpenRouter client."""
        if self._client is None:
            self._client = OpenRouterClient()
        return self._client

    async def search_similar_quotes(
        self,
        query: str,
        platform: Optional[str] = None,
        project_type: Optional[str] = None,
        top_k: int = 5,
        similarity_threshold: float = 0.7,
        db_session: Optional[AsyncSession] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar historical quotes using vector similarity.

        Uses pgvector for fast similarity search based on embedding
        distance between query and stored quote embeddings.

        Args:
            query: Search query (requirements text).
            platform: Optional platform filter (wordpress, shopify, etc.).
            project_type: Optional project type filter.
            top_k: Number of results to return.
            similarity_threshold: Minimum similarity score (0-1).
            db_session: Optional database session. Creates new if not provided.

        Returns:
            List of similar quotes with metadata and similarity scores.
            Each quote contains:
            - id: Quote ID
            - content: Quote content
            - summary: Quote summary
            - platform: Platform type
            - project_type: Project type
            - total_hours: Hours estimate
            - similarity_score: Cosine similarity (0-1)

        Example:
            >>> results = await rag.search_similar_quotes(
            ...     query="E-commerce site with product catalog",
            ...     platform="wordpress",
            ...     top_k=3,
            ... )
            >>> for r in results:
            ...     print(f"{r['similarity_score']:.2f}: {r['summary']}")
        """
        logger.info(
            "Searching similar quotes: query_length=%d, platform=%s, top_k=%d",
            len(query),
            platform,
            top_k,
        )

        # Generate embedding for query
        try:
            query_embedding = await self.client.generate_embedding(query)
        except Exception as e:
            logger.error("Failed to generate query embedding: %s", str(e))
            return []

        # Build and execute search query
        results = await self._execute_similarity_search(
            embedding=query_embedding,
            platform=platform,
            project_type=project_type,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            db_session=db_session,
        )

        logger.info("Found %d similar quotes", len(results))
        return results

    async def _execute_similarity_search(
        self,
        embedding: List[float],
        platform: Optional[str] = None,
        project_type: Optional[str] = None,
        top_k: int = 5,
        similarity_threshold: float = 0.7,
        db_session: Optional[AsyncSession] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute vector similarity search using pgvector.

        Args:
            embedding: Query embedding vector.
            platform: Optional platform filter.
            project_type: Optional project type filter.
            top_k: Number of results.
            similarity_threshold: Minimum similarity.
            db_session: Database session.

        Returns:
            List of matching documents with scores.
        """
        # Build the SQL query with pgvector cosine similarity
        # The <=> operator computes cosine distance, so we convert to similarity
        # Use CAST() instead of :: to avoid conflict with SQLAlchemy's : parameter syntax
        base_query = """
            SELECT
                ke.id,
                ke.chunk_text as content,
                ke.source_type,
                ke.source_id,
                ke.extra_data,
                1 - (ke.embedding <=> CAST(:embedding AS vector)) as similarity_score
            FROM knowledge_embeddings ke
            WHERE 1 - (ke.embedding <=> CAST(:embedding AS vector)) > :threshold
        """

        # Add optional filters
        filters = []
        # Format embedding as PostgreSQL vector string: '[0.1, 0.2, ...]'
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        params: Dict[str, Any] = {
            "embedding": embedding_str,
            "threshold": similarity_threshold,
            "limit": top_k,
        }

        if platform:
            filters.append("ke.extra_data->>'platform' = :platform")
            params["platform"] = platform

        if project_type:
            filters.append("ke.extra_data->>'project_type' = :project_type")
            params["project_type"] = project_type

        if filters:
            base_query += " AND " + " AND ".join(filters)

        base_query += """
            ORDER BY similarity_score DESC
            LIMIT :limit
        """

        # Execute query
        try:
            if db_session:
                result = await db_session.execute(text(base_query), params)
                rows = result.fetchall()
            else:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    result = await session.execute(text(base_query), params)
                    rows = result.fetchall()

            # Convert to list of dicts
            results = []
            for row in rows:
                extra_data = row.extra_data or {}
                results.append({
                    "id": str(row.id),
                    "content": row.content,
                    "source_type": row.source_type,
                    "source_id": row.source_id,
                    "platform": extra_data.get("platform"),
                    "project_type": extra_data.get("project_type"),
                    "total_hours": extra_data.get("total_hours"),
                    "summary": extra_data.get("summary"),
                    "similarity_score": float(row.similarity_score),
                })

            return results

        except Exception as e:
            logger.error("Similarity search failed: %s", str(e))
            # Return empty results if table doesn't exist or other errors
            return []

    async def build_rag_context(
        self,
        query: str,
        platform: Optional[str] = None,
        project_type: Optional[str] = None,
        max_context_length: int = 8000,
        top_k: int = 5,
        db_session: Optional[AsyncSession] = None,
    ) -> str:
        """
        Build RAG context string for LLM prompt.

        Searches for similar quotes and formats them into a context
        string suitable for inclusion in the LLM prompt.

        Args:
            query: Search query (requirements text).
            platform: Optional platform filter.
            project_type: Optional project type filter.
            max_context_length: Maximum characters for context.
            top_k: Maximum number of quotes to include.
            db_session: Optional database session.

        Returns:
            Formatted context string with similar quotes.
            Returns empty string if no similar quotes found.

        Example:
            >>> context = await rag.build_rag_context(
            ...     query="WordPress blog with custom theme",
            ...     platform="wordpress",
            ...     max_context_length=5000,
            ... )
            >>> if context:
            ...     print("Found relevant historical quotes")
        """
        logger.debug(
            "Building RAG context: max_length=%d, top_k=%d",
            max_context_length,
            top_k,
        )

        # Search for similar quotes
        similar_quotes = await self.search_similar_quotes(
            query=query,
            platform=platform,
            project_type=project_type,
            top_k=top_k,
            db_session=db_session,
        )

        if not similar_quotes:
            logger.debug("No similar quotes found for RAG context")
            return ""

        # Format into context string
        context_parts: List[str] = []
        current_length = 0

        for i, quote in enumerate(similar_quotes, 1):
            # Build quote section
            quote_text = self._format_quote_for_context(quote, i)
            quote_length = len(quote_text)

            # Check if adding this quote would exceed limit
            if current_length + quote_length > max_context_length:
                logger.debug(
                    "Reached context limit at quote %d of %d",
                    i,
                    len(similar_quotes),
                )
                break

            context_parts.append(quote_text)
            current_length += quote_length

        context = "\n\n---\n\n".join(context_parts)

        logger.info(
            "Built RAG context: %d quotes, %d characters",
            len(context_parts),
            len(context),
        )

        return context

    def _format_quote_for_context(
        self,
        quote: Dict[str, Any],
        index: int,
    ) -> str:
        """
        Format a single quote for inclusion in RAG context.

        Args:
            quote: Quote data dictionary.
            index: Index for reference numbering.

        Returns:
            Formatted quote string.
        """
        platform = quote.get("platform", "Unknown")
        project_type = quote.get("project_type", "Unknown")
        total_hours = quote.get("total_hours")
        similarity = quote.get("similarity_score", 0)
        summary = quote.get("summary", "")
        content = quote.get("content", "")

        # Truncate content if too long
        max_content_length = 2000
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."

        hours_str = f"{total_hours} hours" if total_hours else "N/A"

        text = f"""### Reference Project {index}
**Platform**: {platform}
**Project Type**: {project_type}
**Total Hours**: {hours_str}
**Relevance Score**: {similarity:.2f}
"""

        if summary:
            text += f"""
**Summary**: {summary}
"""

        text += f"""
**Quote Details**:
{content}
"""

        return text

    async def search_knowledge(
        self,
        query: str,
        source_types: Optional[List[str]] = None,
        top_k: int = 10,
        similarity_threshold: float = 0.65,
        db_session: Optional[AsyncSession] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search the knowledge base for relevant content.

        More general search across all knowledge types,
        not just quotes.

        Args:
            query: Search query.
            source_types: Optional list of source types to filter
                (e.g., ['quote', 'guideline', 'documentation']).
            top_k: Number of results.
            similarity_threshold: Minimum similarity score.
            db_session: Database session.

        Returns:
            List of relevant knowledge items.

        Example:
            >>> results = await rag.search_knowledge(
            ...     query="WooCommerce performance optimization",
            ...     source_types=["documentation", "guideline"],
            ... )
        """
        logger.debug(
            "Searching knowledge: query=%s, types=%s",
            query[:50],
            source_types,
        )

        # Generate query embedding
        try:
            query_embedding = await self.client.generate_embedding(query)
        except Exception as e:
            logger.error("Failed to generate query embedding: %s", str(e))
            return []

        # Build query - use CAST() instead of :: to avoid SQLAlchemy parameter conflict
        base_query = """
            SELECT
                ke.id,
                ke.chunk_text as content,
                ke.source_type,
                ke.source_id,
                ke.extra_data,
                1 - (ke.embedding <=> CAST(:embedding AS vector)) as similarity_score
            FROM knowledge_embeddings ke
            WHERE 1 - (ke.embedding <=> CAST(:embedding AS vector)) > :threshold
        """

        # Format embedding as PostgreSQL vector string
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
        params: Dict[str, Any] = {
            "embedding": embedding_str,
            "threshold": similarity_threshold,
            "limit": top_k,
        }

        if source_types:
            placeholders = ", ".join([f":type_{i}" for i in range(len(source_types))])
            base_query += f" AND ke.source_type IN ({placeholders})"
            for i, st in enumerate(source_types):
                params[f"type_{i}"] = st

        base_query += """
            ORDER BY similarity_score DESC
            LIMIT :limit
        """

        try:
            if db_session:
                result = await db_session.execute(text(base_query), params)
                rows = result.fetchall()
            else:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    result = await session.execute(text(base_query), params)
                    rows = result.fetchall()

            return [
                {
                    "id": str(row.id),
                    "content": row.content,
                    "source_type": row.source_type,
                    "source_id": row.source_id,
                    "extra_data": row.extra_data or {},
                    "similarity_score": float(row.similarity_score),
                }
                for row in rows
            ]

        except Exception as e:
            logger.error("Knowledge search failed: %s", str(e))
            return []

    async def ingest_document(
        self,
        content: str,
        source_type: str,
        source_id: str,
        metadata: Dict[str, Any],
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        db_session: Optional[AsyncSession] = None,
    ) -> int:
        """
        Ingest a document into the knowledge base.

        Chunks the document, generates embeddings, and stores
        in the database for later retrieval.

        Args:
            content: Document content to ingest.
            source_type: Type of source (quote, guideline, documentation).
            source_id: Unique identifier for the source.
            metadata: Additional metadata for filtering.
            chunk_size: Size of text chunks in characters.
            chunk_overlap: Overlap between chunks.
            db_session: Database session.

        Returns:
            Number of embeddings created.

        Example:
            >>> count = await rag.ingest_document(
            ...     content="WordPress development quote...",
            ...     source_type="quote",
            ...     source_id="quote-123",
            ...     metadata={"platform": "wordpress", "total_hours": 40},
            ... )
            >>> print(f"Created {count} embeddings")
        """
        logger.info(
            "Ingesting document: source_type=%s, source_id=%s, length=%d",
            source_type,
            source_id,
            len(content),
        )

        # Chunk the document
        chunks = self._chunk_text(content, chunk_size, chunk_overlap)
        logger.debug("Created %d chunks", len(chunks))

        if not chunks:
            logger.warning("No chunks created from document")
            return 0

        # Generate embeddings for all chunks
        try:
            embeddings = await self.client.generate_embeddings_batch(chunks)
        except Exception as e:
            logger.error("Failed to generate embeddings: %s", str(e))
            return 0

        # Store in database - use CAST() instead of :: to avoid SQLAlchemy parameter conflict
        insert_query = """
            INSERT INTO knowledge_embeddings (
                chunk_text, embedding, source_type, source_id, extra_data, chunk_index
            ) VALUES (
                :chunk_text, CAST(:embedding AS vector), :source_type, :source_id, CAST(:extra_data AS jsonb), :chunk_index
            )
        """

        try:
            if db_session:
                session = db_session
                should_commit = False
            else:
                session_factory = get_session_factory()
                session = session_factory()
                should_commit = True

            async with session:
                for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                    # Format embedding as PostgreSQL vector string
                    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                    await session.execute(
                        text(insert_query),
                        {
                            "chunk_text": chunk,
                            "embedding": embedding_str,
                            "source_type": source_type,
                            "source_id": source_id,
                            "extra_data": json.dumps(metadata),
                            "chunk_index": i,
                        },
                    )

                if should_commit:
                    await session.commit()

            logger.info(
                "Ingested %d embeddings for %s",
                len(embeddings),
                source_id,
            )
            return len(embeddings)

        except Exception as e:
            logger.error("Failed to store embeddings: %s", str(e))
            return 0

    def _chunk_text(
        self,
        text: str,
        chunk_size: int = 512,
        overlap: int = 50,
    ) -> List[str]:
        """
        Split text into overlapping chunks.

        Args:
            text: Text to chunk.
            chunk_size: Target chunk size in characters.
            overlap: Overlap between chunks.

        Returns:
            List of text chunks.
        """
        if not text or len(text) <= chunk_size:
            return [text] if text else []

        chunks: List[str] = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at paragraph or sentence boundary
            if end < len(text):
                # Look for paragraph break
                newline_pos = text.rfind("\n\n", start, end)
                if newline_pos > start + chunk_size // 2:
                    end = newline_pos

                # Look for sentence break
                elif "." in text[start:end]:
                    period_pos = text.rfind(". ", start, end)
                    if period_pos > start + chunk_size // 2:
                        end = period_pos + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap

        return chunks

    async def delete_document_embeddings(
        self,
        source_id: str,
        db_session: Optional[AsyncSession] = None,
    ) -> int:
        """
        Delete all embeddings for a document.

        Args:
            source_id: Source ID to delete.
            db_session: Database session.

        Returns:
            Number of embeddings deleted.
        """
        logger.info("Deleting embeddings for source: %s", source_id)

        delete_query = """
            DELETE FROM knowledge_embeddings
            WHERE source_id = :source_id
        """

        try:
            if db_session:
                result = await db_session.execute(
                    text(delete_query),
                    {"source_id": source_id},
                )
                return result.rowcount
            else:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    result = await session.execute(
                        text(delete_query),
                        {"source_id": source_id},
                    )
                    await session.commit()
                    return result.rowcount

        except Exception as e:
            logger.error("Failed to delete embeddings: %s", str(e))
            return 0


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """
    Get the singleton RAG service instance.

    Returns:
        RAGService instance.
    """
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
