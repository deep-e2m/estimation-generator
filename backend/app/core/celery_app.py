"""
Celery application configuration.

This module initializes Celery for background task processing
using Redis as the message broker and result backend.
"""

from celery import Celery

from app.config import settings

# Create Celery app instance
celery_app = Celery(
    "quote_assistant",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.knowledge_tasks"],
)

# Configure Celery
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    
    # Timezone
    timezone="UTC",
    enable_utc=True,
    
    # Task tracking
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3300,  # Soft limit at 55 minutes
    
    # Results
    result_expires=3600,  # Results expire after 1 hour
    result_extended=True,  # Store additional task metadata
    
    # Worker settings
    worker_prefetch_multiplier=1,  # Fetch one task at a time
    worker_concurrency=2,  # 2 concurrent tasks
    
    # Task routing (optional, for future use)
    task_routes={
        "app.tasks.knowledge_tasks.*": {"queue": "knowledge"},
    },
    
    # Default queue
    task_default_queue="default",
    
    # Retry settings
    task_acks_late=True,  # Acknowledge after task completes
    task_reject_on_worker_lost=True,  # Requeue if worker dies
)


def get_celery_app() -> Celery:
    """
    Get the Celery application instance.
    
    Returns:
        Celery: The configured Celery application.
    """
    return celery_app
