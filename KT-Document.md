# Quote Generation Assistant - Knowledge Transfer Document

**Project Name:** AI-Based Quote Generation Assistant
**Document Type:** Knowledge Transfer / Requirements
**Date:** February 2026
**Version:** 1.0

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Business Objectives & Success Metrics](#3-business-objectives--success-metrics)
4. [Target Users](#4-target-users)
5. [Core Features & Requirements](#5-core-features--requirements)
6. [Tech Stack](#6-tech-stack)
7. [System Architecture](#7-system-architecture)
8. [Database Schema](#8-database-schema)
9. [API Endpoints](#9-api-endpoints)
10. [AI/LLM Integration (Planned)](#10-aillm-integration-planned)
11. [File Storage Architecture](#11-file-storage-architecture)
12. [Real-Time Collaboration](#12-real-time-collaboration)
13. [Security Architecture](#13-security-architecture)
14. [Docker & Deployment](#14-docker--deployment)
15. [Project Structure](#15-project-structure)
16. [Current Implementation Status](#16-current-implementation-status)
17. [Environment Setup](#17-environment-setup)
18. [Non-Functional Requirements](#18-non-functional-requirements)

---

## 1. Project Overview

The Quote Generation Assistant is an internal tool designed to help **Project Managers (PMs)** estimate effort hours for **WordPress, Shopify, and WooCommerce** development projects. It leverages AI-powered research, a continuously learning knowledge base (RAG), and real-time collaborative editing to streamline quote generation.

**In simple terms:** A PM uploads project requirements (text, images, documents), the AI analyzes them, searches the knowledge base for similar past projects, and generates a detailed effort estimate (quote) that PMs can collaboratively edit and export.

---

## 2. Problem Statement

### Current Challenges

| Problem | Impact |
|---------|--------|
| Quote generation is manual and time-consuming | PMs spend 2-4 hours per quote |
| Inconsistent estimation across PMs | Variance of 30-50% between estimators |
| No centralized knowledge base | Past project learnings are lost |
| No collaboration on quotes | PMs work in isolation, no peer review |
| No standardized format | Each PM uses their own template |
| Plugin/theme research is repetitive | Same research done multiple times |

### What This Project Solves

- **Automates research** - AI researches plugins, themes, and complexity factors
- **Learns from history** - RAG system uses past approved quotes to improve accuracy
- **Standardizes output** - Consistent quote format across all PMs
- **Enables collaboration** - Real-time multi-user editing on quotes
- **Reduces time** - Target: 60% reduction in quote generation time
- **Improves accuracy** - Target: less than 15% variance from actual effort

---

## 3. Business Objectives & Success Metrics

| Objective | Metric | Target |
|-----------|--------|--------|
| Reduce quote generation time | Average time per quote | 60% reduction |
| Improve estimation accuracy | Variance from actual hours | < 15% |
| Enable knowledge sharing | Knowledge base entries | Growing monthly |
| Support collaboration | Multi-user editing sessions | Real-time, < 100ms sync |
| System reliability | Uptime SLA | 99.9% |

### Budget

| Category | Monthly Cost |
|----------|-------------|
| AWS Infrastructure | $500 - $800 |
| AI/LLM APIs (OpenRouter) | $250 - $350 |
| Third-party services | $50 - $100 |
| **Total** | **$800 - $1,250** |

---

## 4. Target Users

| Role | Count | Permissions |
|------|-------|-------------|
| Project Managers (PM) | 65-70 | Create/edit quotes, upload requirements, use AI chat, collaborate |
| Administrators | 3-5 | All PM permissions + user management, knowledge base management, system settings |

---

## 5. Core Features & Requirements

### 5.1 Authentication & Authorization
- User registration and login (email + password)
- JWT-based authentication (access token: 30 min, refresh token: 7 days)
- Role-based access control: Admin, PM
- Project-level permissions: Owner, Editor, Viewer

### 5.2 Project Management
- Create, read, update, delete projects
- Platform selection: WordPress, Shopify, WooCommerce, Custom
- Project status tracking: Active, Archived, Completed
- Member management (invite collaborators to a project)
- Each project can have multiple quotes

### 5.3 Quote Management
- Create quotes within a project
- Quote statuses: Draft, Published, Approved, Rejected
- Complexity levels: Low, Medium, High
- Track total hours and total cost
- Quote metadata (AI model version, confidence score)
- Version history
- Export to PDF/DOCX

### 5.4 AI-Powered Chat Interface
- Chat-based requirement input per project
- File upload support (images, PDFs, DOCX) via drag-and-drop
- AI analyzes requirements and generates quotes
- AI researches plugins, themes, and similar past projects
- Clarification questions when requirements are ambiguous
- Chat history preserved per project

### 5.5 Knowledge Base & RAG
- Stores historical quotes, plugin documentation, estimation templates
- Vector embeddings (1536 dimensions) for semantic search
- Hybrid search: vector similarity + keyword (BM25)
- Auto-learning: approved quotes are automatically indexed
- Feedback loop: thumbs up/down improves retrieval relevance

### 5.6 Real-Time Collaborative Editing
- TipTap rich text editor with Y.js CRDT sync
- Multiple PMs can edit the same quote simultaneously
- Cursor presence awareness (see who's editing where)
- WebSocket-based real-time sync via Socket.io
- Max 10 collaborators per quote

### 5.7 File Upload & Storage
- Drag-and-drop file upload (react-dropzone)
- Supported formats: Images, PDF, DOCX
- Storage abstraction: Database (MVP) or AWS S3 (Production)
- File size limits: 10MB (database) / 100MB (S3)

### 5.8 Export
- Export quotes to PDF and DOCX formats
- Triggered via chat commands or export dialog
- Standardized quote template

### 5.9 Feedback System
- Thumbs up/down on generated quotes
- Comments on quote quality
- Feeds back into RAG relevance scoring

---

## 6. Tech Stack

### 6.1 Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework (SPA, not Next.js - no SEO needed, WebSocket-heavy) |
| Vite | 7 | Build tool & dev server (fast HMR) |
| TypeScript | 5.9 | Type safety |
| React Router | 7 | Client-side routing with code splitting |
| Tailwind CSS | 4 | Utility-first CSS framework |
| shadcn/ui (Radix UI) | Latest | Accessible, customizable UI components |
| Zustand | 5 | Lightweight global state management |
| React Query (TanStack) | 5 | Server state, caching, optimistic updates |
| React Hook Form | 7 | Performant form handling |
| Zod | 4 | Schema validation |
| TipTap | 2 | Rich text editor (ProseMirror-based) |
| Y.js | 13 | CRDT for real-time collaborative editing |
| Socket.io-client | 4 | WebSocket client with reconnection |
| Axios | 1 | HTTP client with interceptors |
| react-dropzone | 14 | Drag-and-drop file uploads |
| Lucide React | Latest | Icon library |
| date-fns | 4 | Date formatting |
| Sonner | 2 | Toast notifications |

### 6.2 Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Backend language |
| FastAPI | 0.109+ | Async web framework with auto OpenAPI docs |
| Uvicorn | 0.27+ | ASGI server |
| SQLAlchemy | 2.0+ | Async ORM |
| Alembic | 1.13+ | Database migrations |
| asyncpg | 0.29+ | Async PostgreSQL driver |
| Pydantic | 2 | Request/response validation |
| python-jose | Latest | JWT token handling |
| passlib + bcrypt | Latest | Password hashing (cost factor 12) |
| Redis (via redis-py) | 5 | Caching, sessions, rate limiting |
| Celery | 5.3+ | Background task queue |
| python-docx | 1.1+ | DOCX export generation |
| boto3 | Latest | AWS S3 client |
| LangGraph | 0.2+ | AI workflow orchestration (planned) |
| langchain-core | 0.2+ | LLM abstractions (planned) |
| httpx | 0.27+ | Async HTTP for LLM API calls |

### 6.3 Database & Infrastructure

| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Primary database |
| pgvector | Latest | Vector similarity search extension (for RAG) |
| Redis | 7 | Cache, sessions, WebSocket state, rate limiting |
| Docker & Docker Compose | Latest | Containerization |
| nginx | Alpine | Production static file serving |

### 6.4 Key Technology Decisions

**Why React + Vite instead of Next.js?**
- This is an internal SPA with zero SEO requirements
- Heavy WebSocket/real-time functionality doesn't benefit from SSR
- Vite's HMR is significantly faster
- Simpler deployment (static files only)

**Why PostgreSQL + pgvector instead of a separate vector DB (Pinecone, Weaviate)?**
- Cost-effective (no additional infrastructure)
- Vector operations in same transaction as metadata
- ACID guarantees for embeddings + references
- One fewer service to maintain

**Why LangGraph instead of LangChain?**
- Complex workflows require conditional routing (e.g., if requirements are unclear, ask clarification)
- Human-in-the-loop interrupts
- Built-in state persistence
- Better debugging with graph visualization

**Why OpenRouter instead of direct LLM APIs?**
- Single API key for multiple LLM providers (Claude, GPT, Mistral)
- Automatic fallback on rate limits
- Usage tracking and cost monitoring
- No vendor lock-in, easy model switching per task

---

## 7. System Architecture

### 7.1 High-Level Architecture

```
+------------------------------------------------------------------+
|                        CLIENT LAYER                               |
|  +------------------------------------------------------------+  |
|  |  React SPA (Vite) - Served as Static Files                 |  |
|  |  - Authentication Module (Login/Register)                   |  |
|  |  - Chat Interface (file upload, requirement input)          |  |
|  |  - Collaborative Quote Editor (TipTap + Y.js)              |  |
|  |  - Project & Quote Management (CRUD)                       |  |
|  |  - Dashboard & Analytics                                    |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                          |
                    HTTPS / WSS
                          |
+------------------------------------------------------------------+
|                   APPLICATION LAYER                                |
|  +------------------------------------------------------------+  |
|  |  FastAPI (Uvicorn ASGI Server)                              |  |
|  |  - REST API Endpoints                                       |  |
|  |  - WebSocket Server (collaborative editing + chat)          |  |
|  |  - JWT Authentication Middleware                             |  |
|  |  - File Upload/Download (storage abstracted)                |  |
|  |  - LangGraph AI Workflow (planned)                          |  |
|  |  - Background Tasks (Celery workers)                        |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
+----------------+ +-------------+ +-----------------+
|  PostgreSQL    | |    Redis    | |  File Storage   |
|  + pgvector    | | (Cache/Pub) | |  (Abstracted)   |
|                | |             | |                 |
| - Users        | | - Sessions  | | MVP: DB bytea   |
| - Projects     | | - Cache     | | Prod: AWS S3    |
| - Quotes       | | - Rate      | |                 |
| - Chat msgs    | |   limits    | | - Uploads       |
| - Documents    | | - WebSocket | | - Exports       |
| - Knowledge    | |   state     | |                 |
|   base         | |             | |                 |
| - Embeddings   | +-------------+ +-----------------+
| - Audit logs   |
+----------------+
```

### 7.2 Data Flow: Quote Generation

```
Step 1: PM submits requirements (text, images, documents)
            |
Step 2: File upload processing (stored in DB or S3)
            |
Step 3: Requirement extraction (Vision LLM for images, parser for docs)
            |
Step 4: Knowledge Base RAG search (pgvector cosine similarity)
            |
Step 5: Plugin/theme research (AI web research)
            |
Step 6: Complexity assessment
            |
Step 7: Quote generation (LangGraph multi-model workflow)
            |
Step 8: Quote ready for collaborative editing (TipTap editor)
            |
Step 9: PM reviews, edits, collaborates with team
            |
Step 10: Approval -> auto-learn (index into knowledge base)
            |
Step 11: Export (PDF/DOCX)
```

### 7.3 Frontend Architecture

```
React App
  |
  +-- React Router (Protected Routes)
  |     +-- /login, /register (Public)
  |     +-- /dashboard (Protected)
  |     +-- /projects (Protected)
  |     +-- /projects/:id (Protected)
  |     +-- /quotes/:id (Protected)
  |     +-- /quotes/:id/edit (Protected)
  |     +-- /quotes/new (Protected)
  |     +-- /projects/new (Protected)
  |
  +-- State Management
  |     +-- Zustand: authStore (user session, tokens)
  |     +-- Zustand: editorStore (editor state, collaborators)
  |     +-- React Query: server state (projects, quotes, chat)
  |
  +-- Service Layer (Axios)
  |     +-- api.ts (base config, interceptors, token refresh)
  |     +-- authService.ts
  |     +-- projectService.ts
  |     +-- quoteService.ts
  |     +-- chatService.ts
  |     +-- uploadService.ts
  |     +-- documentService.ts
  |
  +-- Components
        +-- UI (Button, Card, Input, Dialog, Badge, etc. - shadcn/ui)
        +-- Chat (ChatInterface, ChatMessage, ChatInput)
        +-- Editor (QuoteEditor, ExportDialog)
        +-- Auth (LoginForm, RegisterForm)
        +-- Layout (Sidebar, Header, ProtectedRoute)
```

---

## 8. Database Schema

### 8.1 Entity Relationship Overview

```
Users (1) ----< (many) Projects
Users (1) ----< (many) Quotes
Projects (1) ----< (many) Quotes
Projects (1) ----< (many) ChatMessages
Projects (1) ----< (many) Documents
Quotes (1) ----< (many) Feedback
KnowledgeBase (1) ----< (many) KBEmbeddings
```

### 8.2 Core Tables

**Users**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique, not null |
| username | VARCHAR(100) | Unique, not null |
| hashed_password | VARCHAR(255) | bcrypt hashed |
| full_name | VARCHAR(255) | Display name |
| role | ENUM | admin, pm |
| is_active | BOOLEAN | Account active flag |
| last_login_at | TIMESTAMP | Last login tracking |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

**Projects**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Project name |
| description | TEXT | Project description |
| platform | ENUM | wordpress, shopify, woocommerce, custom |
| status | ENUM | active, archived, completed |
| owner_id | UUID (FK) | References users.id |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

**Quotes**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(500) | Quote title |
| content | JSONB | Flexible quote content structure |
| status | ENUM | draft, published, approved, rejected |
| complexity | ENUM | low, medium, high |
| total_hours | DECIMAL(10,2) | Estimated total hours |
| total_cost | DECIMAL(12,2) | Estimated total cost |
| project_id | UUID (FK) | References projects.id |
| created_by | UUID (FK) | References users.id |
| approved_by | UUID (FK) | References users.id (nullable) |
| approved_at | TIMESTAMP | Approval timestamp |
| metadata | JSONB | AI model version, confidence score, etc. |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

**ChatMessages**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID (FK) | References projects.id |
| user_id | UUID (FK) | References users.id |
| content | TEXT | Message content |
| message_type | VARCHAR | user, ai, system |
| created_at | TIMESTAMP | Auto-set |

**Documents (File Uploads)**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| filename | VARCHAR | Original filename |
| content_type | VARCHAR | MIME type |
| file_size_bytes | INTEGER | File size |
| storage_provider | ENUM | database, s3 |
| storage_key | VARCHAR | blob:uuid or s3://bucket/key |
| uploaded_by | UUID (FK) | References users.id |
| project_id | UUID (FK) | References projects.id |
| metadata | JSONB | Additional file metadata |
| created_at | TIMESTAMP | Auto-set |

**KnowledgeBase**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_type | ENUM | quote, requirement, template, reference |
| content | TEXT | Source content |
| file_path | VARCHAR | Original file path |
| uploaded_by | UUID (FK) | References users.id |
| source_quote_id | UUID (FK) | Auto-learned from this quote |
| is_active | BOOLEAN | Soft delete flag |
| metadata | JSONB | Tags, categories, platform, client info |
| created_at | TIMESTAMP | Auto-set |

**KBEmbeddings (Vector Store for RAG)**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| kb_id | UUID (FK) | References knowledge_base.id |
| chunk_index | INTEGER | Chunk position |
| chunk_content | TEXT | Text chunk (512 tokens) |
| embedding | VECTOR(1536) | OpenAI text-embedding-3-small |
| token_count | INTEGER | Tokens in chunk |
| created_at | TIMESTAMP | Auto-set |

**Other Tables:** Feedback, AuditLog (partitioned monthly), ResearchCache (TTL 30 days), WebSocketSessions

### 8.3 Key Indexes

- **B-tree**: quotes.status, quotes.created_at, projects.owner_id
- **GIN Trigram**: project.name, knowledge_base.content (full-text search)
- **HNSW Vector**: kb_embeddings.embedding (cosine similarity for RAG)
- **Composite**: quotes(project_id, status), chat_messages(project_id, created_at)

---

## 9. API Endpoints

### 9.1 Authentication - `/api/v1/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /register | Register a new user |
| POST | /login | Login, returns access_token + refresh_token |
| POST | /refresh | Refresh access token |
| POST | /logout | Invalidate tokens |
| POST | /password-reset | Reset password |

### 9.2 Projects - `/api/v1/projects`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | List all projects (paginated) |
| POST | / | Create a new project |
| GET | /{id} | Get project details |
| PUT | /{id} | Update project |
| DELETE | /{id} | Delete project |
| POST | /{id}/members | Add member to project |

### 9.3 Quotes - `/api/v1/quotes`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | List quotes (paginated, filterable) |
| POST | / | Create a new quote |
| GET | /{id} | Get quote details |
| PUT | /{id} | Update quote |
| DELETE | /{id} | Delete quote |
| POST | /{id}/generate | AI-generate quote (planned) |
| POST | /{id}/export | Export to PDF/DOCX |
| POST | /{id}/feedback | Submit thumbs up/down |

### 9.4 Chat - `/api/v1/chat`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /messages | Send a chat message |
| GET | /messages | List chat messages for a project |
| WebSocket | /ws/{project_id} | Real-time chat + collaborative editing |

### 9.5 Documents - `/api/v1/documents`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /upload | Upload a file |
| GET | /{id}/download | Download a file |
| DELETE | /{id} | Delete a file |
| GET | /{id}/url | Get presigned/data URL |

### 9.6 Knowledge Base - `/api/v1/knowledge`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | List knowledge base entries |
| POST | / | Add to knowledge base |
| GET | /{id} | Get entry details |
| PUT | /{id} | Update entry |
| DELETE | /{id} | Delete entry |
| POST | /search | RAG search (vector + keyword) |

### 9.7 System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | / | API info |

### 9.8 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "type": "ExceptionType"
  }
}
```

---

## 10. AI/LLM Integration (Planned)

> **Status: NOT YET IMPLEMENTED** - Architecture is specified, code is not written.

### 10.1 LangGraph Workflow

```
User Input (text/images/documents)
        |
        v
  Input Router (routes by input type)
        |
   +----+----+-----------+
   |         |           |
   v         v           v
Text Only  Images     Documents
(Analysis) (Vision)   (Parser)
   |         |           |
   +----+----+-----------+
        |
        v
Requirement Extraction (Claude 3.5 Sonnet)
        |
        v
Clarification Check (Mistral 7B)
        |
   +----+----+
   |         |
 Clear    Unclear --> Ask User
   |
   v
Knowledge Base RAG Search (pgvector)
   |
   v
Plugin Research (Claude 3 Haiku)
   |
   v
Complexity Assessment (Claude 3.5 Sonnet)
   |
   v
Quote Generation (Claude 3.5 Sonnet)
   |
   v
Format & Structure (Mistral 7B)
   |
   v
Final Quote Output
```

### 10.2 Model Selection Strategy

| Task | Model | Rationale |
|------|-------|-----------|
| Vision Analysis | Claude 3.5 Sonnet | Best vision understanding |
| Complex Reasoning | Claude 3.5 Sonnet | Accurate estimation |
| Research/Extraction | Claude 3 Haiku | Fast, cost-effective |
| Clarification | Mistral 7B | Simple classification |
| Formatting | Mistral 7B | Template following |
| Embeddings | OpenAI text-embedding-3-small | Industry standard, 1536 dims |

### 10.3 RAG Strategy

- **Chunking**: 512 tokens per chunk, 50-token overlap
- **Search**: Hybrid - vector similarity (pgvector cosine) + BM25 keyword
- **Reranking**: Cohere Rerank for top-5 final results
- **Auto-Learning**: Approved quotes indexed automatically
- **Feedback Loop**: Upvote/downvote adjusts relevance scores

### 10.4 Cost Estimate

- Per-quote AI cost: ~$0.038
- Monthly (3,500 quotes): ~$133 base + ~$100 buffer = ~$233

---

## 11. File Storage Architecture

### 11.1 Design Pattern: Strategy + Factory

The project uses an abstraction layer so the application code never depends on a specific storage backend.

```
FileStorageInterface (Abstract)
        |
   +----+----+
   |         |
   v         v
Database    S3
Provider    Provider
   |         |
   +----+----+
        |
        v
  StorageFactory.create()
  (reads STORAGE_PROVIDER env var)
```

### 11.2 Provider Comparison

| Aspect | Database Provider | S3 Provider |
|--------|------------------|-------------|
| Max File Size | 10 MB | 100 MB |
| Storage | PostgreSQL bytea column | AWS S3 bucket |
| URL Type | data:// (base64) | Presigned URLs (expiring) |
| External Deps | None | AWS credentials |
| Best For | MVP / Development | Production |
| Scalability | Limited (DB bloat) | Unlimited |

### 11.3 Migration Path (4 Phases)

1. **Phase 1 - MVP**: All files stored in database (current)
2. **Phase 2 - Dual Write**: New files written to both DB and S3
3. **Phase 3 - Background Migration**: Celery job migrates existing files DB to S3
4. **Phase 4 - S3 Primary**: Switch `STORAGE_PROVIDER=s3` env var

---

## 12. Real-Time Collaboration

### 12.1 Technology Stack

- **Editor**: TipTap 2 (ProseMirror-based rich text editor)
- **CRDT**: Y.js 13 (Conflict-free Replicated Data Type for conflict resolution)
- **Transport**: Socket.io (WebSocket with automatic reconnection and fallback)
- **Awareness**: Cursor positions, user presence indicators

### 12.2 How It Works

1. PM opens a quote in the editor
2. WebSocket connection established to `/ws/{project_id}`
3. Y.js document syncs state across all connected clients
4. Edits are merged conflict-free using CRDT algorithm
5. Cursor positions broadcast to all participants
6. Periodic snapshots saved to PostgreSQL

### 12.3 Limits

- Max 10 collaborators per quote editing session
- Sync latency target: < 100ms

---

## 13. Security Architecture

### 13.1 Authentication

- JWT tokens with HS256 algorithm
- Access token: 30 minutes TTL
- Refresh token: 7 days TTL
- Token rotation on refresh
- Secret key: 32+ characters

### 13.2 Authorization

| Role | Permissions |
|------|------------|
| Admin | Full access: user management, knowledge base, system settings |
| PM | Create/edit own projects and quotes, collaborate on shared projects |

| Project Role | Permissions |
|-------------|------------|
| Owner | Full control over the project |
| Editor | Edit quotes and chat |
| Viewer | Read-only access |

### 13.3 Data Protection

- Passwords: bcrypt with cost factor 12
- Data at rest: AES-256 (via AWS KMS in production)
- Data in transit: TLS 1.3
- SQL Injection: Prevented via SQLAlchemy ORM (parameterized queries)
- XSS: Content Security Policy headers
- CORS: Whitelist-only origins

### 13.4 Rate Limiting

- General API: 100 requests/min per user
- Auth endpoints: 5 requests/min per IP
- File upload: 10 requests/min per user

---

## 14. Docker & Deployment

### 14.1 Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| frontend | node:20-alpine (dev) / nginx:alpine (prod) | 3000 (dev) / 80 (prod) | React SPA |
| backend | python:3.11-slim | 8000 | FastAPI API server |
| db | pgvector/pgvector:pg16 | 5432 | PostgreSQL with pgvector |
| redis | redis:7-alpine | 6379 | Cache, sessions, pub/sub |
| migrations | python:3.11-slim | - | One-time Alembic migration runner |

### 14.2 Running the Project

```bash
# Development (with hot-reload)
docker compose up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run migrations only
docker compose run migrations

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### 14.3 Volumes

- `postgres_data` - Persistent database storage
- `redis_data` - Persistent Redis data

---

## 15. Project Structure

```
estimation/
|
+-- frontend/                    # React SPA
|   +-- src/
|   |   +-- pages/              # Route-level components
|   |   |   +-- Dashboard.tsx
|   |   |   +-- Login.tsx
|   |   |   +-- Register.tsx
|   |   |   +-- Projects.tsx
|   |   |   +-- ProjectDetail.tsx
|   |   |   +-- QuoteDetail.tsx
|   |   |   +-- QuoteEdit.tsx
|   |   |   +-- NewQuote.tsx
|   |   |   +-- NewProject.tsx
|   |   |
|   |   +-- components/         # Reusable UI components
|   |   |   +-- ui/             # shadcn/ui base components
|   |   |   +-- chat/           # ChatInterface, ChatMessage, ChatInput
|   |   |   +-- editor/         # QuoteEditor, ExportDialog
|   |   |   +-- auth/           # LoginForm, RegisterForm
|   |   |
|   |   +-- services/           # API communication layer
|   |   |   +-- api.ts          # Axios instance, interceptors, token refresh
|   |   |   +-- auth.ts
|   |   |   +-- projects.ts
|   |   |   +-- quotes.ts
|   |   |   +-- chat.ts
|   |   |   +-- upload.ts
|   |   |   +-- documents.ts
|   |   |
|   |   +-- stores/             # Zustand state stores
|   |   |   +-- authStore.ts
|   |   |   +-- editorStore.ts
|   |   |
|   |   +-- hooks/              # Custom React hooks
|   |   +-- types/              # TypeScript interfaces
|   |   +-- styles/             # Global CSS
|   |   +-- App.tsx             # Root component with router
|   |   +-- main.tsx            # Entry point
|   |
|   +-- Dockerfile
|   +-- package.json
|   +-- vite.config.ts
|   +-- tsconfig.json
|   +-- tailwind.config.js
|
+-- backend/                     # FastAPI API
|   +-- app/
|   |   +-- api/v1/             # API route handlers
|   |   |   +-- auth.py
|   |   |   +-- projects.py
|   |   |   +-- quotes.py
|   |   |   +-- chat.py
|   |   |   +-- knowledge.py
|   |   |   +-- documents.py
|   |   |
|   |   +-- core/               # Core infrastructure
|   |   |   +-- database.py     # Async SQLAlchemy setup
|   |   |   +-- security.py     # JWT, password hashing
|   |   |   +-- middleware.py   # CORS, error handling
|   |   |
|   |   +-- models/             # SQLAlchemy ORM models
|   |   |   +-- base.py         # Mixins (TimestampMixin, UUIDMixin)
|   |   |   +-- user.py
|   |   |   +-- project.py
|   |   |   +-- quote.py
|   |   |   +-- chat_message.py
|   |   |   +-- document.py
|   |   |   +-- knowledge_embedding.py
|   |   |
|   |   +-- schemas/            # Pydantic request/response schemas
|   |   +-- services/           # Business logic layer
|   |   +-- main.py             # FastAPI app entry point
|   |
|   +-- alembic/                # Database migrations
|   +-- tests/                  # Test suite
|   +-- config.py               # Settings (Pydantic-settings)
|   +-- requirements.txt
|   +-- Dockerfile
|
+-- specs/                       # Detailed specification documents
|   +-- overview.md
|   +-- tech-stack.md
|   +-- database-schema.md
|   +-- api-contracts.md
|   +-- llm-integration-architecture.md
|   +-- rag-implementation-strategy.md
|   +-- chat-interface-architecture.md
|   +-- phase-plan.md
|   +-- user-stories.md
|   +-- IMPLEMENTATION_GUIDE.md
|   +-- ARCHITECTURE_SUMMARY.md
|
+-- docker/
|   +-- init-db/                # Database initialization scripts
|
+-- docker-compose.yml           # Development config
+-- docker-compose.prod.yml      # Production overrides
+-- .env.example                 # Environment variable template
```

---

## 16. Current Implementation Status

### Implemented (Ready)

| Area | Status | Notes |
|------|--------|-------|
| FastAPI backend foundation | Done | All core infrastructure, middleware, error handling |
| Database models (SQLAlchemy) | Done | Users, Projects, Quotes, Chat, Documents, Knowledge, Embeddings |
| Alembic migrations | Done | 2 migrations created |
| JWT authentication | Done | Login, register, refresh, protected routes |
| File storage abstraction | Done | Database + S3 providers with factory pattern |
| API routers | Done | Auth, Projects, Quotes, Chat, Knowledge, Documents |
| React frontend setup | Done | Vite, TypeScript, Tailwind, shadcn/ui |
| Frontend routing | Done | React Router with protected routes |
| State management | Done | Zustand (auth, editor) + React Query (server state) |
| Service layer (API calls) | Done | Axios with interceptors, token refresh |
| UI pages | Done | Dashboard, Projects, Quotes, Login, Register |
| Chat UI components | Done | ChatInterface, ChatMessage, ChatInput |
| Editor UI components | Done | QuoteEditor, ExportDialog |
| Docker setup | Done | docker-compose with all 5 services |
| PostgreSQL + pgvector | Done | Running via Docker |
| Redis | Done | Running via Docker |

### Not Yet Implemented (Pending)

| Area | Status | Priority | Notes |
|------|--------|----------|-------|
| LLM/AI pipeline | Not started | High | OpenRouter client, LangGraph workflow |
| RAG system | Not started | High | Embedding generation, vector search, retrieval |
| WebSocket handlers | Partial | High | Socket.io configured, handlers incomplete |
| Real-time collaborative editing | Partial | High | TipTap + Y.js setup ready, sync not wired |
| Presence awareness | Not started | Medium | Cursor positions, user indicators |
| PDF/DOCX export | Not started | Medium | python-docx ready, endpoint not connected |
| Feedback system | Not started | Medium | UI and backend planned |
| Knowledge base management UI | Not started | Medium | Backend endpoints exist |
| Chat message persistence | Not started | Medium | Model exists, saving not wired |
| Project member invitations | Not started | Low | Backend endpoint exists |
| Admin panel | Not started | Low | Admin role exists |
| Celery task queue | Not started | Low | Redis ready, workers not configured |
| Email notifications | Not started | Low | AWS SES planned |
| Monitoring/Logging | Not started | Low | CloudWatch planned |

### Overall Completion: ~60%

The foundation is solid. Core CRUD operations, authentication, and UI are in place. The major pending work is the AI/LLM pipeline, real-time collaboration completion, and production polish.

---

## 17. Environment Setup

### 17.1 Environment Variables

```bash
# Application
APP_NAME=Quote Generation Assistant
DEBUG=true
ENVIRONMENT=development
LOG_LEVEL=INFO

# Ports
FRONTEND_PORT=3000
BACKEND_PORT=8000
POSTGRES_PORT=5432
REDIS_PORT=6379

# Database
POSTGRES_DB=quote_assistant
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/quote_assistant

# Redis
REDIS_URL=redis://redis:6379/0

# JWT Security
SECRET_KEY=dev-secret-key-change-in-production-32chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=["http://localhost:3000","http://frontend:3000"]

# File Storage
STORAGE_PROVIDER=database
# For S3 (production):
# STORAGE_PROVIDER=s3
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
# AWS_REGION=us-east-1
# S3_BUCKET_NAME=quote-assistant-uploads

# OpenRouter (for AI - when implemented)
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_APP_NAME=Estimate AI

# LLM Settings
LLM_DEFAULT_TEMPERATURE=0.3
LLM_DEFAULT_MAX_TOKENS=4096
LLM_REQUEST_TIMEOUT=120

# RAG Settings
RAG_TOP_K_RESULTS=5
RAG_SIMILARITY_THRESHOLD=0.7
EMBEDDING_DIMENSIONS=1536
```

### 17.2 Getting Started

```bash
# 1. Clone the repository
git clone <repo-url>
cd estimation

# 2. Copy environment file
cp .env.example .env
# Edit .env with your values

# 3. Start all services
docker compose up

# 4. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs (Swagger UI)
# Database: localhost:5432
# Redis: localhost:6379
```

---

## 18. Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| API Response (P95) | < 500ms |
| Quote Generation | < 30 seconds |
| Editor Sync Latency | < 100ms |
| Page Load (LCP) | < 2.5 seconds |
| Time to Interactive | < 3.5 seconds |
| Database Query (P95) | < 50ms |

### Scalability (12-month targets)

| Metric | Current | Target |
|--------|---------|--------|
| Concurrent Users | 70 | 150 |
| Quotes/Month | 3,500 | 10,000 |
| Knowledge Base Size | 1 GB | 10 GB |
| File Storage | 50 GB | 500 GB |
| WebSocket Connections | 70 | 200 |

### Availability

| Metric | Target |
|--------|--------|
| Uptime SLA | 99.9% |
| Recovery Time (RTO) | < 1 hour |
| Recovery Point (RPO) | < 5 minutes |

### Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive elements
- Screen reader compatibility (ARIA labels)
- Color contrast ratio 4.5:1 minimum

### Data Retention

| Data | Retention |
|------|-----------|
| Quotes & Versions | Permanent |
| Knowledge Base | Permanent (soft delete) |
| Research Cache | 30 days (auto-purge) |
| Audit Logs | 7 years (partitioned monthly) |
| WebSocket Sessions | 24 hours (auto-cleanup) |
| Feedback | Permanent (anonymize after 3 years) |

---

**End of Document**
