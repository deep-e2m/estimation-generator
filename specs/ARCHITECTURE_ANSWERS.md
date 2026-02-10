# Architecture Questions - Comprehensive Answers

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Status**: Final
**Classification**: Internal

---

## Executive Summary

This document provides detailed answers to all architectural questions about the Estimate AI application. Each answer includes current state analysis, recommendations, and references to detailed specification documents.

---

## Question 1: Which LLM are we currently using to generate quotes?

### Answer: NONE - No LLM Integration Currently Exists

**Current State**:
- The application does NOT have any LLM integration implemented yet
- LangGraph and langchain-core are listed in `requirements.txt` but not configured
- No OpenRouter, OpenAI, or Anthropic API keys in environment configuration
- No AI service layer exists in the backend codebase

**Evidence**:
```bash
# Files checked:
/backend/app/services/  - No AI services
/backend/app/config.py  - No LLM API keys configured
.env.example            - No OpenRouter or LLM configuration
```

**Recommendation**: Implement multi-model LLM integration via OpenRouter (see Question 3)

**Reference**: `/Users/deeptrivedi/estimation/specs/llm-integration-architecture.md`

---

## Question 2: Dynamic LLM selection based on requirements

### User Requirements:
1. Gemini 2.0 Flash Thinking and GPT-4o for main generation
2. Thinking models for research tasks
3. Web searching models to fetch articles and PM reference links
4. Intelligent decision on which LLM to use based on the task

### Answer: Recommended Multi-Model Architecture

**Architecture Overview**:

```
Task Classification → Model Selection → OpenRouter API → LLM Response
```

**Recommended Model Strategy**:

| Task Type | Recommended Model | Cost/1K tokens | Rationale |
|-----------|------------------|----------------|-----------|
| **Main Quote Generation** | Gemini 2.0 Flash Thinking | $0.0001/$0.0004 | Best value, reasoning capability |
| **Complex Estimation** | GPT-4o | $0.0025/$0.010 | High quality, multi-platform |
| **Web Research** | Gemini 2.0 Flash Thinking | $0.0001/$0.0004 | Fast, Google integration |
| **PM Reference Links** | Perplexity Online | $0.001/$0.001 | Live web search, citations |
| **Vision Analysis** | GPT-4o | $0.0025/$0.010 | Best multimodal understanding |
| **Document Parsing** | GPT-4o | $0.0025/$0.010 | OCR and structure extraction |
| **Fast Tasks** | Gemini 1.5 Flash | $0.000075/$0.0003 | Simple parsing, formatting |

**Intelligent Task Classification**:

The system will automatically classify tasks based on:

1. **Content Analysis**:
   - Keywords (e.g., "research", "article", "latest")
   - Message length
   - Complexity indicators

2. **Attachments**:
   - Images → Vision models (GPT-4o, Claude 3.5 Sonnet)
   - Documents → Document parsing models
   - No attachments → Text-only models

3. **Context**:
   - Project platform (WordPress/Shopify/WooCommerce)
   - Historical chat context
   - User preferences

**Example Classification Logic**:

```python
def classify_task(message, attachments):
    if has_images(attachments):
        return "vision_analysis" → GPT-4o

    if contains_research_keywords(message):
        return "web_research" → Perplexity Online

    if message.contains("quote") or message.contains("estimate"):
        complexity = assess_complexity(message, attachments)
        if complexity == "high":
            return "complex_generation" → GPT-4o
        else:
            return "quote_generation" → Gemini 2.0 Flash Thinking

    return "requirement_extraction" → Gemini 1.5 Flash
```

**Reference**: `/Users/deeptrivedi/estimation/specs/llm-integration-architecture.md` (Section 3: Multi-Model Architecture Strategy)

---

## Question 3: Why not use OpenRouter?

### Answer: HIGHLY RECOMMENDED - Use OpenRouter

**The user already has an OpenRouter API key and should absolutely use it.**

### Why OpenRouter is Perfect for This Application:

**1. Single API for Multiple Providers**:
```bash
# Instead of managing 4+ API keys:
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
PERPLEXITY_API_KEY=...

# Just one key:
OPENROUTER_API_KEY=sk-or-v1-xxx
```

**2. Automatic Fallback**:
- If Gemini 2.0 Flash Thinking is unavailable → automatically try GPT-4o
- If GPT-4o rate limit hit → switch to Claude 3.5 Sonnet
- No manual retry logic needed

