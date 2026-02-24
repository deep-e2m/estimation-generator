"""
RAG (Retrieval-Augmented Generation) Service.

Provides vector similarity search for finding relevant historical quotes
and knowledge base content to enhance quote generation.

Includes Redis caching for improved performance on repeated queries.
"""

import json
import logging
import statistics
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_session_factory
from app.core.redis import make_cache_key, rag_cache
from app.services.ai.openrouter_client import OpenRouterClient
from app.services.ai.static_knowledge import (
    ESTIMATION_GUIDELINES_MD,
    WORDPRESS_STACK_GUIDELINES_MD,
)

logger = logging.getLogger(__name__)

# Lazy tiktoken encoding (cl100k_base used by OpenAI text-embedding-3-small)
_tiktoken_encoding = None


def _get_tiktoken_encoding():
    """Return tiktoken encoding for cl100k_base, or None if tiktoken not installed."""
    global _tiktoken_encoding
    if _tiktoken_encoding is not None:
        return _tiktoken_encoding
    try:
        import tiktoken
        _tiktoken_encoding = tiktoken.get_encoding("cl100k_base")
        return _tiktoken_encoding
    except ImportError:
        logger.warning("tiktoken not installed; falling back to character-based chunking")
        return None


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
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None,
        db_session: Optional[AsyncSession] = None,
        use_cache: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar historical quotes using vector similarity.

        Uses pgvector for fast similarity search based on embedding
        distance between query and stored quote embeddings.

        Results are cached in Redis for 5 minutes to improve performance
        on repeated queries.

        Args:
            query: Search query (requirements text).
            platform: Optional platform filter (wordpress only).
            project_type: Optional project type filter.
            top_k: Number of results to return.
            similarity_threshold: Minimum similarity score (0-1).
            db_session: Optional database session. Creates new if not provided.
            use_cache: Whether to use Redis cache (default True).

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
        top_k = top_k if top_k is not None else settings.RAG_TOP_K_RESULTS
        similarity_threshold = (
            similarity_threshold if similarity_threshold is not None else settings.RAG_SIMILARITY_THRESHOLD
        )
        logger.info(
            "Searching similar quotes: query_length=%d, platform=%s, top_k=%d",
            len(query),
            platform,
            top_k,
        )

        # Try cache first
        if use_cache:
            cache_key = make_cache_key(
                query[:200],  # Truncate for key stability
                platform,
                project_type,
                top_k,
                similarity_threshold,
                prefix="similar",
            )
            cached_results = await rag_cache.get(cache_key)
            if cached_results is not None:
                logger.debug("Cache hit for similar quotes search")
                return cached_results

        # Generate embedding for query
        try:
            query_embedding = await self.client.generate_embedding(query)
        except Exception as e:
            logger.error("Failed to generate query embedding: %s", str(e))
            return []

        # Build and execute search query (use settings-backed top_k and threshold)
        results = await self._execute_similarity_search(
            embedding=query_embedding,
            platform=platform,
            project_type=project_type,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            db_session=db_session,
        )

        # Cache results
        if use_cache and results:
            await rag_cache.set(cache_key, results)

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
        max_context_length: Optional[int] = None,
        top_k: Optional[int] = None,
        db_session: Optional[AsyncSession] = None,
        use_cache: bool = True,
    ) -> str:
        """
        Build RAG context string for LLM prompt.

        Searches for similar quotes and formats them into a context
        string suitable for inclusion in the LLM prompt.

        Results are cached in Redis for 5 minutes to improve performance.

        Args:
            query: Search query (requirements text).
            platform: Optional platform filter.
            project_type: Optional project type filter.
            max_context_length: Maximum characters for context.
            top_k: Maximum number of quotes to include.
            db_session: Optional database session.
            use_cache: Whether to use Redis cache (default True).

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
        max_context_length = (
            max_context_length if max_context_length is not None else settings.RAG_MAX_CONTEXT_LENGTH
        )
        top_k = top_k if top_k is not None else settings.RAG_TOP_K_RESULTS
        logger.debug(
            "Building RAG context: max_length=%d, top_k=%d",
            max_context_length,
            top_k,
        )

        # Try cache first
        if use_cache:
            cache_key = make_cache_key(
                query[:200],  # Truncate for key stability
                platform,
                project_type,
                max_context_length,
                top_k,
                prefix="context",
            )
            cached_context = await rag_cache.get(cache_key)
            if cached_context is not None:
                logger.debug("Cache hit for RAG context")
                return cached_context

        # Search for similar quotes (skip cache since we're caching the full context)
        similar_quotes = await self.search_similar_quotes(
            query=query,
            platform=platform,
            project_type=project_type,
            top_k=top_k,
            db_session=db_session,
            use_cache=False,  # Avoid double caching
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

        # Cache the built context
        if use_cache and context:
            await rag_cache.set(cache_key, context)

        logger.info(
            "Built RAG context: %d quotes, %d characters",
            len(context_parts),
            len(context),
        )

        return context

    async def build_company_stack_context(
        self,
        query: str,
        top_k: int = 8,
        max_context_length: int = 12000,
        db_session: Optional[AsyncSession] = None,
        use_cache: bool = True,
    ) -> tuple[str, bool]:
        """
        Build context for company stack and estimation rules (authoritative).

        Uses search_knowledge with source_types=["guideline", "training_quote"] only
        (no "quote"). If RAG returns nothing or fails, falls back to built-in
        WORDPRESS_STACK_GUIDELINES_MD + ESTIMATION_GUIDELINES_MD.

        Returns:
            Tuple of (context_string, from_rag). from_rag is False when fallback was used.
        """
        try:
            results = await self.search_knowledge(
                query=query,
                source_types=["guideline", "training_quote"],
                top_k=top_k,
                similarity_threshold=0.6,
                db_session=db_session,
                use_cache=use_cache,
            )
            if not results:
                logger.debug("No company stack from RAG; using built-in fallback")
                fallback = f"{ESTIMATION_GUIDELINES_MD}\n\n---\n\n{WORDPRESS_STACK_GUIDELINES_MD}"
                return (fallback[:max_context_length] if len(fallback) > max_context_length else fallback, False)
            parts: List[str] = []
            current_length = 0
            for r in results:
                content = (r.get("content") or "").strip()
                if not content:
                    continue
                if current_length + len(content) > max_context_length:
                    break
                parts.append(content)
                current_length += len(content)
            if not parts:
                fallback = f"{ESTIMATION_GUIDELINES_MD}\n\n---\n\n{WORDPRESS_STACK_GUIDELINES_MD}"
                return (fallback[:max_context_length] if len(fallback) > max_context_length else fallback, False)
            context = "\n\n---\n\n".join(parts)
            logger.info("Company stack context from RAG: %d items, %d chars", len(parts), len(context))
            return (context, True)
        except Exception as e:
            logger.warning("Company stack RAG failed, using built-in fallback: %s", e)
            fallback = f"{ESTIMATION_GUIDELINES_MD}\n\n---\n\n{WORDPRESS_STACK_GUIDELINES_MD}"
            return (fallback[:max_context_length] if len(fallback) > max_context_length else fallback, False)

    async def build_reference_estimates_context(
        self,
        query: str,
        platform: Optional[str] = None,
        top_k: int = 5,
        max_context_length: int = 8000,
        db_session: Optional[AsyncSession] = None,
        use_cache: bool = True,
    ) -> Tuple[str, Optional[Dict[str, float]]]:
        """
        Build RAG context from similar quotes only (reference estimates for structure and hours).

        Uses search_knowledge with source_types=["quote"] so that only approved/similar
        quote chunks are included, not guidelines or training docs.

        Returns:
            (context_string, calibration_band). calibration_band is None or
            {"min_hours": float, "max_hours": float, "median_hours": float} when
            at least 2 similar quotes have total_hours (for guardrail warnings).
        """
        try:
            results = await self.search_knowledge(
                query=query,
                source_types=["quote"],
                top_k=top_k,
                similarity_threshold=0.65,
                db_session=db_session,
                use_cache=use_cache,
            )
            if not results:
                return "", None
            quote_like = []
            for r in results:
                extra = r.get("extra_data") or {}
                quote_like.append({
                    "platform": extra.get("platform") or "Unknown",
                    "project_type": extra.get("project_type") or "Unknown",
                    "total_hours": extra.get("total_hours"),
                    "summary": extra.get("summary") or "",
                    "content": r.get("content") or "",
                    "similarity_score": r.get("similarity_score", 0),
                })
            context_parts: List[str] = []
            current_length = 0
            for i, q in enumerate(quote_like, 1):
                quote_text = self._format_quote_for_context(q, i)
                if current_length + len(quote_text) > max_context_length:
                    break
                context_parts.append(quote_text)
                current_length += len(quote_text)
            # Calibration band: median/min/max from similar quotes (≥2 with hours)
            hours_list = [
                float(q["total_hours"])
                for q in quote_like
                if q.get("total_hours") is not None
                and isinstance(q["total_hours"], (int, float))
            ]
            calibration_band: Optional[Dict[str, float]] = None
            if len(hours_list) >= 2:
                median_h = statistics.median(hours_list)
                min_h = min(hours_list)
                max_h = max(hours_list)
                calibration_band = {"min_hours": min_h, "max_hours": max_h, "median_hours": median_h}
                calibration_line = (
                    f"Similar past projects (calibration only): median {median_h:.0f} hours (range {min_h:.0f}–{max_h:.0f}). "
                    "Use this only as a sanity check; derive your estimate from the current brief."
                )
                context_parts.append(calibration_line)
            return "\n\n---\n\n".join(context_parts) if context_parts else "", calibration_band
        except Exception as e:
            logger.warning("Reference estimates context failed: %s", e)
            return "", None

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
        use_cache: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Search the knowledge base for relevant content.

        More general search across all knowledge types,
        not just quotes. Results are cached in Redis.

        Args:
            query: Search query.
            source_types: Optional list of source types to filter
                (e.g., ['quote', 'guideline', 'documentation']).
            top_k: Number of results.
            similarity_threshold: Minimum similarity score.
            db_session: Database session.
            use_cache: Whether to use Redis cache (default True).

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

        # Try cache first
        if use_cache:
            cache_key = make_cache_key(
                query[:200],
                source_types,
                top_k,
                similarity_threshold,
                prefix="knowledge",
            )
            cached_results = await rag_cache.get(cache_key)
            if cached_results is not None:
                logger.debug("Cache hit for knowledge search")
                return cached_results

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

            results = [
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

            # Cache results
            if use_cache and results:
                await rag_cache.set(cache_key, results)

            return results

        except Exception as e:
            logger.error("Knowledge search failed: %s", str(e))
            return []

    async def ingest_document(
        self,
        content: str,
        source_type: str,
        source_id: str,
        metadata: Dict[str, Any],
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
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
            chunk_size: Size of text chunks in tokens (uses tiktoken when available).
            chunk_overlap: Overlap between chunks in tokens.
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
        chunk_size = chunk_size if chunk_size is not None else settings.KNOWLEDGE_CHUNK_SIZE
        chunk_overlap = chunk_overlap if chunk_overlap is not None else settings.KNOWLEDGE_CHUNK_OVERLAP

        logger.info(
            "Ingesting document: source_type=%s, source_id=%s, length=%d",
            source_type,
            source_id,
            len(content),
        )

        # Chunk the document (chunk_size and chunk_overlap are in tokens when tiktoken available)
        chunks = self._chunk_text_by_tokens(content, chunk_size, chunk_overlap)
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
                # Do not use "async with session" — caller owns the session; we must not close it
                for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
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
            else:
                session_factory = get_session_factory()
                async with session_factory() as session:
                    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
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

    def _chunk_text_by_tokens(
        self,
        text: str,
        chunk_size_tokens: int = 512,
        overlap_tokens: int = 50,
    ) -> List[str]:
        """
        Split text into overlapping chunks by token count (tiktoken cl100k_base).

        Falls back to character-based chunking (~4 chars per token) if tiktoken
        is not available.

        Args:
            text: Text to chunk.
            chunk_size_tokens: Target chunk size in tokens.
            overlap_tokens: Overlap between chunks in tokens.

        Returns:
            List of text chunks.
        """
        if not text:
            return []

        enc = _get_tiktoken_encoding()
        if enc is not None:
            return self._chunk_tokens_tiktoken(text, enc, chunk_size_tokens, overlap_tokens)
        # Fallback: approximate tokens as 4 chars per token
        char_size = chunk_size_tokens * 4
        char_overlap = overlap_tokens * 4
        return self._chunk_text(text, char_size, char_overlap)

    def _chunk_tokens_tiktoken(
        self,
        text: str,
        encoding: Any,
        chunk_size_tokens: int,
        overlap_tokens: int,
    ) -> List[str]:
        """Split text by token boundaries using tiktoken encoding."""
        tokens = encoding.encode(text)
        if len(tokens) <= chunk_size_tokens:
            return [text] if text else []

        step = max(1, chunk_size_tokens - overlap_tokens)
        chunks: List[str] = []
        start = 0
        while start < len(tokens):
            end = min(start + chunk_size_tokens, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = encoding.decode(chunk_tokens)
            if chunk_text.strip():
                chunks.append(chunk_text)
            start += step
        return chunks

    def _chunk_text(
        self,
        text: str,
        chunk_size: int,
        overlap: int,
    ) -> List[str]:
        """
        Split text into overlapping chunks by character count (fallback).

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
                newline_pos = text.rfind("\n\n", start, end)
                if newline_pos > start + chunk_size // 2:
                    end = newline_pos
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
