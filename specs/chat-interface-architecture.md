# Chat Interface Architecture

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Status**: Specification
**Classification**: Internal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Chat Interface Overview](#2-chat-interface-overview)
3. [Document Editor Integration](#3-document-editor-integration)
4. [Export Functionality](#4-export-functionality)
5. [Data Retention Policy](#5-data-retention-policy)
6. [Implementation Specifications](#6-implementation-specifications)

---

## 1. Executive Summary

### 1.1 Requirements Recap

From user requirements:

1. **Projects section** should have quotes with chat interface
2. **Document editor** similar to Google Docs for quote editing
3. **Multiple users** can edit the document simultaneously
4. **Export buttons**: Save as PDF or DOCX
5. **"Back to chat" button** to return from editor to chat
6. **Chat history** stored per project, deleted after 90 days

### 1.2 Architectural Approach

```
┌──────────────────────────────────────────────────────────┐
│                    PROJECT VIEW                           │
│  ┌────────────────────┐  ┌─────────────────────────────┐ │
│  │                    │  │                             │ │
│  │   CHAT INTERFACE   │  │   EDITOR INTERFACE          │ │
│  │                    │  │                             │ │
│  │  - Requirements    │  │  - Real-time collaboration  │ │
│  │  - AI responses    │  │  - Multiple editors         │ │
│  │  - File uploads    │  │  - Version history          │ │
│  │  - Quote preview   │  │  - Export PDF/DOCX          │ │
│  │                    │  │  - Back to chat button      │ │
│  │  [Generate Quote]  │  │                             │ │
│  │                    │  │                             │ │
│  └────────────────────┘  └─────────────────────────────┘ │
│           │                         │                     │
│           └─────────┬───────────────┘                     │
│                     │                                     │
│         Shared Project Context                            │
│         - Chat history (90-day retention)                 │
│         - Quote versions                                  │
│         - Collaborators                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Chat Interface Overview

### 2.1 Chat UI Components

```typescript
// frontend/src/components/chat/ChatInterface.tsx

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  timestamp: Date
  metadata?: {
    modelUsed?: string
    tokensUsed?: number
    ragSources?: string[]
  }
}

interface Attachment {
  id: string
  filename: string
  contentType: string
  size: number
  url: string
}

const ChatInterface: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  // Load chat history for project
  useEffect(() => {
    loadChatHistory(projectId)
  }, [projectId])

  const sendMessage = async () => {
    // Upload attachments
    const uploadedFiles = await uploadAttachments(attachments)

    // Send message to backend
    const response = await api.post('/api/v1/chat/message', {
      project_id: projectId,
      content: input,
      attachments: uploadedFiles.map(f => f.id)
    })

    // Add messages to UI
    setMessages(prev => [...prev, userMessage, assistantMessage])
  }

  return (
    <div className="chat-interface">
      <ChatHeader projectId={projectId} />

      <ChatMessages messages={messages} />

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        onAttach={handleAttach}
        attachments={attachments}
        loading={loading}
      />

      {/* Quick action buttons */}
      <QuickActions>
        <Button onClick={generateQuote}>Generate Quote</Button>
        <Button onClick={addRequirement}>Add Requirements</Button>
      </QuickActions>
    </div>
  )
}
```

### 2.2 Chat Backend Endpoints

```python
# /backend/app/api/v1/chat.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.services.ai.llm_service import LLMService
from app.services.ai.rag_service import RAGService
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.models.chat_history import ChatMessage

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Send a chat message and get AI response.

    This endpoint:
    1. Stores user message in chat history
    2. Retrieves similar quotes from RAG (if applicable)
    3. Calls LLM to generate response
    4. Stores AI response in chat history
    5. Returns AI response
    """

    # Store user message
    user_message = ChatMessage(
        project_id=request.project_id,
        user_id=current_user.id,
        role="user",
        content=request.content,
        attachments=request.attachments
    )
    db.add(user_message)
    await db.commit()

    # Get RAG context if generating quote
    rag_context = None
    if "quote" in request.content.lower() or "estimate" in request.content.lower():
        rag_service = RAGService(db)
        rag_context = await rag_service.build_rag_context(
            query=request.content,
            platform=request.platform
        )

    # Generate AI response
    llm_service = LLMService()
    ai_response = await llm_service.generate_quote(
        requirements=request.content,
        attachments=request.attachments,
        context={"project_id": request.project_id},
        rag_context=rag_context
    )

    # Store AI message
    assistant_message = ChatMessage(
        project_id=request.project_id,
        role="assistant",
        content=ai_response["quote"],
        metadata={
            "model_used": ai_response["model_used"],
            "usage": ai_response["usage"]
        }
    )
    db.add(assistant_message)
    await db.commit()

    return ChatMessageResponse(
        id=assistant_message.id,
        role="assistant",
        content=assistant_message.content,
        timestamp=assistant_message.created_at,
        metadata=assistant_message.metadata
    )

@router.get("/history/{project_id}")
async def get_chat_history(
    project_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get chat history for a project.

    Returns messages in reverse chronological order (newest first).
    Supports pagination via 'before' cursor.
    """

    query = select(ChatMessage).where(
        ChatMessage.project_id == project_id
    ).order_by(ChatMessage.created_at.desc()).limit(limit)

    if before:
        query = query.where(ChatMessage.created_at < before)

    result = await db.execute(query)
    messages = result.scalars().all()

    return {
        "messages": [msg.to_dict() for msg in messages],
        "has_more": len(messages) == limit
    }

@router.delete("/history/{project_id}")
async def delete_chat_history(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Delete all chat history for a project.

    This is called automatically for chats older than 90 days.
    """

    await db.execute(
        delete(ChatMessage).where(ChatMessage.project_id == project_id)
    )
    await db.commit()

    return {"success": True, "deleted_project": project_id}
```

### 2.3 Chat History Database Schema

```sql
-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),  -- NULL for assistant messages
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    attachments JSONB,  -- Array of file IDs
    metadata JSONB,     -- Model used, tokens, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP  -- Soft delete for 90-day retention
);

-- Index for efficient queries
CREATE INDEX chat_messages_project_id_idx ON chat_messages (project_id, created_at DESC);
CREATE INDEX chat_messages_deleted_at_idx ON chat_messages (deleted_at)
WHERE deleted_at IS NOT NULL;
```

---

## 3. Document Editor Integration

### 3.1 Editor Architecture

**Technology**: TipTap + Y.js (as specified in existing architecture)

```typescript
// frontend/src/components/editor/CollaborativeEditor.tsx

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

interface EditorProps {
  quoteId: string
  projectId: string
  onBack: () => void  // Navigate back to chat
}

const CollaborativeEditor: React.FC<EditorProps> = ({
  quoteId,
  projectId,
  onBack
}) => {
  // Initialize Y.js document
  const ydoc = useMemo(() => new Y.Doc(), [quoteId])

  // WebSocket provider for real-time sync
  const provider = useMemo(() => {
    return new WebsocketProvider(
      'ws://localhost:8000/ws/editor',
      `quote-${quoteId}`,
      ydoc,
      {
        connect: true,
        params: {
          token: authToken,  // JWT auth
          project_id: projectId
        }
      }
    )
  }, [quoteId, projectId, ydoc])

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydoc
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: currentUser.name,
          color: generateUserColor(currentUser.id)
        }
      })
    ],
    content: '<p>Loading...</p>'
  })

  // Export functions
  const exportAsPDF = async () => {
    const response = await api.post(`/api/v1/quotes/${quoteId}/export/pdf`)
    window.open(response.data.download_url, '_blank')
  }

  const exportAsDOCX = async () => {
    const response = await api.post(`/api/v1/quotes/${quoteId}/export/docx`)
    window.open(response.data.download_url, '_blank')
  }

  return (
    <div className="editor-container">
      {/* Toolbar */}
      <EditorToolbar>
        <Button onClick={onBack} variant="ghost">
          ← Back to Chat
        </Button>

        <div className="editor-actions">
          <Button onClick={exportAsPDF}>
            Export as PDF
          </Button>
          <Button onClick={exportAsDOCX}>
            Export as DOCX
          </Button>
        </div>
      </EditorToolbar>

      {/* Active collaborators */}
      <CollaboratorsList provider={provider} />

      {/* Editor content */}
      <EditorContent editor={editor} className="quote-editor" />

      {/* Status bar */}
      <StatusBar
        wordCount={editor?.storage.characterCount.words()}
        collaborators={provider.awareness.getStates().size}
        lastSaved={lastSavedTimestamp}
      />
    </div>
  )
}
```

### 3.2 WebSocket Server for Collaboration

```python
# /backend/app/services/websocket/editor_ws.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

class EditorConnectionManager:
    """
    Manage WebSocket connections for collaborative editing.

    Each quote document has a room identified by quote_id.
    """

    def __init__(self):
        # room_id -> set of websocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        """Add connection to room"""
        await websocket.accept()

        if room_id not in self.rooms:
            self.rooms[room_id] = set()

        self.rooms[room_id].add(websocket)

        # Broadcast user joined
        await self.broadcast(
            room_id,
            {"type": "user_joined", "room": room_id},
            exclude=websocket
        )

    def disconnect(self, websocket: WebSocket, room_id: str):
        """Remove connection from room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(websocket)

            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(
        self,
        room_id: str,
        message: dict,
        exclude: WebSocket = None
    ):
        """Broadcast message to all connections in room"""
        if room_id not in self.rooms:
            return

        for connection in self.rooms[room_id]:
            if connection != exclude:
                await connection.send_json(message)

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send message to specific connection"""
        await websocket.send_json(message)


# FastAPI WebSocket endpoint
manager = EditorConnectionManager()

@app.websocket("/ws/editor/{quote_id}")
async def editor_websocket(
    websocket: WebSocket,
    quote_id: str,
    token: str
):
    """
    WebSocket endpoint for collaborative quote editing.

    Uses Y.js protocol for CRDT synchronization.
    """

    # Authenticate user
    try:
        user = await authenticate_websocket(token)
    except Exception:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    # Connect to room
    await manager.connect(websocket, quote_id)

    try:
        while True:
            # Receive Y.js update
            data = await websocket.receive_bytes()

            # Broadcast to other clients
            await manager.broadcast(
                quote_id,
                {"type": "update", "data": data},
                exclude=websocket
            )

            # Periodically save to database
            await save_quote_snapshot(quote_id, data)

    except WebSocketDisconnect:
        manager.disconnect(websocket, quote_id)
```

### 3.3 Editor Features

**Required Features**:

1. **Real-time collaboration**
   - Multiple users edit simultaneously
   - See other users' cursors and selections
   - Automatic conflict resolution (CRDT)

2. **Rich text editing**
   - Headings, lists, bold, italic
   - Tables for quote line items
   - Inline comments

3. **Version history**
   - Periodic snapshots
   - Restore previous versions
   - Show who made changes

4. **Auto-save**
   - Save every 30 seconds
   - Save on editor blur
   - Visual indicator of save status

---

## 4. Export Functionality

### 4.1 Export Architecture

```
User clicks "Export as PDF"
          │
          v
Frontend POST /api/v1/quotes/{id}/export/pdf
          │
          v
Backend creates Celery task
          │
          v
Celery worker generates PDF (WeasyPrint)
          │
          v
Upload PDF to storage (DB or S3)
          │
          v
Return download URL to frontend
          │
          v
Frontend opens URL in new tab
```

### 4.2 Export Service Implementation

```python
# /backend/app/services/export/export_service.py

from weasyprint import HTML, CSS
from docx import Document
from docx.shared import Pt, Inches
from jinja2 import Template
from app.services.storage.factory import StorageFactory
from app.services.storage.interface import FileMetadata

class ExportService:
    """
    Export quotes to PDF and DOCX formats.
    """

    def __init__(self, db_session):
        self.db = db_session
        self.storage = StorageFactory.create(db_session)

    async def export_as_pdf(
        self,
        quote_id: str,
        template: str = "standard"
    ) -> Dict:
        """
        Export quote as PDF.

        Args:
            quote_id: UUID of quote
            template: Template name ('standard', 'detailed', 'minimal')

        Returns:
            Download URL and file metadata
        """

        # Get quote data
        quote = await self.get_quote(quote_id)

        # Render HTML from template
        html_content = await self.render_quote_html(quote, template)

        # Generate PDF
        pdf_bytes = HTML(string=html_content).write_pdf(
            stylesheets=[CSS(filename='templates/quote_styles.css')]
        )

        # Upload to storage
        from io import BytesIO
        pdf_file = BytesIO(pdf_bytes)

        metadata = FileMetadata(
            filename=f"Quote_{quote.id}_{quote.title}.pdf",
            content_type="application/pdf",
            file_size_bytes=len(pdf_bytes),
            uploaded_by=quote.created_by,
            project_id=quote.project_id,
            category="export"
        )

        file_record = await self.storage.upload(pdf_file, metadata)

        # Get download URL
        download_url = await self.storage.get_download_url(
            file_record.id,
            expires_in=3600  # 1 hour
        )

        return {
            "file_id": file_record.id,
            "filename": file_record.filename,
            "download_url": download_url,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        }

    async def export_as_docx(
        self,
        quote_id: str
    ) -> Dict:
        """
        Export quote as DOCX (Microsoft Word).

        Args:
            quote_id: UUID of quote

        Returns:
            Download URL and file metadata
        """

        # Get quote data
        quote = await self.get_quote(quote_id)

        # Create Word document
        doc = Document()

        # Add title
        title = doc.add_heading(quote.title, level=1)

        # Add metadata
        doc.add_paragraph(f"Project: {quote.project.name}")
        doc.add_paragraph(f"Date: {quote.created_at.strftime('%Y-%m-%d')}")
        doc.add_paragraph("")

        # Add requirements section
        doc.add_heading("Requirements", level=2)
        doc.add_paragraph(quote.requirements)

        # Add quote content
        doc.add_heading("Estimate Breakdown", level=2)
        # Parse and format quote content
        # Add tables for line items

        # Add totals
        doc.add_paragraph("")
        doc.add_paragraph(f"Total Hours: {quote.total_hours}")
        doc.add_paragraph(f"Total Cost: ${quote.total_cost}")

        # Save to bytes
        from io import BytesIO
        docx_buffer = BytesIO()
        doc.save(docx_buffer)
        docx_buffer.seek(0)

        # Upload to storage
        metadata = FileMetadata(
            filename=f"Quote_{quote.id}_{quote.title}.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_size_bytes=docx_buffer.getbuffer().nbytes,
            uploaded_by=quote.created_by,
            project_id=quote.project_id,
            category="export"
        )

        file_record = await self.storage.upload(docx_buffer, metadata)

        # Get download URL
        download_url = await self.storage.get_download_url(
            file_record.id,
            expires_in=3600
        )

        return {
            "file_id": file_record.id,
            "filename": file_record.filename,
            "download_url": download_url,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        }
```

### 4.3 Export Endpoints

```python
# /backend/app/api/v1/export.py

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.services.export.export_service import ExportService

router = APIRouter(prefix="/quotes", tags=["export"])

@router.post("/{quote_id}/export/pdf")
async def export_quote_as_pdf(
    quote_id: str,
    template: str = "standard",
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export quote as PDF.

    Returns download URL immediately (synchronous export).
    For very large quotes, use background task.
    """

    export_service = ExportService(db)

    result = await export_service.export_as_pdf(
        quote_id=quote_id,
        template=template
    )

    return {
        "success": True,
        "data": result
    }

@router.post("/{quote_id}/export/docx")
async def export_quote_as_docx(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export quote as DOCX (Microsoft Word).
    """

    export_service = ExportService(db)

    result = await export_service.export_as_docx(quote_id=quote_id)

    return {
        "success": True,
        "data": result
    }
```

---

## 5. Data Retention Policy

### 5.1 90-Day Chat History Retention

**Requirement**: Chat history for each project is deleted after 90 days.

**Implementation**:

```python
# /backend/app/services/maintenance/retention_service.py

from datetime import datetime, timedelta
from sqlalchemy import delete
from app.models.chat_history import ChatMessage

class RetentionService:
    """
    Manage data retention policies.
    """

    CHAT_RETENTION_DAYS = 90

    def __init__(self, db_session):
        self.db = db_session

    async def cleanup_old_chat_history(self) -> int:
        """
        Delete chat messages older than 90 days.

        Returns:
            Number of messages deleted
        """

        cutoff_date = datetime.utcnow() - timedelta(days=self.CHAT_RETENTION_DAYS)

        result = await self.db.execute(
            delete(ChatMessage).where(
                ChatMessage.created_at < cutoff_date
            )
        )

        await self.db.commit()

        return result.rowcount

    async def soft_delete_old_chats(self) -> int:
        """
        Soft delete chat messages (mark as deleted, actual deletion later).

        This allows for grace period before permanent deletion.
        """

        cutoff_date = datetime.utcnow() - timedelta(days=self.CHAT_RETENTION_DAYS)

        result = await self.db.execute(
            update(ChatMessage)
            .where(
                ChatMessage.created_at < cutoff_date,
                ChatMessage.deleted_at.is_(None)
            )
            .values(deleted_at=datetime.utcnow())
        )

        await self.db.commit()

        return result.rowcount
```

### 5.2 Scheduled Cleanup Job

```python
# /backend/app/tasks/maintenance.py

from celery import Celery
from app.services.maintenance.retention_service import RetentionService
from app.core.database import AsyncSession

celery = Celery('tasks')

@celery.task
def cleanup_old_data():
    """
    Scheduled task to cleanup old data.

    Run daily at 2 AM UTC.
    """

    async def _cleanup():
        async with AsyncSession() as db:
            retention_service = RetentionService(db)

            # Delete old chat messages
            deleted_count = await retention_service.cleanup_old_chat_history()

            print(f"Deleted {deleted_count} old chat messages")

    import asyncio
    asyncio.run(_cleanup())

# Schedule in Celery beat
celery.conf.beat_schedule = {
    'cleanup-old-data': {
        'task': 'app.tasks.maintenance.cleanup_old_data',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    }
}
```

### 5.3 User Notification

```python
# Warn users before deletion
@router.get("/projects/{project_id}/chat/retention-status")
async def get_chat_retention_status(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get chat history retention status for a project.

    Returns:
        - oldest_message_date
        - days_until_deletion
        - warning (if < 7 days remaining)
    """

    result = await db.execute(
        select(func.min(ChatMessage.created_at))
        .where(ChatMessage.project_id == project_id)
    )
    oldest_date = result.scalar()

    if not oldest_date:
        return {"has_history": False}

    age_days = (datetime.utcnow() - oldest_date).days
    days_until_deletion = max(0, 90 - age_days)

    return {
        "has_history": True,
        "oldest_message_date": oldest_date,
        "age_days": age_days,
        "days_until_deletion": days_until_deletion,
        "warning": days_until_deletion < 7
    }
```

---

## 6. Implementation Specifications

### 6.1 Database Schema Additions

```sql
-- Projects table (if not exists)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    platform VARCHAR(50),  -- 'wordpress', 'shopify', 'woocommerce'
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'archived', 'completed'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Quotes table
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT,  -- Y.js document content (JSON)
    requirements TEXT,
    total_hours NUMERIC(10, 2),
    total_cost NUMERIC(12, 2),
    platform VARCHAR(50),
    complexity VARCHAR(20),
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'published', 'approved'
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Chat messages (from earlier)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Quote versions (for history)
CREATE TABLE quote_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 6.2 Frontend Route Structure

```typescript
// React Router configuration

<Routes>
  <Route path="/projects" element={<ProjectsList />} />

  <Route path="/projects/:projectId" element={<ProjectLayout />}>
    {/* Default view: Chat interface */}
    <Route index element={<ChatInterface />} />

    {/* Editor view */}
    <Route path="editor/:quoteId" element={<CollaborativeEditor />} />

    {/* Project settings */}
    <Route path="settings" element={<ProjectSettings />} />
  </Route>
</Routes>
```

### 6.3 Navigation Flow

```typescript
// Navigate from Chat to Editor
const openEditor = (quoteId: string) => {
  navigate(`/projects/${projectId}/editor/${quoteId}`)
}

// Navigate from Editor back to Chat
const backToChat = () => {
  navigate(`/projects/${projectId}`)
}
```

---

## 7. UI/UX Specifications

### 7.1 Chat Interface Layout

```
┌─────────────────────────────────────────────────────┐
│ Project Name                          [⚙ Settings]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  User:  Can you estimate a WordPress site...        │
│         [screenshot.png] [requirements.docx]         │
│                                                      │
│  AI:    Based on your requirements, here's...       │
│         Total: 120 hours, $12,000                    │
│         [View Full Quote] [Regenerate]               │
│                                                      │
│  User:  Can you add WooCommerce integration?        │
│                                                      │
│  AI:    Updated estimate with WooCommerce...        │
│         Total: 160 hours, $16,000                    │
│         [Open in Editor] [Export PDF]                │
│                                                      │
├─────────────────────────────────────────────────────┤
│ [Type message...]                    [📎] [Send]    │
└─────────────────────────────────────────────────────┘
```

### 7.2 Editor Interface Layout

```
┌─────────────────────────────────────────────────────┐
│ [← Back to Chat]  Quote Title       [Export ▼]      │
│                                      • PDF           │
│  👤 John (You)  👤 Sarah  👤 Mike   • DOCX          │
├─────────────────────────────────────────────────────┤
│ [B] [I] [U] [H1] [•••]  [Table] [Comment]          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Project Requirements                                │
│  ...                                                 │
│                                                      │
│  Estimate Breakdown                                  │
│  ┌──────────────────┬───────┬────────┬─────────┐   │
│  │ Task             │ Hours │ Rate   │ Total   │   │
│  ├──────────────────┼───────┼────────┼─────────┤   │
│  │ WordPress Setup  │ 8     │ $100   │ $800    │   │
│  │ ...              │       │        │         │   │
│  └──────────────────┴───────┴────────┴─────────┘   │
│                                                      │
│  Total: $12,000                                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│ 450 words • 3 collaborators • Saved 2 min ago       │
└─────────────────────────────────────────────────────┘
```

---

## Appendix: Quick Reference

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/chat/message` | POST | Send chat message |
| `/api/v1/chat/history/{project_id}` | GET | Get chat history |
| `/api/v1/quotes/{id}/export/pdf` | POST | Export as PDF |
| `/api/v1/quotes/{id}/export/docx` | POST | Export as DOCX |
| `/ws/editor/{quote_id}` | WebSocket | Collaborative editing |

### Configuration

```bash
# .env
CHAT_RETENTION_DAYS=90
MAX_CHAT_HISTORY_LENGTH=50
EDITOR_AUTO_SAVE_INTERVAL=30  # seconds
EXPORT_TEMPLATE_PATH=templates/quotes/
```