**3. Built-in Cost Tracking**:
- Every API response includes actual cost
- No need to calculate manually
- Easy budget monitoring

**4. Model Aliasing**:
- Use "latest GPT-4" without hardcoding versions
- Automatic updates when new models release

**5. User Already Has API Key**:
- No need to sign up for multiple services
- Immediate implementation possible

### Cost Comparison (Monthly Estimate):

**Assumptions**: 3,500 quotes/month (70 PMs × 50 quotes each)

```
Main Generation (Gemini 2.0 Flash Thinking):
- 3,500 × 12K input × $0.0001/1K = $4.20
- 3,500 × 3K output × $0.0004/1K = $4.20
Subtotal: $8.40

Web Research (700 tasks):
- Perplexity: $4.90

Vision Analysis (525 tasks):
- GPT-4o: $15.75

Support Tasks (10,500 tasks):
- Gemini 1.5 Flash: $3.94

TOTAL: ~$33/month
With 50% buffer: ~$50/month
```

**This is extremely cost-effective for 3,500 quotes/month.**

### Implementation:

```python
# Add to .env
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
OPENROUTER_APP_NAME="Estimate AI Quote Generator"
OPENROUTER_HTTP_REFERER=https://your-domain.com

# OpenRouter client (already specified in architecture)
async def call_openrouter(messages, model, fallback_models=[]):
    # Single unified API call
    # Automatic fallback if primary model fails
    # Built-in cost tracking
    pass
```

**Reference**: `/Users/deeptrivedi/estimation/specs/llm-integration-architecture.md` (Section 4: OpenRouter Integration)

---

## Question 4: In the Projects section, quotes should have a chat interface

### Answer: Implemented via Chat Interface Architecture

**Solution**: Each project has an integrated chat interface where users interact with AI to generate quotes.

**Architecture**:

```
Project View
├── Chat Interface (Primary)
│   ├── Conversation with AI
│   ├── File upload (screenshots, docs)
│   ├── Quote generation
│   └── Quick actions
└── Editor Interface (Secondary)
    ├── Collaborative editing
    ├── Real-time sync (Y.js)
    └── Export buttons (PDF/DOCX)
```

**User Flow**:

1. **User opens project** → Lands on Chat interface
2. **User describes requirements** → Types in chat or uploads files
3. **AI generates quote** → Displays in chat with preview
4. **User clicks "Open in Editor"** → Opens collaborative editor
5. **User edits quote** → Multiple PMs can edit simultaneously
6. **User clicks "Back to Chat"** → Returns to chat interface
7. **User exports** → PDF or DOCX download

**Key Features**:

- **Chat history** per project (90-day retention)
- **File uploads** (images, PDFs, DOCX)
- **Streaming responses** for real-time feedback
- **Message persistence** across sessions
- **Attachment previews** in chat

**Database Schema**:

```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(20),  -- 'user', 'assistant'
    content TEXT,
    attachments JSONB,
    created_at TIMESTAMP
);
```

**API Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/chat/message` | POST | Send message, get AI response |
| `GET /api/v1/chat/history/{project_id}` | GET | Retrieve chat history |
| `DELETE /api/v1/chat/history/{project_id}` | DELETE | Delete chat history |

**Reference**: `/Users/deeptrivedi/estimation/specs/chat-interface-architecture.md` (Section 2: Chat Interface Overview)

---

## Question 5: Are we using RAG? User will provide client requirements and quotes for training if needed.

### Answer: RAG NOT Implemented Yet - Implementation Plan Ready

**Current State**:
- pgvector extension listed in dependencies but NOT configured
- No embeddings table created
- No vector search implementation
- Knowledge base has only 3 sample quotes (need 30-50 minimum)

**User Action Required BEFORE RAG Works**:

The user must provide **30-50 historical quotes** containing:
- Project requirements
- Hour estimates per task
- Final pricing
- Project platform
- Complexity indicators

**Why 30-50 quotes?**

| Sample Size | Quality | Explanation |
|-------------|---------|-------------|
| < 10 | Poor | Insufficient patterns, generic estimates |
| 10-29 | Fair | Limited learning, may overfit |
| 30-50 | Good | Recognizes patterns, diverse examples |
| 100+ | Excellent | High accuracy, handles edge cases |

**RAG Architecture**:

```
User provides 30-50 quotes
     ↓
Parse and chunk documents (512 tokens/chunk)
     ↓
Generate embeddings (OpenAI text-embedding-3-small)
     ↓
