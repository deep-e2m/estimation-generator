"""
Chat API endpoints.

This module provides endpoints for chat functionality including
message sending, history retrieval, and streaming responses.
"""

import json
import logging
import time
from math import ceil
from typing import AsyncGenerator, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import ActiveUser, DbSession, api_error, get_project_with_access
from app.models.chat_message import ChatMessage, MessageRole
from app.models.project import Project
from app.models.quote import Quote
from app.schemas.chat import (
    Attachment,
    ChatHistoryData,
    ChatHistoryResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatMessageWithUser,
    ChatResponseMetadata,
    ChatSendDataResponse,
    ChatSendResponse,
    ChatStreamRequest,
    ProjectChatContext,
)
from app.schemas.project import PaginationMeta
from app.services.ai.llm_service import LLMService, get_llm_service

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================


async def get_conversation_context(
    project_id: UUID,
    db,
    max_messages: int = 20,
) -> list[dict[str, str]]:
    """Get recent conversation history for context."""
    query = (
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(max_messages)
    )
    result = await db.execute(query)
    messages = result.scalars().all()

    messages = list(reversed(messages))

    return [
        {"role": msg.role.value, "content": msg.content}
        for msg in messages
    ]


async def build_project_context(
    project: Project,
    db,
) -> dict:
    """Build project context for AI responses."""
    quote_query = (
        select(Quote)
        .where(Quote.project_id == project.id)
        .order_by(Quote.created_at.desc())
        .limit(3)
    )
    result = await db.execute(quote_query)
    recent_quotes = result.scalars().all()

    quote_summaries = [
        {
            "title": q.title,
            "total_hours": float(q.total_hours),
            "status": q.status.value,
        }
        for q in recent_quotes
    ]

    return {
        "project_name": project.name,
        "platform": project.platform.value,
        "description": project.description,
        "additional_instructions": project.additional_instructions,
        "recent_quotes": quote_summaries,
    }


# =============================================================================
# Chat History Endpoint
# =============================================================================


@router.get(
    "/projects/{project_id}/chat",
    response_model=ChatHistoryResponse,
    summary="Get chat history",
    description="Returns paginated chat history for a project.",
    responses={
        200: {"description": "Chat history retrieved successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
    },
)
async def get_chat_history(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=50, ge=1, le=100, description="Items per page (max 100)"),
) -> ChatHistoryResponse:
    """
    Get chat history for a project.

    Returns messages in chronological order (oldest first within page).
    Pagination returns most recent messages first (page 1 = newest).
    """
    logger.debug("Getting chat history: project=%s, page=%d", project_id, page)

    project = await get_project_with_access(project_id, current_user, db)

    # Get real total count (no artificial cap)
    count_query = select(func.count()).where(ChatMessage.project_id == project_id)
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0

    total_pages = ceil(total_items / page_size) if total_items > 0 else 1
    offset = (page - 1) * page_size

    # Fetch messages with user info eagerly loaded
    query = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.user))
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    messages = result.scalars().all()

    # Reverse for chronological order within page
    message_responses = [
        ChatMessageWithUser(
            id=msg.id,
            project_id=msg.project_id,
            user_id=msg.user_id,
            role=msg.role,
            content=msg.content,
            attachments=[
                Attachment(**att) for att in msg.attachments
            ] if msg.attachments else None,
            extra_data=msg.extra_data,
            created_at=msg.created_at,
            user_name=msg.user.full_name if msg.user else None,
            user_avatar=msg.user.avatar_url if msg.user else None,
        )
        for msg in reversed(messages)
    ]

    pagination = PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )

    return ChatHistoryResponse(
        success=True,
        data=ChatHistoryData(
            messages=message_responses,
            pagination=pagination,
            project_id=project.id,
            project_name=project.name,
        ),
    )


# =============================================================================
# Chat Send Endpoint
# =============================================================================


