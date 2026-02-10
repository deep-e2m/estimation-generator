"""
Chat schemas for request/response validation.

This module defines Pydantic schemas for chat-related endpoints
including message sending, history retrieval, and streaming.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.chat_message import MessageRole
from app.schemas.auth import APIResponse
from app.schemas.project import PaginationMeta


# =============================================================================
# Attachment Schemas
# =============================================================================


class Attachment(BaseModel):
    """Schema for file attachments in chat messages."""

    id: str = Field(..., description="Unique attachment identifier")
    name: str = Field(..., description="Original file name")
    type: str = Field(..., description="MIME type of the file")
    url: str = Field(..., description="URL to access the file")
    size: Optional[int] = Field(None, description="File size in bytes")


class AttachmentUpload(BaseModel):
    """Schema for attachment upload reference."""

    file_id: str = Field(
        ...,
        description="ID of the previously uploaded file",
    )


# =============================================================================
# Chat Message Schemas
# =============================================================================


class ChatMessageCreate(BaseModel):
    """Schema for creating a new chat message."""

    content: str = Field(
        ...,
        min_length=1,
        max_length=50000,
        description="Message content",
        examples=["Can you help me estimate a WordPress site with WooCommerce?"],
    )
    attachments: Optional[list[AttachmentUpload]] = Field(
        default=None,
        max_length=10,
        description="List of attachment references (max 10)",
    )


class ChatStreamRequest(ChatMessageCreate):
    """Schema for streaming chat request."""

    include_context: bool = Field(
        default=True,
        description="Whether to include project context in the AI response",
    )


class ChatMessageResponse(BaseModel):
    """Schema for chat message data in responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique message identifier")
    project_id: UUID = Field(..., description="ID of the parent project")
    user_id: Optional[UUID] = Field(None, description="ID of the user (null for assistant)")
    role: MessageRole = Field(..., description="Message role (user/assistant/system)")
    content: str = Field(..., description="Message content")
    attachments: Optional[list[Attachment]] = Field(None, description="File attachments")
    extra_data: Optional[dict[str, Any]] = Field(None, description="Additional metadata")
    created_at: datetime = Field(..., description="Message creation timestamp")


class ChatMessageWithUser(ChatMessageResponse):
    """Chat message response with user information."""

    user_name: Optional[str] = Field(None, description="Name of the user who sent the message")
    user_avatar: Optional[str] = Field(None, description="URL to user's avatar")


# =============================================================================
# Chat Response Schemas
# =============================================================================


class ChatResponseMetadata(BaseModel):
    """Metadata about the AI response generation."""

    model_used: str = Field(..., description="LLM model used for the response")
    tokens_used: int = Field(..., description="Total tokens consumed")
    response_time_ms: int = Field(..., description="Response generation time in milliseconds")
    rag_context_used: bool = Field(default=False, description="Whether RAG context was used")


class ChatSendResponse(BaseModel):
    """Response data for sending a chat message."""

    user_message: ChatMessageResponse = Field(..., description="The user's message")
    assistant_message: ChatMessageResponse = Field(..., description="The AI assistant's response")
    response_metadata: ChatResponseMetadata = Field(..., description="Response generation metadata")


# =============================================================================
# Chat History Schemas
# =============================================================================


class ChatHistoryData(BaseModel):
    """Data container for chat history response."""

    messages: list[ChatMessageWithUser] = Field(..., description="List of chat messages")
    pagination: PaginationMeta = Field(..., description="Pagination information")
    project_id: UUID = Field(..., description="ID of the project")
    project_name: str = Field(..., description="Name of the project")


class ChatHistoryResponse(APIResponse):
    """Response schema for chat history endpoint."""

    data: ChatHistoryData = Field(..., description="Chat history data with pagination")


# =============================================================================
# Single Message Response Schemas
# =============================================================================


class ChatSendDataResponse(APIResponse):
    """Response schema for sending a chat message."""

    data: ChatSendResponse = Field(..., description="Chat send response data")


class ChatMessageDataResponse(APIResponse):
    """Response schema for single message operations."""

    data: ChatMessageResponse = Field(..., description="Chat message data")


# =============================================================================
# Streaming Schemas
# =============================================================================


class StreamChunk(BaseModel):
    """Schema for a streaming response chunk (SSE)."""

    type: str = Field(
        ...,
        description="Chunk type: 'content', 'metadata', 'error', 'done'",
    )
    content: Optional[str] = Field(
        default=None,
        description="Content chunk for 'content' type",
    )
    metadata: Optional[ChatResponseMetadata] = Field(
        default=None,
        description="Response metadata for 'metadata' type",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message for 'error' type",
    )
    message_id: Optional[UUID] = Field(
        default=None,
        description="ID of the completed message for 'done' type",
    )


# =============================================================================
# Context Schemas
# =============================================================================


class ProjectChatContext(BaseModel):
    """Context information for chat interactions."""

    project_id: UUID = Field(..., description="Project ID")
    project_name: str = Field(..., description="Project name")
    platform: str = Field(..., description="Target platform")
    description: Optional[str] = Field(None, description="Project description")
    quote_count: int = Field(default=0, description="Number of quotes in the project")
    recent_quotes: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Summary of recent quotes for context",
    )