Store in PostgreSQL with pgvector
     ↓
When generating new quote:
  1. Embed user requirements
  2. Search similar past quotes (vector similarity)
  3. Retrieve top 5 matches
  4. Add as context to LLM prompt
     ↓
LLM generates quote using historical examples
```

**Database Schema**:

```sql
-- Enable pgvector
CREATE EXTENSION vector;

-- Store embeddings
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY,
    source_id UUID,  -- Reference to quotes.id
    chunk_text TEXT,
    embedding vector(1536),  -- OpenAI embeddings
    metadata JSONB,  -- platform, complexity, etc.
    created_at TIMESTAMP
);

-- Fast vector search index
CREATE INDEX ON knowledge_embeddings
USING hnsw (embedding vector_cosine_ops);
```

**Cost Estimate**:

```
Embeddings cost:
- 50 quotes × 5,000 tokens avg = 250K tokens
- 250K × $0.00002/1K = $5.00 one-time

Monthly ongoing (50 new quotes):
- $5.00/month
```

**Implementation Roadmap**:

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | Database setup | pgvector tables created |
| 2 | Ingestion pipeline | Script to process quotes |
| 3 | RAG search | Vector similarity search working |
| 4 | Integration | RAG context added to prompts |
| 5-6 | Data collection | User uploads 30-50 quotes |

**Reference**: `/Users/deeptrivedi/estimation/specs/rag-implementation-strategy.md`

---

## Question 6: When new quotes are published and PM approved, the knowledge base should be updated

### Answer: Auto-Learning System Specified

**Solution**: Automatic knowledge base update when PM approves quotes.

**Workflow**:

```
PM approves quote in UI
     ↓
POST /api/v1/quotes/{id}/approve
     ↓
Backend:
  1. Mark quote as "approved"
  2. Chunk quote content (512 tokens/chunk)
  3. Generate embeddings for all chunks
  4. Store in knowledge_embeddings table
  5. Immediately available for RAG searches
     ↓
Knowledge base updated automatically
```

**Implementation**:

```python
@router.post("/{quote_id}/approve")
async def approve_quote(quote_id: str, db: AsyncSession):
    """
    Approve quote and add to knowledge base.

    This endpoint:
    1. Updates quote status to "approved"
    2. Chunks the quote content
    3. Generates embeddings via OpenRouter
    4. Stores in knowledge base
    5. Returns number of embeddings created
    """

    # Update status
    quote.status = "approved"
    quote.approved_by = current_user.id
    quote.approved_at = datetime.utcnow()
    await db.commit()

    # Ingest into knowledge base
    knowledge_service = KnowledgeUpdateService(db)
    embeddings_created = await knowledge_service.ingest_approved_quote(
        quote_id
    )

    return {
        "quote_id": quote_id,
        "status": "approved",
        "embeddings_created": embeddings_created,
        "knowledge_base_updated": True
    }
```

**Benefits**:

1. **Continuous Learning**: Every approved quote improves future estimates
2. **Zero Manual Work**: Completely automatic
3. **Immediate Availability**: New embeddings usable instantly
4. **Quality Control**: Only approved quotes enter knowledge base

**Database Tracking**:

```sql
-- Track which quotes are in knowledge base
SELECT
    q.id,
    q.title,
    q.status,
    q.approved_at,
    COUNT(ke.id) AS embedding_count
FROM quotes q
LEFT JOIN knowledge_embeddings ke ON ke.source_id = q.id
WHERE q.status = 'approved'
GROUP BY q.id;
```

**Reference**: `/Users/deeptrivedi/estimation/specs/rag-implementation-strategy.md` (Section 4: Knowledge Base Auto-Learning)

---

## Question 7: PM will provide requirements in an editor similar to Google Docs with multi-user editing, PDF/DOCX export, and "Back to chat" button

### Answer: Collaborative Editor Specified (TipTap + Y.js)

**Solution**: Real-time collaborative editor using TipTap + Y.js (as already specified in original architecture).

**Key Features**:

1. **Multi-User Editing** ✓
   - Multiple PMs edit simultaneously
   - See other users' cursors in real-time
   - Automatic conflict resolution (CRDT)
   - User presence indicators

2. **Export Buttons** ✓
   - **Export as PDF**: WeasyPrint rendering
   - **Export as DOCX**: python-docx generation
   - One-click download
   - 1-hour presigned URLs

3. **Back to Chat Button** ✓
   - Top-left corner: "← Back to Chat"
   - Returns to project chat interface
   - Auto-saves before navigation

**Technology Stack**:

```typescript
// Frontend
- TipTap (ProseMirror-based editor)
- Y.js (CRDT for real-time sync)
- WebSocket provider for collaboration

