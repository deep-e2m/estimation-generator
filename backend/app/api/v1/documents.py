"""
Document API endpoints with WebSocket support for real-time collaboration.

This module provides REST API and WebSocket endpoints for document management
and real-time collaborative editing.
"""

import json
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_current_user,
    get_project_with_access,
    get_project_with_permission,
)
from app.core.database import get_db_session as get_db
from app.models.document import Document, DocumentType
from app.models.project_share import AccessLevel
from app.models.user import User
from app.models.audit_log import ActionOutcome
from app.services import audit

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# WebSocket Connection Manager
# =============================================================================


class ConnectionManager:
    """Manages WebSocket connections for real-time collaboration."""

    def __init__(self):
        # document_id -> list of (websocket, user_id, user_name)
        self.active_connections: dict[str, list[tuple[WebSocket, str, str]]] = {}

    async def connect(
        self, websocket: WebSocket, document_id: str, user_id: str, user_name: str
    ):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        if document_id not in self.active_connections:
            self.active_connections[document_id] = []
        self.active_connections[document_id].append((websocket, user_id, user_name))

        # Notify others that a new user joined
        await self.broadcast_user_presence(document_id, user_id, user_name, "joined")

    def disconnect(self, websocket: WebSocket, document_id: str, user_id: str):
        """Remove a WebSocket connection."""
        if document_id in self.active_connections:
            self.active_connections[document_id] = [
                conn
                for conn in self.active_connections[document_id]
                if conn[0] != websocket
            ]
            if not self.active_connections[document_id]:
                del self.active_connections[document_id]

    async def broadcast_user_presence(
        self, document_id: str, user_id: str, user_name: str, action: str
    ):
        """Broadcast user presence updates."""
        if document_id in self.active_connections:
            message = {
                "type": "presence",
                "user_id": user_id,
                "user_name": user_name,
                "action": action,
                "active_users": [
                    {"id": uid, "name": uname}
                    for _, uid, uname in self.active_connections[document_id]
                ],
            }
            await self.broadcast(document_id, json.dumps(message), exclude_user=None)

    async def broadcast(
        self, document_id: str, message: str, exclude_user: str | None = None
    ):
        """Broadcast message to all connections for a document."""
        if document_id in self.active_connections:
            for websocket, user_id, _ in self.active_connections[document_id]:
                if exclude_user is None or user_id != exclude_user:
                    try:
                        await websocket.send_text(message)
                    except Exception as e:
                        logger.error(f"Error sending message to {user_id}: {e}")

    def get_active_users(self, document_id: str) -> list[dict[str, str]]:
        """Get list of active users for a document."""
        if document_id in self.active_connections:
            return [
                {"id": uid, "name": uname}
                for _, uid, uname in self.active_connections[document_id]
            ]
        return []


# Global connection manager
manager = ConnectionManager()


# =============================================================================
# Pydantic Schemas
# =============================================================================


class DocumentCreate(BaseModel):
    """Schema for creating a document."""

    title: str = Field(..., min_length=1, max_length=500)
    document_type: DocumentType = Field(default=DocumentType.QUOTE)
    content: dict[str, Any] | None = None


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""

    title: str | None = None
    content: dict[str, Any] | None = None
    plain_text: str | None = None


class DocumentResponse(BaseModel):
    """Schema for document response."""

    id: UUID
    project_id: UUID
    title: str
    content: dict[str, Any] | None
    plain_text: str | None
    document_type: DocumentType
    version: int
    created_by: UUID
    last_edited_by: UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Schema for document list response."""

    success: bool = True
    data: list[DocumentResponse]


class DocumentDataResponse(BaseModel):
    """Schema for single document response."""

    success: bool = True
    data: DocumentResponse


# =============================================================================
# REST API Endpoints
# =============================================================================


@router.get(
    "/projects/{project_id}/documents",
    response_model=DocumentListResponse,
)
async def list_documents(
    project_id: UUID,
    document_type: DocumentType | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents for a project."""
    # Verify project exists and user has access
    await get_project_with_access(project_id, current_user, db)

    query = select(Document).where(Document.project_id == project_id)
    if document_type:
        query = query.where(Document.document_type == document_type)
    query = query.order_by(Document.updated_at.desc())

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        data=[DocumentResponse.model_validate(doc) for doc in documents]
    )


