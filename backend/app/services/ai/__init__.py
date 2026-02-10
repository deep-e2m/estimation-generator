"""
AI Services for Quote Generation.

This package provides LLM integration services using OpenRouter API
for multi-model access to GPT-4, Gemini, Claude, and Perplexity models.

Components:
- OpenRouterClient: Low-level API client with automatic fallback
- LLMService: High-level service for quote generation
- RAGService: Retrieval-augmented generation using pgvector
- KnowledgeService: Document ingestion and knowledge base management
- Prompts: Prompt templates for various tasks
"""

from app.services.ai.openrouter_client import OpenRouterClient
from app.services.ai.llm_service import LLMService
from app.services.ai.rag_service import RAGService
from app.services.ai.knowledge_service import KnowledgeService

__all__ = [
    "OpenRouterClient",
    "LLMService",
    "RAGService",
    "KnowledgeService",
]