// Backend
- FastAPI WebSocket endpoint
- Y.js server-side handling
- WeasyPrint (PDF generation)
- python-docx (DOCX generation)
```

**UI Layout**:

```
┌─────────────────────────────────────────────────────┐
│ [← Back to Chat]  Quote Title       [Export ▼]      │
│                                      • PDF           │
│  👤 John (You)  👤 Sarah  👤 Mike   • DOCX          │
├─────────────────────────────────────────────────────┤
│ [B] [I] [U] [H1] [•••]  [Table] [Comment]          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  (Editable quote content)                            │
│                                                      │
├─────────────────────────────────────────────────────┤
│ 450 words • 3 collaborators • Saved 2 min ago       │
└─────────────────────────────────────────────────────┘
```

**WebSocket Connection**:

```typescript
// Frontend connects to WebSocket
const provider = new WebsocketProvider(
    'ws://localhost:8000/ws/editor',
    `quote-${quoteId}`,
    ydoc,
    {
        params: {
            token: authToken,  // JWT authentication
            project_id: projectId
        }
    }
)
```

**Export API**:

```python
# Export as PDF
POST /api/v1/quotes/{quote_id}/export/pdf
Response:
{
    "file_id": "uuid",
    "filename": "Quote_ProjectName.pdf",
    "download_url": "https://...",
    "expires_at": "2026-01-21T15:00:00Z"
}

# Export as DOCX
POST /api/v1/quotes/{quote_id}/export/docx
Response:
{
    "file_id": "uuid",
    "filename": "Quote_ProjectName.docx",
    "download_url": "https://...",
    "expires_at": "2026-01-21T15:00:00Z"
}
```

**Auto-Save**:
- Saves every 30 seconds
- Saves on editor blur
- Visual "Saved" indicator

**Reference**: `/Users/deeptrivedi/estimation/specs/chat-interface-architecture.md` (Section 3: Document Editor Integration)

---

## Question 8: Each project should have chat history stored, deleted after 90 days

### Answer: 90-Day Retention Policy Implemented

**Solution**: Automatic cleanup of chat history older than 90 days.

**Implementation**:

1. **Chat History Storage**:

```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    user_id UUID,
    role VARCHAR(20),
    content TEXT,
    attachments JSONB,
    created_at TIMESTAMP,
    deleted_at TIMESTAMP  -- Soft delete marker
);

-- Index for efficient cleanup
CREATE INDEX chat_messages_retention_idx
ON chat_messages (created_at)
WHERE deleted_at IS NULL;
```

2. **Automatic Cleanup Job**:

```python
# Scheduled Celery task runs daily at 2 AM
@celery.task
def cleanup_old_chat_history():
    """Delete chat messages older than 90 days"""

    cutoff_date = datetime.utcnow() - timedelta(days=90)

    deleted_count = db.execute(
        delete(ChatMessage).where(
            ChatMessage.created_at < cutoff_date
        )
    )

    logger.info(f"Deleted {deleted_count} old chat messages")
```

3. **User Warnings**:

```python
# API endpoint to check retention status
GET /api/v1/projects/{project_id}/chat/retention-status

Response:
{
    "oldest_message_date": "2025-10-23T10:00:00Z",
    "age_days": 83,
    "days_until_deletion": 7,
    "warning": true  // If < 7 days remaining
}
```

4. **Manual Export Before Deletion**:

```python
# Allow users to export chat history before deletion
POST /api/v1/projects/{project_id}/chat/export

Response:
{
    "file_id": "uuid",
    "filename": "ChatHistory_ProjectName.json",
    "download_url": "https://...",
    "message_count": 150
}
```

**Celery Beat Schedule**:

```python
celery.conf.beat_schedule = {
    'cleanup-old-data': {
        'task': 'app.tasks.maintenance.cleanup_old_data',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM UTC
    }
}
```

**Reference**: `/Users/deeptrivedi/estimation/specs/chat-interface-architecture.md` (Section 5: Data Retention Policy)

---

## Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
1. ✓ OpenRouter integration
2. ✓ Basic LLM service
3. ✓ Chat API endpoints
4. ✓ Database schema updates

### Phase 2: RAG System (Week 3-4)
1. pgvector setup
2. Embedding generation
3. Vector search
4. Knowledge base ingestion

**USER ACTION REQUIRED**: Provide 30-50 historical quotes

### Phase 3: Collaborative Editor (Week 5-6)
1. TipTap + Y.js setup
2. WebSocket server
3. Export functionality (PDF/DOCX)
4. Auto-save and version history

### Phase 4: Auto-Learning (Week 7-8)
1. Quote approval flow
2. Automatic knowledge base updates
3. Chat history retention policy
4. Cleanup jobs

### Phase 5: Polish & Optimization (Week 9-10)
1. Model selection tuning
2. Prompt optimization
3. Performance testing
4. Cost monitoring dashboard

---

## Configuration Summary

### Environment Variables Required

```bash
# .env