@router.post(
    "/projects/{project_id}/chat",
    response_model=ChatSendDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a chat message",
    description="Sends a message and receives an AI response.",
    responses={
        201: {"description": "Message sent and response received"},
        400: {"description": "Validation error"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
        500: {"description": "AI response generation failed"},
    },
)
async def send_chat_message(
    project_id: UUID,
    message_data: ChatMessageCreate,
    current_user: ActiveUser,
    db: DbSession,
) -> ChatSendDataResponse:
    logger.info("Chat message: project=%s, user=%s", project_id, current_user.email)

    start_time = time.time()

    project = await get_project_with_access(project_id, current_user, db)

    attachments = None
    if message_data.attachments:
        attachments = [
            {"id": att.file_id, "name": "attachment", "type": "file", "url": ""}
            for att in message_data.attachments
        ]

    user_message = ChatMessage(
        project_id=project_id,
        user_id=current_user.id,
        role=MessageRole.USER,
        content=message_data.content,
        attachments=attachments,
    )
    db.add(user_message)
    await db.flush()

    conversation = await get_conversation_context(project_id, db)
    conversation.append({"role": "user", "content": message_data.content})

    project_context = await build_project_context(project, db)

    try:
        llm_service = get_llm_service()
        response_content = await llm_service.chat_response(
            messages=conversation,
            project_context=project_context,
        )
    except Exception as e:
        logger.error("Chat response generation failed: %s", str(e))
        await db.rollback()
        raise api_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "CHAT_RESPONSE_FAILED",
            f"Failed to generate response: {str(e)}",
        )

    response_time_ms = int((time.time() - start_time) * 1000)

    assistant_message = ChatMessage(
        project_id=project_id,
        user_id=None,
        role=MessageRole.ASSISTANT,
        content=response_content,
        extra_data={
            "model_used": "fast",
            "response_time_ms": response_time_ms,
        },
    )
    db.add(assistant_message)
    await db.commit()

    await db.refresh(user_message)
    await db.refresh(assistant_message)

    logger.info(
        "Chat response: project=%s, time=%dms",
        project_id,
        response_time_ms,
    )

    return ChatSendDataResponse(
        success=True,
        data=ChatSendResponse(
            user_message=ChatMessageResponse(
                id=user_message.id,
                project_id=user_message.project_id,
                user_id=user_message.user_id,
                role=user_message.role,
                content=user_message.content,
                attachments=[
                    Attachment(**att) for att in user_message.attachments
                ] if user_message.attachments else None,
                extra_data=user_message.extra_data,
                created_at=user_message.created_at,
            ),
            assistant_message=ChatMessageResponse(
                id=assistant_message.id,
                project_id=assistant_message.project_id,
                user_id=assistant_message.user_id,
                role=assistant_message.role,
                content=assistant_message.content,
                attachments=None,
                extra_data=assistant_message.extra_data,
                created_at=assistant_message.created_at,
            ),
            response_metadata=ChatResponseMetadata(
                model_used="fast",
                tokens_used=0,
                response_time_ms=response_time_ms,
                rag_context_used=False,
            ),
        ),
    )


# =============================================================================
# Chat Streaming Endpoint
# =============================================================================


@router.post(
    "/projects/{project_id}/chat/stream",
    summary="Stream chat response",
    description="Sends a message and streams the AI response using Server-Sent Events.",
    responses={
        200: {"description": "Streaming response"},
        400: {"description": "Validation error"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
    },
)
async def stream_chat_response(
    project_id: UUID,
    message_data: ChatStreamRequest,
    current_user: ActiveUser,
    db: DbSession,
) -> StreamingResponse:
    logger.info("Chat stream: project=%s, user=%s", project_id, current_user.email)

    project = await get_project_with_access(project_id, current_user, db)

    attachments = None
    if message_data.attachments:
        attachments = [
            {"id": att.file_id, "name": "attachment", "type": "file", "url": ""}
            for att in message_data.attachments
        ]

    user_message = ChatMessage(
        project_id=project_id,
        user_id=current_user.id,
        role=MessageRole.USER,
        content=message_data.content,
        attachments=attachments,
    )
    db.add(user_message)
    await db.commit()
    await db.refresh(user_message)

    async def generate_stream() -> AsyncGenerator[str, None]:
        """Generate SSE stream."""
        start_time = time.time()
        full_response = ""
        tokens_used = 0

        try:
            conversation = await get_conversation_context(project_id, db)
            conversation.append({"role": "user", "content": message_data.content})

            project_context = None
            if message_data.include_context:
                project_context = await build_project_context(project, db)

            llm_service = get_llm_service()

            async for chunk in llm_service.chat_response_stream(
                messages=conversation,
                project_context=project_context,
            ):
                full_response += chunk
                data = json.dumps({"type": "content", "content": chunk})
                yield f"data: {data}\n\n"

            response_time_ms = int((time.time() - start_time) * 1000)

            assistant_message = ChatMessage(
                project_id=project_id,
                user_id=None,
                role=MessageRole.ASSISTANT,
                content=full_response,
                extra_data={
                    "model_used": "fast",
                    "response_time_ms": response_time_ms,
                    "streamed": True,
                },
            )
            db.add(assistant_message)
            await db.commit()
            await db.refresh(assistant_message)

            metadata = {
                "type": "metadata",
                "metadata": {
                    "model_used": "fast",
                    "tokens_used": tokens_used,
                    "response_time_ms": response_time_ms,
                    "rag_context_used": False,
                },
            }
            yield f"data: {json.dumps(metadata)}\n\n"

            done = {
                "type": "done",
                "message_id": str(assistant_message.id),
            }
            yield f"data: {json.dumps(done)}\n\n"

            logger.info(
                "Chat stream complete: project=%s, time=%dms",
                project_id,
                response_time_ms,
            )

        except Exception as e:
            logger.error("Chat stream error: %s", str(e))
            error = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error)}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
