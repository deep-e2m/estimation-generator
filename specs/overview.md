# AI-Based Quote Generation Assistant

## System Overview and Architecture Specification

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Status**: Draft
**Classification**: Internal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Component Overview](#3-component-overview)
4. [Technology Stack Decisions](#4-technology-stack-decisions)
5. [Security Architecture](#5-security-architecture)
6. [Integration Points](#6-integration-points)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Appendices](#8-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

The AI-Based Quote Generation Assistant is an intelligent system designed to help Project Managers (PMs) estimate effort hours for WordPress, Shopify, and WooCommerce development projects. The system leverages AI-powered research capabilities, a continuously learning knowledge base, and real-time collaborative editing to streamline the quote generation process.

### 1.2 Business Objectives

| Objective | Success Metric |
|-----------|---------------|
| Reduce quote generation time | 60% reduction in average time-to-quote |
| Improve estimation accuracy | < 15% variance between quoted and actual hours |
| Enable knowledge sharing | 100% of approved quotes contributing to knowledge base |
| Support team collaboration | Real-time multi-user editing capability |
| Maintain high availability | 99.9% uptime SLA |

### 1.3 Target Users

| User Type | Count | Primary Functions |
|-----------|-------|-------------------|
| Project Managers | 65-70 | Create quotes, collaborate on estimates, export documents |
| Administrators | 3-5 | Manage knowledge base, user administration, system configuration |

### 1.4 Scope Summary

**In Scope (MVP)**:
- AI-assisted quote generation with plugin-specific research (Elementor, ACF Pro focus)
- Multi-format file upload (images, documents) for requirement analysis
- Real-time collaborative editor with Google Docs-like experience
- Export functionality (PDF, DOCX) via chat interface
- Project-based collaboration with team invitations
- Knowledge base with auto-learning from approved quotes
- Feedback system (thumbs up/down) for continuous improvement
- Sequential quote numbering system
- WCAG 2.1 AA accessibility compliance

**Out of Scope (MVP)**:
- Mobile native applications
- Integration with external project management tools
- Automated time tracking
- Client-facing quote sharing portal
- Multi-language support

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
+------------------------------------------------------------------+
|                         CLIENT LAYER                              |
|  +------------------------------------------------------------+  |
|  |                  React SPA (Vite)                           |  |
|  |  +-------------+  +-------------+  +-------------------+    |  |
|  |  | Auth Module |  | Chat Module |  | Collaborative     |    |  |
|  |  |             |  |             |  | Editor (TipTap)   |    |  |
|  |  +-------------+  +-------------+  +-------------------+    |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                              |
                              | HTTPS / WSS
                              v
+------------------------------------------------------------------+
|                      AWS CLOUD INFRASTRUCTURE                     |
|  +------------------------------------------------------------+  |
|  |                    API GATEWAY LAYER                        |  |
|  |  +------------------+  +--------------------------------+   |  |
|  |  | ALB (Load        |  | API Gateway (WebSocket Routes) |   |  |
|  |  | Balancer)        |  |                                |   |  |
|  |  +------------------+  +--------------------------------+   |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |                   APPLICATION LAYER                         |  |
|  |  +------------------------+  +---------------------------+  |  |
|  |  |    FastAPI Backend     |  |   WebSocket Server        |  |  |
|  |  |    (ECS Fargate)       |  |   (ECS Fargate)           |  |  |
|  |  |                        |  |                           |  |  |
|  |  |  +------------------+  |  |  +---------------------+  |  |  |
|  |  |  | REST API         |  |  |  | Real-time Sync      |  |  |  |
|  |  |  | Controllers      |  |  |  | (Y.js CRDT)         |  |  |  |
|  |  |  +------------------+  |  |  +---------------------+  |  |  |
|  |  |  | Business Logic   |  |  |  | Presence            |  |  |  |
|  |  |  | Services         |  |  |  | Management          |  |  |  |
|  |  |  +------------------+  |  |  +---------------------+  |  |  |
|  |  +------------------------+  +---------------------------+  |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |                    AI PIPELINE LAYER                        |  |
|  |  +------------------------------------------------------+  |  |
|  |  |              LangGraph Orchestration Engine           |  |  |
|  |  |                                                       |  |  |
|  |  |  +-------------+  +-------------+  +--------------+   |  |  |
|  |  |  | Requirement |  | Research    |  | Quote        |   |  |  |
|  |  |  | Analysis    |->| Agent       |->| Generation   |   |  |  |
|  |  |  | Node        |  | Node        |  | Node         |   |  |  |
|  |  |  +-------------+  +-------------+  +--------------+   |  |  |
|  |  |         |               |               |             |  |  |
|  |  |         v               v               v             |  |  |
|  |  |  +----------------------------------------------+     |  |  |
|  |  |  |           OpenRouter API Gateway             |     |  |  |
|  |  |  |  (Model Selection: Claude/GPT-4/Mistral)     |     |  |  |
|  |  |  +----------------------------------------------+     |  |  |
|  |  +------------------------------------------------------+  |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |                    DATA LAYER                               |  |
|  |  +----------------+  +----------------+  +---------------+  |  |
|  |  | PostgreSQL     |  | Redis          |  | File Storage  |  |  |
|  |  | (RDS)          |  | (ElastiCache)  |  | (Abstracted)  |  |  |
|  |  |                |  |                |  |               |  |  |
|  |  | - Users        |  | - Sessions     |  | - DB (MVP)    |  |  |
|  |  | - Projects     |  | - Cache        |  |   -> bytea    |  |  |
|  |  | - Quotes       |  | - Rate Limits  |  | - S3 (Future) |  |  |
|  |  | - Feedback     |  | - WebSocket    |  | - Uploads     |  |  |
|  |  | - File Blobs   |  |   State        |  | - Exports     |  |  |
|  |  +----------------+  +----------------+  +---------------+  |  |
|  |                                                             |  |
|  |  +------------------------------------------------------+  |  |
|  |  |              Vector Database (pgvector)               |  |  |
|  |  |  - Knowledge Base Embeddings                          |  |  |
|  |  |  - Plugin Documentation Embeddings                    |  |  |
|  |  |  - Historical Quote Embeddings                        |  |  |
|  |  +------------------------------------------------------+  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 2.2 Data Flow Architecture

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|   PM Submits      |---->|   File Upload     |---->|   Requirement     |
|   Requirement     |     |   Processing      |     |   Extraction      |
|                   |     |   (S3 + Lambda)   |     |   (Vision LLM)    |
+-------------------+     +-------------------+     +-------------------+
                                                            |
                                                            v
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|   Quote Ready     |<----|   Quote           |<----|   Knowledge Base  |
|   for Editing     |     |   Generation      |     |   RAG Search      |
|                   |     |   (LangGraph)     |     |   (pgvector)      |
+-------------------+     +-------------------+     +-------------------+
        |
        v
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|   Collaborative   |---->|   Export          |---->|   Auto-Learn      |
|   Editing         |     |   (PDF/DOCX)      |     |   (KB Update)     |
|   (WebSocket)     |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
```

### 2.3 Deployment Architecture

```
                    +------------------+
                    |   Route 53       |
                    |   (DNS)          |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   CloudFront     |
                    |   (CDN)          |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v---------+         +--------v---------+
     |   ALB            |         |   API Gateway    |
     |   (HTTP/HTTPS)   |         |   (WebSocket)    |
     +--------+---------+         +--------+---------+
              |                             |
     +--------v---------+         +--------v---------+
     |   ECS Fargate    |         |   ECS Fargate    |
     |   (API Service)  |         |   (WS Service)   |
     |   min: 2, max: 6 |         |   min: 2, max: 4 |
     +--------+---------+         +--------+---------+
              |                             |
              +--------------+--------------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v----+  +------v------+  +---v--------+
     |   RDS       |  |  ElastiCache|  |   S3       |
     |   PostgreSQL|  |  Redis      |  |   Buckets  |
     |   (Multi-AZ)|  |  (Cluster)  |  |            |
     +-------------+  +-------------+  +------------+
```

---

## 3. Component Overview

### 3.1 Frontend Application

#### 3.1.1 Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| Framework | React 18 + Vite | Lightning-fast HMR, optimized builds, modern dev experience |
| Build Tool | Vite 7 | Fastest development server, instant module reload, ESM-native |
| UI Library | Tailwind CSS + shadcn/ui | Rapid development, accessibility-first components |
| State Management | Zustand + React Query | Lightweight, excellent async state handling |
| Collaborative Editor | TipTap + Y.js | ProseMirror-based, CRDT support, extensible |
| WebSocket Client | Socket.io-client | Robust reconnection, fallback support |
| Form Handling | React Hook Form + Zod | Type-safe validation, performance |
| Routing | React Router v6 | Standard SPA routing, code splitting support |

#### 3.1.2 Key Modules

| Module | Responsibility |
|--------|---------------|
| Authentication | Login, session management, password reset |
| Dashboard | Project overview, recent quotes, activity feed |
| Chat Interface | Requirement input, file upload, AI interaction |
| Quote Editor | Collaborative editing, version history, comments |
| Export Module | PDF/DOCX generation triggers, download management |
| Admin Panel | Knowledge base management, user administration |

#### 3.1.3 Accessibility Requirements

- WCAG 2.1 AA compliance mandatory
- Keyboard navigation for all interactive elements
- Screen reader compatibility (ARIA labels, roles)
- Color contrast ratios meeting 4.5:1 minimum
- Focus indicators on all interactive elements
- Reduced motion support for animations

### 3.2 Backend Services

#### 3.2.1 Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| Framework | FastAPI (Python 3.11+) | Async support, OpenAPI generation, type hints |
| ORM | SQLAlchemy 2.0 + Alembic | Mature ecosystem, migration support |
| Task Queue | Celery + Redis | Distributed task processing for exports |
| WebSocket | Socket.io (Python) | Compatible with frontend, room management |
| API Documentation | OpenAPI 3.0 (auto-generated) | Client SDK generation, testing |

#### 3.2.2 Service Architecture

```
+------------------------------------------------------------------+
|                      FastAPI Application                          |
|  +------------------------------------------------------------+  |
|  |                      API Layer                              |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  |  | Auth     |  | Projects |  | Quotes   |  | Admin      |   |  |
|  |  | Router   |  | Router   |  | Router   |  | Router     |   |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  +------------------------------------------------------------+  |
|  |                    Service Layer                            |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  |  | Auth     |  | Project  |  | Quote    |  | Knowledge  |   |  |
|  |  | Service  |  | Service  |  | Service  |  | Service    |   |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  +------------------------------------------------------------+  |
|  |                   Repository Layer                          |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  |  | User     |  | Project  |  | Quote    |  | Knowledge  |   |  |
|  |  | Repo     |  | Repo     |  | Repo     |  | Repo       |   |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

#### 3.2.3 API Endpoint Categories

| Category | Base Path | Description |
|----------|-----------|-------------|
| Authentication | `/api/v1/auth` | Login, logout, token refresh, password management |
| Users | `/api/v1/users` | User CRUD, profile management |
| Projects | `/api/v1/projects` | Project CRUD, member management, invitations |
| Quotes | `/api/v1/quotes` | Quote CRUD, generation triggers, feedback |
| Chat | `/api/v1/chat` | Message handling, file uploads, AI interactions |
| Export | `/api/v1/export` | PDF/DOCX generation, download links |
| Admin | `/api/v1/admin` | Knowledge base management, system configuration |
| Health | `/api/v1/health` | Liveness, readiness probes |

### 3.3 AI Pipeline

#### 3.3.1 LangGraph Workflow Architecture

```
                         +-------------------+
                         |   START           |
                         |   (User Input)    |
                         +--------+----------+
                                  |
                         +--------v----------+
                         |   Input Router    |
                         |   Node            |
                         +--------+----------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
     +--------v--------+ +--------v--------+ +--------v--------+
     |  Text Only      | |  With Images    | |  With Documents |
     |  Analysis       | |  (Vision LLM)   | |  (Doc Parser)   |
     +--------+--------+ +--------+--------+ +--------+--------+
              |                   |                   |
              +-------------------+-------------------+
                                  |
                         +--------v----------+
                         |   Requirement     |
                         |   Extraction      |
                         |   Node            |
                         +--------+----------+
                                  |
                         +--------v----------+
                         |   Clarification   |<----+
                         |   Check Node      |     |
                         +--------+----------+     |
                                  |                |
                    +-------------+-------------+  |
                    |                           |  |
           (Clear)  |                  (Needs)  |  |
                    |                  Clarify  |  |
                    |                           |  |
           +--------v--------+         +--------v--+------+
           |                 |         |   Ask User      |
           |                 |         |   for Details   +--+
           |                 |         +-----------------+
           |                 |
           +--------v--------+
                    |
           +--------v----------+
           |   Knowledge Base  |
           |   RAG Search      |
           |   Node            |
           +--------+----------+
                    |
           +--------v----------+
           |   Plugin Research |
           |   Node            |
           |   (Elementor,     |
           |    ACF Pro, etc.) |
           +--------+----------+
                    |
           +--------v----------+
           |   Complexity      |
           |   Assessment      |
           |   Node            |
           +--------+----------+
                    |
           +--------v----------+
           |   Quote           |
           |   Generation      |
           |   Node            |
           +--------+----------+
                    |
           +--------v----------+
           |   Format &        |
           |   Structure       |
           |   Node            |
           +--------+----------+
                    |
           +--------v----------+
           |   END             |
           |   (Quote Output)  |
           +-------------------+
```

#### 3.3.2 Node Specifications

| Node | Model Used | Purpose | Input | Output |
|------|------------|---------|-------|--------|
| Input Router | Rules-based | Route based on input type | User message + attachments | Routing decision |
| Vision Analysis | Claude 3.5 Sonnet (via OpenRouter) | Extract requirements from images | Image files | Structured requirements |
| Document Parser | Unstructured.io + Mistral 7B | Parse and extract from documents | PDF, DOCX, etc. | Structured text |
| Requirement Extraction | Claude 3.5 Sonnet | Structure raw requirements | Raw text | Structured JSON |
| Clarification Check | Mistral 7B | Determine if clarification needed | Requirements | Boolean + questions |
| KB RAG Search | Embeddings + pgvector | Find similar past quotes | Requirements | Relevant quotes |
| Plugin Research | Claude 3 Haiku | Research plugin-specific estimates | Plugin list | Plugin estimates |
| Complexity Assessment | Claude 3.5 Sonnet | Assess overall complexity | All research data | Complexity score |
| Quote Generation | Claude 3.5 Sonnet | Generate detailed quote | All inputs | Draft quote |
| Format & Structure | Mistral 7B | Format for display | Draft quote | Formatted quote |

### 3.4 Knowledge Base System

#### 3.4.1 Architecture

```
+------------------------------------------------------------------+
|                    Knowledge Base System                          |
|  +------------------------------------------------------------+  |
|  |                   Ingestion Pipeline                        |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  |  | Document |  | Chunking |  | Embedding|  | Vector     |   |  |
|  |  | Parser   |->| Strategy |->| Model    |->| Storage    |   |  |
|  |  |          |  | (512tok) |  | (OpenAI) |  | (pgvector) |   |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  +------------------------------------------------------------+  |
|  |                   Query Pipeline                            |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  |  | Query    |  | Hybrid   |  | Rerank   |  | Context    |   |  |
|  |  | Embed    |->| Search   |->| (Cohere) |->| Assembly   |   |  |
|  |  |          |  | (Vector+ |  |          |  |            |   |  |
|  |  |          |  |  BM25)   |  |          |  |            |   |  |
|  |  +----------+  +----------+  +----------+  +------------+   |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

#### 3.4.2 Knowledge Sources

| Source | Content Type | Update Frequency |
|--------|-------------|------------------|
| Plugin Documentation | Elementor, ACF Pro, WooCommerce docs | Weekly crawl |
| Historical Quotes | Approved past estimates | Real-time (on approval) |
| Estimation Guidelines | Company standards, best practices | Manual updates |
| Project Templates | Common project patterns | Manual updates |
| Feedback Data | Thumbs up/down with context | Real-time |

#### 3.4.3 Auto-Learning Mechanism

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|   Quote Approved  |---->|   Extract         |---->|   Generate        |
|   by PM           |     |   Metadata        |     |   Embeddings      |
|                   |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
                                                            |
                                                            v
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|   Available for   |<----|   Index in        |<----|   Store with      |
|   Future RAG      |     |   pgvector        |     |   Feedback Score  |
|                   |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
```

### 3.5 File Storage Abstraction Layer

#### 3.5.1 Architecture Decision

The system implements a **Storage Provider Pattern** that abstracts file storage operations behind a unified interface. This enables seamless migration from database storage (MVP) to S3 (production scale) without code changes.

```
+------------------------------------------------------------------+
|                    Storage Abstraction Layer                      |
|  +------------------------------------------------------------+  |
|  |              FileStorageInterface (ABC)                     |  |
|  |  - upload(file, metadata) -> FileRecord                     |  |
|  |  - download(file_id) -> bytes                               |  |
|  |  - delete(file_id) -> bool                                  |  |
|  |  - get_url(file_id) -> str (presigned or data URL)          |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|              +---------------+---------------+                    |
|              |                               |                    |
|  +-----------v------------+      +-----------v-----------+        |
|  | DatabaseStorageProvider |      | S3StorageProvider     |        |
|  |                        |      |                       |        |
|  | - Stores in bytea      |      | - Stores in S3        |        |
|  | - Base64 encoding      |      | - Presigned URLs      |        |
|  | - Direct DB queries    |      | - Boto3 SDK           |        |
|  | - 10MB limit           |      | - Multi-part upload   |        |
|  +------------------------+      +-----------------------+        |
+------------------------------------------------------------------+
```

#### 3.5.2 Storage Provider Selection

```python
# Configuration-driven provider selection
STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "database")  # "database" or "s3"

# Factory pattern instantiation
storage_service = StorageFactory.create(STORAGE_PROVIDER)
```

#### 3.5.3 Migration Strategy

| Phase | Timeline | Storage Backend | Notes |
|-------|----------|----------------|-------|
| MVP (Phase 1) | Months 1-3 | PostgreSQL bytea | Simple deployment, no external dependencies |
| Transition | Month 4 | Dual-write mode | Write to both DB and S3, read from DB |
| Migration | Month 4-5 | Background migration | Async job to move files DB -> S3 |
| Production | Month 6+ | S3 primary | DB storage deprecated, fallback only |

#### 3.5.4 File Metadata Schema

```sql
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_provider VARCHAR(20) NOT NULL,  -- 'database' or 's3'
    storage_key TEXT NOT NULL,              -- DB: 'blob_id', S3: 's3://bucket/key'
    uploaded_by UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB                           -- Custom metadata (dimensions, etc.)
);

CREATE TABLE file_blobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
    blob_data BYTEA NOT NULL,               -- Actual file content (MVP only)
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3.5.5 File Size Limits and Constraints

| Storage Backend | Max File Size | Concurrent Uploads | Rationale |
|----------------|---------------|-------------------|-----------|
| PostgreSQL | 10 MB | 5 per user | Prevent DB bloat, suitable for MVP |
| S3 | 100 MB | 10 per user | Production scale, cost-effective |

### 3.6 Collaborative Editor

#### 3.6.1 Real-Time Synchronization

```
+------------------+                              +------------------+
|   Client A       |                              |   Client B       |
|   (TipTap +      |                              |   (TipTap +      |
|    Y.js)         |                              |    Y.js)         |
+--------+---------+                              +--------+---------+
         |                                                 |
         |  WebSocket                             WebSocket|
         |                                                 |
         v                                                 v
+------------------------------------------------------------------+
|                      Y.js WebSocket Server                        |
|  +------------------------------------------------------------+  |
|  |   Room Manager                                              |  |
|  |   - Quote ID = Room ID                                      |  |
|  |   - Max 10 concurrent editors per room                      |  |
|  +------------------------------------------------------------+  |
|  |   Awareness Protocol                                        |  |
|  |   - Cursor positions                                        |  |
|  |   - User presence                                           |  |
|  |   - Selection highlights                                    |  |
|  +------------------------------------------------------------+  |
|  |   Persistence Layer                                         |  |
|  |   - Periodic snapshots to PostgreSQL                        |  |
|  |   - Full history in S3 (for audit)                          |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

#### 3.6.2 Editor Features

| Feature | Implementation |
|---------|---------------|
| Rich Text Editing | TipTap with custom extensions |
| Real-time Collaboration | Y.js CRDT with WebSocket provider |
| Cursor Presence | Y.js Awareness protocol |
| Comments | Custom TipTap extension with thread support |
| Version History | Periodic snapshots with diff visualization |
| Offline Support | IndexedDB persistence with sync on reconnect |
| Export Triggers | Chat commands: `/export pdf`, `/export docx` |

---

## 4. Technology Stack Decisions

### 4.1 LangGraph vs LangChain Analysis

#### Decision: **LangGraph** for AI Orchestration

| Criterion | LangChain | LangGraph | Winner |
|-----------|-----------|-----------|--------|
| Complex workflow control | Chains are linear | Graph-based with cycles, conditionals | LangGraph |
| State management | Limited, manual | Built-in persistent state | LangGraph |
| Human-in-the-loop | Requires custom implementation | Native support with interrupts | LangGraph |
| Debugging | Basic tracing | Visual graph inspection | LangGraph |
| Streaming | Supported | Enhanced with node-level streaming | LangGraph |
| Retry/recovery | Manual implementation | Built-in checkpointing | LangGraph |

#### Justification

The quote generation workflow requires:
1. **Conditional routing** based on input type (text, images, documents)
2. **Cycles** for clarification loops when requirements are unclear
3. **Human-in-the-loop** for PM approval at key stages
4. **State persistence** across long-running conversations
5. **Partial execution recovery** when API calls fail

LangGraph provides native support for all these patterns, while LangChain would require significant custom infrastructure.

#### Implementation Pattern

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

# Define state schema
class QuoteState(TypedDict):
    messages: list[Message]
    requirements: dict
    research_results: dict
    quote_draft: str
    needs_clarification: bool
    feedback: dict

# Build graph
workflow = StateGraph(QuoteState)

# Add nodes
workflow.add_node("extract_requirements", extract_requirements_node)
workflow.add_node("check_clarity", clarity_check_node)
workflow.add_node("ask_clarification", ask_clarification_node)
workflow.add_node("rag_search", knowledge_base_search_node)
workflow.add_node("research_plugins", plugin_research_node)
workflow.add_node("generate_quote", quote_generation_node)
workflow.add_node("format_output", formatting_node)

# Add edges with conditions
workflow.add_conditional_edges(
    "check_clarity",
    lambda state: "ask_clarification" if state["needs_clarification"] else "rag_search"
)

# Compile with checkpointing
memory = SqliteSaver.from_conn_string(":memory:")
app = workflow.compile(checkpointer=memory)
```

### 4.2 RAG Implementation Approach

#### 4.2.1 Architecture Decision: Hybrid Search with Reranking

```
Query: "Estimate for WooCommerce product filter with Ajax"
                    |
                    v
        +----------------------+
        |   Query Processing   |
        |   - Expand: synonyms |
        |   - Extract: entities|
        +----------------------+
                    |
        +-----------+-----------+
        |                       |
        v                       v
+---------------+       +---------------+
| Vector Search |       | Keyword Search|
| (pgvector)    |       | (PostgreSQL   |
| cosine sim    |       |  full-text)   |
| top-k: 20     |       | BM25, top-k:20|
+---------------+       +---------------+
        |                       |
        +-----------+-----------+
                    |
                    v
        +----------------------+
        |   Reciprocal Rank    |
        |   Fusion (RRF)       |
        |   k=60               |
        +----------------------+
                    |
                    v
        +----------------------+
        |   Cohere Rerank      |
        |   top-k: 5           |
        +----------------------+
                    |
                    v
        +----------------------+
        |   Context Assembly   |
        |   with metadata      |
        +----------------------+
```

#### 4.2.2 Embedding Strategy

| Content Type | Embedding Model | Dimension | Rationale |
|--------------|-----------------|-----------|-----------|
| Quote content | text-embedding-3-small | 1536 | Cost-effective, good quality |
| Plugin docs | text-embedding-3-small | 1536 | Consistency with quotes |
| User queries | text-embedding-3-small | 1536 | Same space as content |

#### 4.2.3 Chunking Strategy

| Content Type | Chunk Size | Overlap | Strategy |
|--------------|------------|---------|----------|
| Quote documents | 512 tokens | 50 tokens | Sentence-aware splitting |
| Plugin documentation | 1024 tokens | 100 tokens | Section-based with headers preserved |
| Estimation guidelines | 256 tokens | 25 tokens | Paragraph-based |

#### 4.2.4 Metadata Schema

```json
{
  "chunk_id": "uuid",
  "source_type": "quote|plugin_doc|guideline",
  "source_id": "reference to original document",
  "platform": "wordpress|shopify|woocommerce",
  "plugins": ["elementor", "acf-pro"],
  "complexity": "low|medium|high",
  "feedback_score": 0.85,
  "created_at": "ISO timestamp",
  "approved_by": "user_id"
}
```

### 4.3 OpenRouter Model Selection Strategy

#### 4.3.1 Decision Matrix

| Task | Model | Cost/1K tokens | Rationale |
|------|-------|----------------|-----------|
| Vision Analysis | claude-3-5-sonnet | $0.003/$0.015 | Best vision understanding |
| Complex Reasoning | claude-3-5-sonnet | $0.003/$0.015 | Required for accurate estimates |
| Research/Fact Extraction | claude-3-haiku | $0.00025/$0.00125 | Fast, cost-effective for structured extraction |
| Clarification Questions | mistral-7b-instruct | $0.0002/$0.0002 | Simple classification task |
| Formatting/Structuring | mistral-7b-instruct | $0.0002/$0.0002 | Template-following, low complexity |
| Embeddings | openai/text-embedding-3-small | $0.00002 | Industry standard, pgvector compatible |
| Reranking | cohere/rerank-english-v3.0 | $0.002/query | High quality relevance scoring |

#### 4.3.2 Cost Optimization Strategy

```
Estimated Monthly Cost Breakdown (70 PMs, 50 quotes/PM/month = 3,500 quotes):

Per Quote Token Estimates:
- Input: ~2,000 tokens average
- Output: ~1,500 tokens average

Model Distribution per Quote:
+------------------+--------+--------+--------+---------+
| Stage            | Model  | Input  | Output | Cost    |
+------------------+--------+--------+--------+---------+
| Vision (20%)     | Sonnet | 1,000  | 500    | $0.0105 |
| Extraction       | Sonnet | 500    | 300    | $0.006  |
| Clarification    | Mistral| 300    | 100    | $0.0001 |
| RAG Assembly     | Haiku  | 1,500  | 200    | $0.0006 |
| Quote Generation | Sonnet | 2,000  | 1,000  | $0.021  |
| Formatting       | Mistral| 1,200  | 800    | $0.0004 |
+------------------+--------+--------+--------+---------+
| TOTAL per Quote  |        |        |        | ~$0.038 |
+------------------+--------+--------+--------+---------+

Monthly LLM Cost: 3,500 x $0.038 = ~$133/month

Add 50% buffer for retries, iterations: ~$200/month
Embedding costs (1M tokens/month): ~$20/month
Reranking (3,500 queries): ~$7/month

Total Estimated Monthly AI Cost: ~$227/month
```

#### 4.3.3 Fallback Strategy

```
Primary -> Fallback Chain:

claude-3-5-sonnet -> claude-3-haiku -> gpt-4-turbo (emergency)
mistral-7b-instruct -> mistral-nemo -> claude-3-haiku
```

Implemented via OpenRouter's automatic fallback or custom retry logic with model switching.

---

## 5. Security Architecture

### 5.1 Authentication and Authorization

#### 5.1.1 Authentication Flow

```
+------------------+     +------------------+     +------------------+
|   User Login     |     |   Backend        |     |   Response       |
|   (username/pwd) |---->|   Validation     |---->|   JWT Tokens     |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                                               +------------------+
                                               | Access Token     |
                                               | - 15 min expiry  |
                                               | - User claims    |
                                               +------------------+
                                               | Refresh Token    |
                                               | - 7 day expiry   |
                                               | - Rotation       |
                                               +------------------+
```

#### 5.1.2 Authorization Model

```
+------------------------------------------------------------------+
|                    Role-Based Access Control                      |
|  +------------------------------------------------------------+  |
|  |   ADMIN Role                                                |  |
|  |   - Full system access                                      |  |
|  |   - Knowledge base CRUD                                     |  |
|  |   - User management                                         |  |
|  |   - System configuration                                    |  |
|  +------------------------------------------------------------+  |
|  |   PM Role                                                   |  |
|  |   - Create/manage own projects                              |  |
|  |   - Invite collaborators to projects                        |  |
|  |   - Generate and edit quotes                                |  |
|  |   - Export documents                                        |  |
|  +------------------------------------------------------------+  |
|  |   COLLABORATOR Role (Project-scoped)                        |  |
|  |   - View invited projects                                   |  |
|  |   - Edit quotes (with permission)                           |  |
|  |   - Comment on quotes                                       |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

#### 5.1.3 Permission Matrix

| Resource | Admin | PM (Owner) | PM (Collaborator) |
|----------|-------|------------|-------------------|
| Create Project | Yes | Yes | No |
| View Project | All | Own + Invited | Invited Only |
| Invite Users | All | Own Projects | No |
| Generate Quote | Yes | Own Projects | Invited Projects |
| Edit Quote | Yes | Own Projects | If granted |
| Delete Quote | Yes | Own Projects | No |
| Export Quote | Yes | Own Projects | Invited Projects |
| Manage KB | Yes | No | No |
| User Admin | Yes | No | No |

### 5.2 Data Security

#### 5.2.1 Encryption

| Data State | Method | Key Management |
|------------|--------|----------------|
| Data at Rest (RDS) | AES-256 | AWS KMS |
| Data at Rest (S3) | AES-256 | AWS KMS (SSE-S3) |
| Data in Transit | TLS 1.3 | AWS Certificate Manager |
| Passwords | bcrypt (cost=12) | N/A |
| Tokens | HS256 | Environment secret |

#### 5.2.2 Data Classification

| Classification | Examples | Handling |
|----------------|----------|----------|
| Confidential | Passwords, tokens, API keys | Encrypted, never logged, rotate regularly |
| Internal | Quote content, project data | Encrypted at rest, access controlled |
| Public | Product documentation | Standard protection |

### 5.3 API Security

| Control | Implementation |
|---------|---------------|
| Rate Limiting | 100 requests/minute per user (Redis-backed) |
| Input Validation | Pydantic schemas with strict validation |
| SQL Injection | SQLAlchemy ORM with parameterized queries |
| XSS Prevention | Content Security Policy headers |
| CORS | Whitelist production domains only |
| Request Size | 10MB max for file uploads |
| File Validation | Magic bytes + extension + virus scan |

### 5.4 Infrastructure Security

```
+------------------------------------------------------------------+
|                         AWS VPC                                   |
|  +------------------------------------------------------------+  |
|  |   Public Subnet                                             |  |
|  |   +-------------------+  +-------------------+               |  |
|  |   | ALB               |  | NAT Gateway       |               |  |
|  |   +-------------------+  +-------------------+               |  |
|  +------------------------------------------------------------+  |
|  |   Private Subnet (Application)                              |  |
|  |   +-------------------+  +-------------------+               |  |
|  |   | ECS Fargate       |  | ECS Fargate       |               |  |
|  |   | (API)             |  | (WebSocket)       |               |  |
|  |   +-------------------+  +-------------------+               |  |
|  +------------------------------------------------------------+  |
|  |   Private Subnet (Data)                                     |  |
|  |   +-------------------+  +-------------------+               |  |
|  |   | RDS PostgreSQL    |  | ElastiCache Redis |               |  |
|  |   +-------------------+  +-------------------+               |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

| Component | Security Group Rules |
|-----------|---------------------|
| ALB | Inbound: 443 from 0.0.0.0/0 |
| ECS Tasks | Inbound: 8000 from ALB SG only |
| RDS | Inbound: 5432 from ECS SG only |
| ElastiCache | Inbound: 6379 from ECS SG only |

---

## 6. Integration Points

### 6.1 External Service Integrations

| Service | Purpose | Integration Method | Fallback |
|---------|---------|-------------------|----------|
| OpenRouter | LLM API gateway | REST API | Model switching |
| Cohere | Reranking | REST API | Skip reranking, use RRF only |
| AWS S3 | File storage | AWS SDK | N/A (critical) |
| AWS SES | Email notifications | AWS SDK | Log and retry queue |

### 6.2 API Contracts Summary

#### 6.2.1 OpenRouter Integration

```python
# Request
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer {OPENROUTER_API_KEY}
  HTTP-Referer: {APP_URL}
  X-Title: Quote Generation Assistant

Body:
{
  "model": "anthropic/claude-3-5-sonnet",
  "messages": [...],
  "temperature": 0.3,
  "max_tokens": 4096
}

# Response
{
  "id": "gen-xxx",
  "model": "anthropic/claude-3-5-sonnet",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "..."
    }
  }],
  "usage": {
    "prompt_tokens": 500,
    "completion_tokens": 300
  }
}
```

#### 6.2.2 Document Export Integration

```python
# Internal service call for PDF generation
POST /internal/export/pdf
Body:
{
  "quote_id": "uuid",
  "template": "standard",
  "include_breakdown": true,
  "include_assumptions": true
}

# Response
{
  "job_id": "uuid",
  "status": "processing",
  "estimated_completion": "2024-01-15T10:30:00Z"
}

# Webhook callback
POST {callback_url}
{
  "job_id": "uuid",
  "status": "completed",
  "download_url": "https://s3.../quote-123.pdf",
  "expires_at": "2024-01-15T11:30:00Z"
}
```

### 6.3 WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `quote:update` | Server -> Client | `{ operations: Y.js update }` |
| `presence:join` | Server -> All | `{ user_id, cursor_position }` |
| `presence:leave` | Server -> All | `{ user_id }` |
| `presence:cursor` | Client -> Server | `{ position, selection }` |
| `chat:message` | Bidirectional | `{ content, attachments }` |
| `chat:typing` | Client -> Server | `{ is_typing: boolean }` |
| `export:progress` | Server -> Client | `{ job_id, progress, status }` |

---

## 7. Non-Functional Requirements

### 7.1 Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API Response Time (P95) | < 500ms | CloudWatch metrics |
| Quote Generation Time | < 30 seconds | Application metrics |
| Editor Sync Latency | < 100ms | Client-side measurement |
| Page Load Time (LCP) | < 2.5s | Lighthouse/RUM |
| Time to Interactive | < 3.5s | Lighthouse |
| Database Query Time (P95) | < 50ms | RDS Performance Insights |

### 7.2 Scalability Requirements

| Dimension | Current | Target (12 months) | Strategy |
|-----------|---------|-------------------|----------|
| Concurrent Users | 70 | 150 | ECS auto-scaling |
| Quotes/Month | 3,500 | 10,000 | Async processing |
| Knowledge Base Size | 1GB | 10GB | pgvector HNSW indexing |
| File Storage | 50GB | 500GB | S3 lifecycle policies |
| WebSocket Connections | 70 | 200 | Horizontal scaling with Redis pub/sub |

### 7.3 Availability Requirements

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Uptime SLA | 99.9% | Multi-AZ deployment |
| RTO (Recovery Time) | < 1 hour | Automated failover |
| RPO (Recovery Point) | < 5 minutes | Continuous replication |
| Planned Downtime | < 4 hours/month | Blue-green deployments |

### 7.4 Monitoring and Observability

```
+------------------------------------------------------------------+
|                    Observability Stack                            |
|  +------------------------------------------------------------+  |
|  |   Metrics (CloudWatch)                                      |  |
|  |   - Application metrics (latency, errors, throughput)       |  |
|  |   - Infrastructure metrics (CPU, memory, network)           |  |
|  |   - Custom business metrics (quotes/day, feedback scores)   |  |
|  +------------------------------------------------------------+  |
|  |   Logging (CloudWatch Logs)                                 |  |
|  |   - Structured JSON logs                                    |  |
|  |   - Request correlation IDs                                 |  |
|  |   - Log levels: ERROR, WARN, INFO, DEBUG                    |  |
|  +------------------------------------------------------------+  |
|  |   Tracing (AWS X-Ray)                                       |  |
|  |   - Distributed request tracing                             |  |
|  |   - LLM call instrumentation                                |  |
|  |   - Database query tracing                                  |  |
|  +------------------------------------------------------------+  |
|  |   Alerting (CloudWatch Alarms + SNS)                        |  |
|  |   - Error rate > 1%                                         |  |
|  |   - P95 latency > 1s                                        |  |
|  |   - Quote generation failures                               |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 7.5 Accessibility Requirements (WCAG 2.1 AA)

| Criterion | Requirement | Verification |
|-----------|-------------|--------------|
| Perceivable | Text alternatives for images, captions | Automated + manual audit |
| Operable | Keyboard navigation, no seizure-inducing content | Automated + manual audit |
| Understandable | Readable text, predictable behavior | Manual audit |
| Robust | Valid HTML, ARIA compliance | Automated testing |

### 7.6 Compliance and Data Privacy

| Requirement | Implementation |
|-------------|---------------|
| Data Retention | Quotes retained for 7 years (configurable) |
| Data Export | Admin can export all user data on request |
| Data Deletion | Soft delete with 30-day purge cycle |
| Audit Logging | All data modifications logged with actor |
| Access Logging | All file downloads logged |

### 7.7 Budget Constraints

| Category | Monthly Budget | Allocation |
|----------|----------------|------------|
| AWS Infrastructure | $500-800 | ECS, RDS, ElastiCache, S3 |
| AI/LLM APIs | $250-350 | OpenRouter, Cohere, OpenAI Embeddings |
| Third-Party Services | $50-100 | Monitoring, error tracking |
| **Total** | **$800-1,250** | |

#### Cost Optimization Measures

1. **ECS Fargate Spot** for non-critical workloads (30-50% savings)
2. **Reserved Instances** for RDS after baseline established
3. **S3 Intelligent Tiering** for knowledge base files
4. **Model selection** optimized for cost (Mistral for simple tasks)
5. **Caching** at multiple layers to reduce LLM calls

---

## 8. Appendices

### 8.1 Glossary

| Term | Definition |
|------|------------|
| ACF Pro | Advanced Custom Fields Pro - WordPress plugin |
| CRDT | Conflict-free Replicated Data Type |
| Elementor | WordPress page builder plugin |
| LangGraph | Framework for building stateful LLM applications |
| OpenRouter | API gateway for multiple LLM providers |
| pgvector | PostgreSQL extension for vector similarity search |
| RAG | Retrieval-Augmented Generation |
| RRF | Reciprocal Rank Fusion |
| Y.js | CRDT implementation for real-time collaboration |

### 8.2 Reference Documents

| Document | Location |
|----------|----------|
| API Specifications | `/specs/backend/api-endpoints.md` |
| Data Models | `/specs/backend/data-models.md` |
| Frontend Components | `/specs/frontend/components.md` |
| UI Flows | `/specs/frontend/ui-flows.md` |
| Task Breakdown | `/specs/tasks/` |

### 8.3 Decision Log

| ID | Date | Decision | Rationale | Alternatives Considered |
|----|------|----------|-----------|------------------------|
| D001 | 2026-01-20 | Use LangGraph over LangChain | Complex workflow with cycles, state management | LangChain, custom orchestration |
| D002 | 2026-01-20 | Use pgvector over Pinecone | Cost-effective, same PostgreSQL instance | Pinecone, Weaviate, Qdrant |
| D003 | 2026-01-20 | Use TipTap + Y.js for editor | Best balance of features and CRDT support | Slate, ProseMirror, Lexical |
| D004 | 2026-01-20 | Multi-model strategy via OpenRouter | Cost optimization, fallback capability | Single model, direct API |

### 8.4 Open Questions

| ID | Question | Owner | Due Date | Status |
|----|----------|-------|----------|--------|
| Q001 | Confirm quote retention policy with legal | Product Owner | TBD | Open |
| Q002 | Define exact plugin list for knowledge base | Product Owner | TBD | Open |
| Q003 | Confirm export template designs | Design Lead | TBD | Open |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | Product Orchestrator | Initial specification |
