"""
Celery tasks package.

This package contains all Celery background tasks for the application.
"""

from app.tasks.knowledge_tasks import (
    ingest_all_knowledge_task,
    ingest_document_task,
    ingest_guidelines_task,
    ingest_training_files_task,
)

__all__ = [
    "ingest_all_knowledge_task",
    "ingest_document_task",
    "ingest_guidelines_task",
    "ingest_training_files_task",
]
