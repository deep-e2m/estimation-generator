"""
Database models package.

This module exports all SQLAlchemy models for the application.
"""

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDMixin
from app.models.chat_message import ChatMessage, MessageRole
from app.models.client import Client
from app.models.document import Document, DocumentType
from app.models.knowledge_embedding import KnowledgeEmbedding
from app.models.project import Platform, Project, ProjectStatus
from app.models.quote import Complexity, Quote, QuoteStatus
from app.models.user import User, UserRole

__all__ = [
    # Base and mixins
    "Base",
    "UUIDMixin",
    "TimestampMixin",
    "SoftDeleteMixin",
    # User model
    "User",
    "UserRole",
    # Client model
    "Client",
    # Project model
    "Project",
    "Platform",
    "ProjectStatus",
    # Quote model
    "Quote",
    "QuoteStatus",
    "Complexity",
    # Chat message model
    "ChatMessage",
    "MessageRole",
    # Document model
    "Document",
    "DocumentType",
    # Knowledge embedding model
    "KnowledgeEmbedding",
]
