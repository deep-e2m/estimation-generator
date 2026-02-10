"""
Knowledge Base API endpoints.

This module provides endpoints for knowledge base management including
ingestion, statistics, and search functionality.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import AdminUser, ActiveUser, DbSession
from app.schemas.knowledge import (
    DocumentDeleteResponse,
    DocumentDeleteResult,
    DocumentIngestResponse,
    DocumentIngestResult,
    FullIngestionResponse,
    FullIngestionResult,
    KnowledgeDocumentIngest,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgeIngestResult,
    KnowledgeSearchData,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeSearchResult,
    KnowledgeStats,
    KnowledgeStatsResponse,
    SourceTypeStats,
)
from app.services.ai.knowledge_service import KnowledgeService, get_knowledge_service
from app.services.ai.rag_service import RAGService, get_rag_service

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Knowledge Ingestion Endpoints
# =============================================================================


@router.post(
    "/ingest",
    response_model=FullIngestionResponse,
    summary="Trigger knowledge base ingestion",
    description="Triggers ingestion of training files into the knowledge base. Admin only.",
    responses={
        200: {"description": "Ingestion completed"},
        401: {"description": "Not authenticated"},
        403: {"description": "Admin access required"},
        500: {"description": "Ingestion failed"},
    },
)
async def ingest_knowledge(
    request: KnowledgeIngestRequest,
    current_user: AdminUser,
    db: DbSession,
) -> FullIngestionResponse:
    """
    Trigger knowledge base ingestion.

    Ingests training files, guidelines, and other documents into
    the vector knowledge base for RAG retrieval.

    Args:
        request: Ingestion configuration.
        current_user: The authenticated admin user.
        db: Database session.

    Returns:
        FullIngestionResponse: Ingestion results.
    """
    logger.info(
        "Knowledge ingestion triggered: user=%s, source_type=%s",
        current_user.email,
        request.source_type,
    )

    try:
        knowledge_service = get_knowledge_service()

        # Determine what to ingest
        if request.source_type == "all" or request.source_type is None:
            # Full ingestion
            result = await knowledge_service.ingest_all_knowledge(db_session=db)

            return FullIngestionResponse(
                success=True,
                data=FullIngestionResult(
                    training_quotes=KnowledgeIngestResult(
                        files_found=result["training_quotes"]["files_found"],
                        files_processed=result["training_quotes"]["files_processed"],
                        files_failed=result["training_quotes"]["files_failed"],
                        total_embeddings=result["training_quotes"]["total_embeddings"],
                        errors=result["training_quotes"]["errors"],
                    ),
                    guidelines=KnowledgeIngestResult(
                        files_found=result["guidelines"]["files_found"],
                        files_processed=result["guidelines"]["files_processed"],
                        files_failed=result["guidelines"]["files_failed"],
                        total_embeddings=result["guidelines"]["total_embeddings"],
                        errors=result["guidelines"]["errors"],
                    ),
                    root_quotes=KnowledgeIngestResult(
                        files_found=result["root_quotes"]["files_found"],
                        files_processed=result["root_quotes"]["files_processed"],
                        files_failed=result["root_quotes"]["files_failed"],
                        total_embeddings=result["root_quotes"]["total_embeddings"],
                        errors=result["root_quotes"]["errors"],
                    ),
                    total_embeddings=result["total_embeddings"],
                    total_files=result["total_files"],
                    total_errors=result["total_errors"],
                ),
            )

        elif request.source_type == "training_quotes":
            result = await knowledge_service.ingest_training_files(
                folder_path=request.folder_path,
                file_pattern=request.file_pattern,
                db_session=db,
            )

        elif request.source_type == "guidelines":
            result = await knowledge_service.ingest_guidelines(
                folder_path=request.folder_path,
                db_session=db,
            )

        else:
            # Custom folder path
            if not request.folder_path:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "INVALID_REQUEST",
                        "message": "folder_path required for custom source_type",
                    },
                )

            result = await knowledge_service.ingest_training_files(
                folder_path=request.folder_path,
                file_pattern=request.file_pattern,
                db_session=db,
            )

        # For single source ingestion, return as full result with zeros for others
        return FullIngestionResponse(
            success=True,
            data=FullIngestionResult(
                training_quotes=KnowledgeIngestResult(
                    files_found=result["files_found"] if request.source_type == "training_quotes" else 0,
                    files_processed=result["files_processed"] if request.source_type == "training_quotes" else 0,
                    files_failed=result["files_failed"] if request.source_type == "training_quotes" else 0,
                    total_embeddings=result["total_embeddings"] if request.source_type == "training_quotes" else 0,
                    errors=result["errors"] if request.source_type == "training_quotes" else [],
                ),
                guidelines=KnowledgeIngestResult(
                    files_found=result["files_found"] if request.source_type == "guidelines" else 0,
                    files_processed=result["files_processed"] if request.source_type == "guidelines" else 0,
                    files_failed=result["files_failed"] if request.source_type == "guidelines" else 0,
                    total_embeddings=result["total_embeddings"] if request.source_type == "guidelines" else 0,
                    errors=result["errors"] if request.source_type == "guidelines" else [],
                ),
                root_quotes=KnowledgeIngestResult(
                    files_found=0,
                    files_processed=0,
                    files_failed=0,
                    total_embeddings=0,
                    errors=[],
                ),
                total_embeddings=result["total_embeddings"],
                total_files=result["files_processed"],
                total_errors=result["errors"],
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Knowledge ingestion failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INGESTION_FAILED",
                "message": f"Knowledge ingestion failed: {str(e)}",
            },
        )


@router.post(
    "/ingest/document",
    response_model=DocumentIngestResponse,
    summary="Ingest a single document",
    description="Ingests a single document into the knowledge base. Admin only.",
    responses={
        200: {"description": "Document ingested"},
        401: {"description": "Not authenticated"},
        403: {"description": "Admin access required"},
        500: {"description": "Ingestion failed"},
    },
)
async def ingest_document(
    document: KnowledgeDocumentIngest,
    current_user: AdminUser,
    db: DbSession,
) -> DocumentIngestResponse:
    """
    Ingest a single document into the knowledge base.

    Args:
        document: Document content and metadata.
        current_user: The authenticated admin user.
        db: Database session.

    Returns:
        DocumentIngestResponse: Ingestion result.
    """
    logger.info(
        "Document ingestion: user=%s, source_type=%s, source_id=%s",
        current_user.email,
        document.source_type,
        document.source_id,
    )

    try:
        rag_service = get_rag_service()

        # Delete existing embeddings for this source
        await rag_service.delete_document_embeddings(
            source_id=document.source_id,
            db_session=db,
        )

        # Ingest document
        embeddings_created = await rag_service.ingest_document(
            content=document.content,
            source_type=document.source_type,
            source_id=document.source_id,
            metadata=document.metadata,
            chunk_size=document.chunk_size,
            chunk_overlap=document.chunk_overlap,
            db_session=db,
        )

        logger.info(
            "Document ingested: source_id=%s, embeddings=%d",
            document.source_id,
            embeddings_created,
        )

        return DocumentIngestResponse(
            success=True,
            data=DocumentIngestResult(
                source_id=document.source_id,
                embeddings_created=embeddings_created,
                chunks_created=embeddings_created,  # 1:1 with embeddings
            ),
        )

    except Exception as e:
        logger.error("Document ingestion failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DOCUMENT_INGESTION_FAILED",
                "message": f"Failed to ingest document: {str(e)}",
            },
        )


@router.delete(
    "/documents/{source_id}",
    response_model=DocumentDeleteResponse,
    summary="Delete document embeddings",
    description="Deletes all embeddings for a document. Admin only.",
    responses={
        200: {"description": "Document embeddings deleted"},
        401: {"description": "Not authenticated"},
        403: {"description": "Admin access required"},
        500: {"description": "Deletion failed"},
    },
)
async def delete_document(
    source_id: str,
    current_user: AdminUser,
    db: DbSession,
) -> DocumentDeleteResponse:
    """
    Delete all embeddings for a document.

    Args:
        source_id: The source document ID.
        current_user: The authenticated admin user.
        db: Database session.

    Returns:
        DocumentDeleteResponse: Deletion result.
    """
    logger.info(
        "Document deletion: user=%s, source_id=%s",
        current_user.email,
        source_id,
    )

    try:
        rag_service = get_rag_service()

        embeddings_deleted = await rag_service.delete_document_embeddings(
            source_id=source_id,
            db_session=db,
        )

        logger.info(
            "Document deleted: source_id=%s, embeddings=%d",
            source_id,
            embeddings_deleted,
        )

        return DocumentDeleteResponse(
            success=True,
            data=DocumentDeleteResult(
                source_id=source_id,
                embeddings_deleted=embeddings_deleted,
            ),
        )

    except Exception as e:
        logger.error("Document deletion failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DOCUMENT_DELETION_FAILED",
                "message": f"Failed to delete document: {str(e)}",
            },
        )


# =============================================================================
# Knowledge Statistics Endpoint
# =============================================================================


@router.get(
    "/stats",
    response_model=KnowledgeStatsResponse,
    summary="Get knowledge base statistics",
    description="Returns statistics about the knowledge base.",
    responses={
        200: {"description": "Statistics retrieved"},
        401: {"description": "Not authenticated"},
    },
)
async def get_knowledge_stats(
    current_user: ActiveUser,
    db: DbSession,
) -> KnowledgeStatsResponse:
    """
    Get knowledge base statistics.

    Returns counts of embeddings and documents by source type.

    Args:
        current_user: The authenticated user.
        db: Database session.

    Returns:
        KnowledgeStatsResponse: Knowledge base statistics.
    """
    logger.debug("Getting knowledge stats: user=%s", current_user.email)

    try:
        knowledge_service = get_knowledge_service()
        stats = await knowledge_service.get_knowledge_stats(db_session=db)

        # Convert to response format
        by_type = {
            source_type: SourceTypeStats(
                embeddings=data["embeddings"],
                documents=data["documents"],
            )
            for source_type, data in stats.get("by_type", {}).items()
        }

        return KnowledgeStatsResponse(
            success=True,
            data=KnowledgeStats(
                by_type=by_type,
                total_embeddings=stats.get("total_embeddings", 0),
                total_documents=stats.get("total_documents", 0),
                error=stats.get("error"),
            ),
        )

    except Exception as e:
        logger.error("Failed to get knowledge stats: %s", str(e))
        return KnowledgeStatsResponse(
            success=True,
            data=KnowledgeStats(
                by_type={},
                total_embeddings=0,
                total_documents=0,
                error=str(e),
            ),
        )


# =============================================================================
# Knowledge Search Endpoint
# =============================================================================


@router.post(
    "/search",
    response_model=KnowledgeSearchResponse,
    summary="Search knowledge base",
    description="Searches the knowledge base for relevant content.",
    responses={
        200: {"description": "Search completed"},
        400: {"description": "Invalid search parameters"},
        401: {"description": "Not authenticated"},
        500: {"description": "Search failed"},
    },
)
async def search_knowledge(
    request: KnowledgeSearchRequest,
    current_user: ActiveUser,
    db: DbSession,
) -> KnowledgeSearchResponse:
    """
    Search the knowledge base.

    Performs vector similarity search to find relevant content
    based on the query.

    Args:
        request: Search parameters.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        KnowledgeSearchResponse: Search results.
    """
    logger.info(
        "Knowledge search: user=%s, query=%s, top_k=%d",
        current_user.email,
        request.query[:50],
        request.top_k,
    )

    try:
        rag_service = get_rag_service()

        # Search knowledge base
        if request.platform:
            # Use quote-specific search with platform filter
            results = await rag_service.search_similar_quotes(
                query=request.query,
                platform=request.platform,
                top_k=request.top_k,
                similarity_threshold=request.similarity_threshold,
                db_session=db,
            )
        else:
            # Use general knowledge search
            results = await rag_service.search_knowledge(
                query=request.query,
                source_types=request.source_types,
                top_k=request.top_k,
                similarity_threshold=request.similarity_threshold,
                db_session=db,
            )

        # Convert to response format
        search_results = [
            KnowledgeSearchResult(
                id=r.get("id", ""),
                content=r.get("content", ""),
                source_type=r.get("source_type", ""),
                source_id=r.get("source_id", ""),
                similarity_score=r.get("similarity_score", 0.0),
                metadata=r.get("metadata", {}),
                platform=r.get("platform"),
                project_type=r.get("project_type"),
                total_hours=r.get("total_hours"),
                summary=r.get("summary"),
            )
            for r in results
        ]

        logger.info(
            "Knowledge search complete: query=%s, results=%d",
            request.query[:50],
            len(search_results),
        )

        return KnowledgeSearchResponse(
            success=True,
            data=KnowledgeSearchData(
                results=search_results,
                query=request.query,
                result_count=len(search_results),
            ),
        )

    except Exception as e:
        logger.error("Knowledge search failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "SEARCH_FAILED",
                "message": f"Knowledge search failed: {str(e)}",
            },
        )
