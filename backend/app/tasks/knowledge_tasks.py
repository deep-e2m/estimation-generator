"""
Celery tasks for knowledge base operations.

These tasks run long-running knowledge ingestion operations
in the background using Celery workers.
"""

import asyncio
import logging
from typing import Any, Dict, Optional

from celery import shared_task

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


def run_async(coro):
    """
    Run an async coroutine in a synchronous context.
    
    Celery tasks are synchronous, so we need to run async
    database operations in an event loop.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    name="app.tasks.knowledge_tasks.ingest_all_knowledge",
    max_retries=3,
    default_retry_delay=60,
    track_started=True,
)
def ingest_all_knowledge_task(self) -> Dict[str, Any]:
    """
    Celery task to ingest all knowledge sources.
    
    Processes training quotes, guidelines, and root quotes.
    
    Returns:
        Dictionary with ingestion statistics.
    """
    logger.info("Starting full knowledge ingestion task: %s", self.request.id)
    
    try:
        # Import here to avoid circular imports
        from app.services.ai.knowledge_service import get_knowledge_service
        from app.core.redis import knowledge_cache
        
        service = get_knowledge_service()
        
        # Run the async function
        result = run_async(service.ingest_all_knowledge())
        
        # Invalidate knowledge stats cache
        run_async(knowledge_cache.clear())
        
        logger.info(
            "Knowledge ingestion complete: %d files, %d embeddings",
            result.get("total_files", 0),
            result.get("total_embeddings", 0),
        )
        
        return {
            "status": "completed",
            "task_id": self.request.id,
            "training_quotes": result.get("training_quotes", {}),
            "guidelines": result.get("guidelines", {}),
            "root_quotes": result.get("root_quotes", {}),
            "total_embeddings": result.get("total_embeddings", 0),
            "total_files": result.get("total_files", 0),
            "total_errors": result.get("total_errors", []),
        }
        
    except Exception as exc:
        logger.error("Knowledge ingestion task failed: %s", str(exc))
        
        # Retry on failure
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.knowledge_tasks.ingest_training_files",
    max_retries=3,
    default_retry_delay=60,
    track_started=True,
)
def ingest_training_files_task(
    self,
    folder_path: Optional[str] = None,
    file_pattern: str = "*.md",
) -> Dict[str, Any]:
    """
    Celery task to ingest training files from a folder.
    
    Args:
        folder_path: Path to folder containing training files.
        file_pattern: Glob pattern for files to process.
    
    Returns:
        Dictionary with ingestion statistics.
    """
    logger.info(
        "Starting training files ingestion task: %s (path=%s, pattern=%s)",
        self.request.id,
        folder_path,
        file_pattern,
    )
    
    try:
        from app.services.ai.knowledge_service import get_knowledge_service
        from app.core.redis import knowledge_cache
        
        service = get_knowledge_service()
        
        result = run_async(
            service.ingest_training_files(
                folder_path=folder_path,
                file_pattern=file_pattern,
            )
        )
        
        # Invalidate cache
        run_async(knowledge_cache.clear())
        
        logger.info(
            "Training files ingestion complete: %d/%d files, %d embeddings",
            result.get("files_processed", 0),
            result.get("files_found", 0),
            result.get("total_embeddings", 0),
        )
        
        return {
            "status": "completed",
            "task_id": self.request.id,
            "files_found": result.get("files_found", 0),
            "files_processed": result.get("files_processed", 0),
            "files_failed": result.get("files_failed", 0),
            "total_embeddings": result.get("total_embeddings", 0),
            "errors": result.get("errors", []),
        }
        
    except Exception as exc:
        logger.error("Training files ingestion task failed: %s", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.knowledge_tasks.ingest_guidelines",
    max_retries=3,
    default_retry_delay=60,
    track_started=True,
)
def ingest_guidelines_task(
    self,
    folder_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Celery task to ingest estimation guidelines.
    
    Args:
        folder_path: Path to guidelines folder.
    
    Returns:
        Dictionary with ingestion statistics.
    """
    logger.info(
        "Starting guidelines ingestion task: %s (path=%s)",
        self.request.id,
        folder_path,
    )
    
    try:
        from app.services.ai.knowledge_service import get_knowledge_service
        from app.core.redis import knowledge_cache
        
        service = get_knowledge_service()
        
        result = run_async(
            service.ingest_guidelines(folder_path=folder_path)
        )
        
        # Invalidate cache
        run_async(knowledge_cache.clear())
        
        logger.info(
            "Guidelines ingestion complete: %d files, %d embeddings",
            result.get("files_processed", 0),
            result.get("total_embeddings", 0),
        )
        
        return {
            "status": "completed",
            "task_id": self.request.id,
            "files_found": result.get("files_found", 0),
            "files_processed": result.get("files_processed", 0),
            "files_failed": result.get("files_failed", 0),
            "total_embeddings": result.get("total_embeddings", 0),
            "errors": result.get("errors", []),
        }
        
    except Exception as exc:
        logger.error("Guidelines ingestion task failed: %s", str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.knowledge_tasks.ingest_document",
    max_retries=3,
    default_retry_delay=30,
    track_started=True,
)
def ingest_document_task(
    self,
    content: str,
    source_type: str,
    source_id: str,
    metadata: Dict[str, Any],
    chunk_size: int = 512,
    chunk_overlap: int = 50,
) -> Dict[str, Any]:
    """
    Celery task to ingest a single document.
    
    Args:
        content: Document content to ingest.
        source_type: Type of source (quote, guideline, etc.).
        source_id: Unique identifier for the source.
        metadata: Additional metadata for filtering.
        chunk_size: Size of text chunks.
        chunk_overlap: Overlap between chunks.
    
    Returns:
        Dictionary with ingestion result.
    """
    logger.info(
        "Starting document ingestion task: %s (source=%s/%s)",
        self.request.id,
        source_type,
        source_id,
    )
    
    try:
        from app.services.ai.rag_service import get_rag_service
        from app.core.redis import knowledge_cache, rag_cache
        
        rag_service = get_rag_service()
        
        # Delete existing embeddings for this source
        run_async(
            rag_service.delete_document_embeddings(source_id=source_id)
        )
        
        # Ingest document
        embeddings_created = run_async(
            rag_service.ingest_document(
                content=content,
                source_type=source_type,
                source_id=source_id,
                metadata=metadata,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
        )
        
        # Invalidate caches
        run_async(knowledge_cache.clear())
        run_async(rag_cache.clear())
        
        logger.info(
            "Document ingestion complete: %s - %d embeddings",
            source_id,
            embeddings_created,
        )
        
        return {
            "status": "completed",
            "task_id": self.request.id,
            "source_id": source_id,
            "embeddings_created": embeddings_created,
            "chunks_created": embeddings_created,
        }
        
    except Exception as exc:
        logger.error("Document ingestion task failed: %s", str(exc))
        raise self.retry(exc=exc)


def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get the status of a Celery task.
    
    Args:
        task_id: The Celery task ID.
    
    Returns:
        Dictionary with task status and result.
    """
    from celery.result import AsyncResult
    
    result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "status": result.status,
        "ready": result.ready(),
    }
    
    if result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.result)
    elif result.status == "STARTED":
        response["info"] = result.info
    elif result.status == "PROGRESS":
        response["progress"] = result.info
    
    return response