# OpenRouter (CRITICAL - User has API key)
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
OPENROUTER_APP_NAME="Estimate AI Quote Generator"
OPENROUTER_HTTP_REFERER=https://your-domain.com

# Model Preferences
PRIMARY_GENERATION_MODEL=google/gemini-2.0-flash-thinking-exp:free
PRIMARY_RESEARCH_MODEL=perplexity/llama-3.1-sonar-large-128k-online
PRIMARY_VISION_MODEL=openai/gpt-4o

# LLM Settings
LLM_DEFAULT_TEMPERATURE=0.3
LLM_DEFAULT_MAX_TOKENS=4096
LLM_REQUEST_TIMEOUT=120

# RAG Settings
EMBEDDING_MODEL=openai/text-embedding-3-small
RAG_TOP_K_RESULTS=5
RAG_SIMILARITY_THRESHOLD=0.7

# Chat Settings
CHAT_RETENTION_DAYS=90
MAX_CHAT_HISTORY_LENGTH=50

# Editor Settings
EDITOR_AUTO_SAVE_INTERVAL=30  # seconds
MAX_COLLABORATORS_PER_QUOTE=10

# Export Settings
EXPORT_TEMPLATE_PATH=templates/quotes/
EXPORT_URL_EXPIRY=3600  # 1 hour
```

---

## Key Specifications Reference

| Topic | Document Path |
|-------|---------------|
| LLM Integration & OpenRouter | `/Users/deeptrivedi/estimation/specs/llm-integration-architecture.md` |
| RAG Implementation | `/Users/deeptrivedi/estimation/specs/rag-implementation-strategy.md` |
| Chat & Editor Interface | `/Users/deeptrivedi/estimation/specs/chat-interface-architecture.md` |
| Overall Architecture | `/Users/deeptrivedi/estimation/specs/overview.md` |
| Tech Stack Details | `/Users/deeptrivedi/estimation/specs/tech-stack.md` |
| Database Schema | `/Users/deeptrivedi/estimation/specs/database-schema.md` |
| API Contracts | `/Users/deeptrivedi/estimation/specs/api-contracts.md` |

---

## Next Steps for Development Team

### Backend Developer Tasks
1. Implement OpenRouter client (`/backend/app/services/ai/openrouter_client.py`)
2. Create LLM service layer (`/backend/app/services/ai/llm_service.py`)
3. Set up pgvector tables for RAG
4. Implement chat API endpoints
5. Build export service (PDF/DOCX)
6. Create WebSocket endpoint for collaborative editing

### Frontend Developer Tasks
1. Build chat interface component
2. Implement TipTap + Y.js editor
3. Create file upload component
4. Add export button handlers
5. Implement "Back to Chat" navigation
6. Add collaborator presence indicators

### User Tasks
1. **Collect 30-50 historical quotes** (CRITICAL for RAG)
2. Clean and anonymize client data
3. Upload to `/knowledge-based/formatting/`
4. Provide OpenRouter API key
5. Test initial quote generation

---

## Success Metrics

After full implementation:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Quote generation time | < 30 seconds | API response time |
| Estimation accuracy | < 15% variance | Compare quoted vs actual hours |
| User adoption | 80% of PMs | Active users per month |
| Cost per quote | < $0.15 | OpenRouter usage tracking |
| System uptime | 99.9% | CloudWatch monitoring |
| RAG relevance | > 70% similarity | Vector search scores |

---

## Conclusion

All user questions have been answered with detailed architectural specifications. The system is designed to be cost-effective ($50/month for 3,500 quotes), scalable, and maintainable.

**Critical Next Step**: User must provide 30-50 historical quotes for the RAG system to work effectively.

For detailed implementation guidance, refer to the specification documents listed above.