@router.post(
    "/projects/{project_id}/documents",
    response_model=DocumentDataResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_document(
    project_id: UUID,
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new document."""
    # Verify project exists and user has EDIT_CONTENT permission
    project, _ = await get_project_with_permission(project_id, current_user, db, AccessLevel.EDIT_CONTENT)

    document = Document(
        project_id=project_id,
        title=document_data.title,
        content=document_data.content,
        document_type=document_data.document_type,
        created_by=current_user.id,
        last_edited_by=current_user.id,
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    logger.info(f"Document created: id={document.id}, title={document.title}")

    # Audit log: document uploaded
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="document.uploaded",
            outcome=ActionOutcome.SUCCESS,
            resource_type="document",
            resource_id=document.id,
            project_id=project_id,
            metadata=audit.with_admin_bypass({"filename": document.title}, project, current_user),
        )
    except Exception as e:
        logger.error("Failed to log audit for document upload: %s", e)

    return DocumentDataResponse(data=DocumentResponse.model_validate(document))


@router.get(
    "/projects/{project_id}/documents/{document_id}",
    response_model=DocumentDataResponse,
)
async def get_document(
    project_id: UUID,
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific document."""
    # Verify project access
    await get_project_with_access(project_id, current_user, db)

    document = await db.get(Document, document_id)
    if not document or document.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentDataResponse(data=DocumentResponse.model_validate(document))


@router.put(
    "/projects/{project_id}/documents/{document_id}",
    response_model=DocumentDataResponse,
)
async def update_document(
    project_id: UUID,
    document_id: UUID,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a document."""
    # Verify project access and EDIT_CONTENT permission
    project, _ = await get_project_with_permission(project_id, current_user, db, AccessLevel.EDIT_CONTENT)

    document = await db.get(Document, document_id)
    if not document or document.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update fields
    if document_data.title is not None:
        document.title = document_data.title
    if document_data.content is not None:
        document.content = document_data.content
    if document_data.plain_text is not None:
        document.plain_text = document_data.plain_text

    document.last_edited_by = current_user.id
    document.version += 1

    await db.commit()
    await db.refresh(document)

    logger.info(f"Document updated: id={document.id}, version={document.version}")

    return DocumentDataResponse(data=DocumentResponse.model_validate(document))


@router.delete(
    "/projects/{project_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    project_id: UUID,
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document."""
    # Verify project access and EDIT_CONTENT permission
    project, _ = await get_project_with_permission(project_id, current_user, db, AccessLevel.EDIT_CONTENT)

    document = await db.get(Document, document_id)
    if not document or document.project_id != project_id:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_title = document.title
    doc_project_id = document.project_id

    await db.delete(document)
    await db.commit()

    logger.info(f"Document deleted: id={document_id}")

    # Audit log: document deleted
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="document.deleted",
            outcome=ActionOutcome.SUCCESS,
            resource_type="document",
            resource_id=document_id,
            project_id=doc_project_id,
            metadata=audit.with_admin_bypass({"filename": doc_title}, project, current_user),
        )
    except Exception as e:
        logger.error("Failed to log audit for document deletion: %s", e)


# =============================================================================
# WebSocket Endpoint for Real-time Collaboration
# =============================================================================


@router.websocket("/ws/documents/{document_id}")
async def websocket_document(
    websocket: WebSocket,
    document_id: UUID,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time document collaboration.

    Message Types (client -> server):
    - content_update: Update document content
    - cursor_update: Update cursor position
    - selection_update: Update text selection

    Message Types (server -> client):
    - content_update: Broadcast content changes
    - cursor_update: Broadcast cursor positions
    - selection_update: Broadcast selections
    - presence: User joined/left notifications
    - sync: Initial document sync
    """
    from app.core.security import verify_access_token
    from app.core.database import get_session_factory

    # Authenticate user from token
    try:
        payload = verify_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Get user info and document from database
    async with get_session_factory()() as db:
        user = await db.get(User, UUID(user_id))
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return

        document = await db.get(Document, document_id)
        if not document:
            await websocket.close(code=4004, reason="Document not found")
            return

        user_name = user.full_name or user.email
        doc_id_str = str(document_id)

    # Connect to the document session
    await manager.connect(websocket, doc_id_str, user_id, user_name)

    try:
        # Send initial document state
        async with get_session_factory()() as db:
            document = await db.get(Document, document_id)
            if document:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "sync",
                            "content": document.content,
                            "version": document.version,
                            "active_users": manager.get_active_users(doc_id_str),
                        }
                    )
                )

        # Handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")

            if message_type == "content_update":
                # Update document in database
                async with get_session_factory()() as db:
                    document = await db.get(Document, document_id)
                    if document:
                        document.content = message.get("content")
                        document.plain_text = message.get("plain_text")
                        document.last_edited_by = UUID(user_id)
                        document.version += 1
                        await db.commit()

                        # Broadcast to other users
                        broadcast_msg = {
                            "type": "content_update",
                            "content": message.get("content"),
                            "version": document.version,
                            "user_id": user_id,
                            "user_name": user_name,
                        }
                        await manager.broadcast(
                            doc_id_str, json.dumps(broadcast_msg), exclude_user=user_id
                        )

            elif message_type == "cursor_update":
                # Broadcast cursor position to others
                broadcast_msg = {
                    "type": "cursor_update",
                    "user_id": user_id,
                    "user_name": user_name,
                    "position": message.get("position"),
                }
                await manager.broadcast(
                    doc_id_str, json.dumps(broadcast_msg), exclude_user=user_id
                )

            elif message_type == "selection_update":
                # Broadcast selection to others
                broadcast_msg = {
                    "type": "selection_update",
                    "user_id": user_id,
                    "user_name": user_name,
                    "selection": message.get("selection"),
                }
                await manager.broadcast(
                    doc_id_str, json.dumps(broadcast_msg), exclude_user=user_id
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket, doc_id_str, user_id)
        await manager.broadcast_user_presence(doc_id_str, user_id, user_name, "left")
        logger.info(f"User {user_name} disconnected from document {document_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, doc_id_str, user_id)
        await manager.broadcast_user_presence(doc_id_str, user_id, user_name, "left")
