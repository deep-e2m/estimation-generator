# Architecture Summary - Quick Reference

**Last Updated**: 2026-01-20
**Status**: Final

---

## Key Architectural Changes

### 1. Frontend: React + Vite (not Next.js)

**Rationale**:
- Internal tool (no SEO requirements)
- WebSocket-heavy real-time application
- Faster development experience (instant HMR)
- Simpler deployment (static SPA, no SSR complexity)
- Better performance for client-heavy apps

**Tech Stack**:
```
React 18 + Vite 7 + TypeScript
├── React Router 6 (SPA routing)
├── Tailwind CSS + shadcn/ui
├── Zustand (state) + React Query (async state)
├── TipTap + Y.js (collaborative editor)
├── Socket.io-client (WebSocket)
└── React Hook Form + Zod (forms)
```

### 2. File Storage Abstraction Layer

**Pattern**: Repository + Strategy Pattern

```
FileStorageInterface (ABC)
├── DatabaseStorageProvider (MVP)
│   ├── PostgreSQL bytea storage
│   ├── 10MB file size limit
│   ├── No external dependencies
│   └── Simple deployment
└── S3StorageProvider (Production)
    ├── AWS S3 storage
    ├── 100MB file size limit
    ├── Presigned URLs
    └── Scalable for production
```

**Configuration-Driven**:
```bash
# MVP
export STORAGE_PROVIDER=database

# Production
export STORAGE_PROVIDER=s3
```

**Zero Code Changes**: Application code depends on `FileStorageInterface`, not specific implementations.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │    React SPA (Vite) - Static Deployment                │ │
│  │    - Auth Module                                       │ │
│  │    - Chat Interface (file upload)                      │ │
│  │    - Collaborative Editor (TipTap + Y.js)              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS / WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER (FastAPI)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │    REST API + WebSocket Server (ECS Fargate)           │ │
│  │    - File upload/download endpoints                    │ │
│  │    - Storage abstraction (factory pattern)             │ │
│  │    - LangGraph AI workflow                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ PostgreSQL   │  │ Redis        │  │ File Storage     │  │
│  │ + pgvector   │  │ (ElastiCache)│  │ (Abstracted)     │  │
│  │              │  │              │  │                  │  │
│  │ - Users      │  │ - Sessions   │  │ MVP: DB bytea    │  │
│  │ - Projects   │  │ - Cache      │  │ Prod: S3         │  │
│  │ - Quotes     │  │ - WebSocket  │  │                  │  │
│  │ - Files      │  │   state      │  │ - Uploads        │  │
│  │ - Embeddings │  │ - Rate limit │  │ - Exports        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## File Storage Architecture

### Database Schema

```sql
-- File metadata (always in PostgreSQL)
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY,
    filename VARCHAR(255),
    content_type VARCHAR(100),
    file_size_bytes BIGINT,
    storage_provider VARCHAR(20),  -- 'database' or 's3'
    storage_key TEXT,              -- 'blob:uuid' or 's3://bucket/key'
    uploaded_by UUID,
    project_id UUID,
    created_at TIMESTAMP,
    metadata JSONB
);

-- File blobs (only for database storage, MVP only)
CREATE TABLE file_blobs (
    id UUID PRIMARY KEY,
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
    blob_data BYTEA,               -- Actual file content
    created_at TIMESTAMP
);
```

### Python Interface

```python
# Abstract interface
class FileStorageInterface(ABC):
    @abstractmethod
    async def upload(file: BinaryIO, metadata: FileMetadata) -> FileRecord

    @abstractmethod
    async def download(file_id: str) -> bytes

    @abstractmethod
    async def delete(file_id: str) -> bool

    @abstractmethod
    async def get_download_url(file_id: str, expires_in: int) -> str

# Factory pattern
storage = StorageFactory.create(db_session)  # Auto-selects provider
record = await storage.upload(file, metadata)
```

### FastAPI Endpoint

```python
@router.post("/files/upload")
async def upload_file(
    file: UploadFile,
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Storage provider automatically selected from config
    storage = StorageFactory.create(db)

    metadata = FileMetadata(
        filename=file.filename,
        content_type=file.content_type,
        file_size_bytes=file_size,
        uploaded_by=current_user.id,
        project_id=project_id
    )

    return await storage.upload(file, metadata)
```

### React File Upload Component

```typescript
// Simple drag-and-drop upload
import { useDropzone } from 'react-dropzone'

const { getRootProps, getInputProps } = useDropzone({
  onDrop: async (files) => {
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('project_id', projectId)

    await uploadService.uploadFile(formData)
  },
  accept: {
    'image/*': ['.png', '.jpg', '.jpeg'],
    'application/pdf': ['.pdf']
  },
  maxSize: 10 * 1024 * 1024  // 10MB
})
```

---

## Migration Strategy: Database → S3

### Phase 1: MVP (Database Storage)
```bash
# Environment configuration
STORAGE_PROVIDER=database

# No AWS credentials needed
# Files stored in PostgreSQL bytea column
# 10MB file size limit
```

### Phase 2: Dual-Write (Transition)
```python
# Write to both DB and S3, read from DB
class DualWriteStorageProvider(FileStorageInterface):
    async def upload(self, file, metadata):
        db_record = await self.db_provider.upload(file, metadata)
        await self.s3_provider.upload(file, metadata)  # Shadow write
        return db_record
```

### Phase 3: Migration (Background Job)
```python
# Celery task to migrate existing files
@celery.task
def migrate_file_to_s3(file_id: str):
    # 1. Read file from database
    # 2. Upload to S3
    # 3. Update storage_provider and storage_key
    # 4. Optionally delete DB blob
```

### Phase 4: Production (S3 Primary)
```bash
# Environment configuration
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=quote-assistant-uploads

# All new uploads go to S3
# 100MB file size limit
```

**Timeline**: 4-6 weeks for full migration

---

## Technology Decisions Summary

### Frontend

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Framework | React + Vite | SPA, WebSocket-heavy, faster than Next.js |
| UI Library | Tailwind + shadcn/ui | Rapid development, accessible |
| State | Zustand + React Query | Lightweight, excellent async handling |
| Editor | TipTap + Y.js | CRDT for real-time collaboration |

### Backend

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Framework | FastAPI | Async, type hints, auto docs |
| ORM | SQLAlchemy 2.0 | Mature, async support |
| AI Workflow | LangGraph | Stateful workflows, cycles, human-in-loop |
| Vector DB | pgvector | Cost-effective, same PostgreSQL instance |

### Storage

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| MVP | PostgreSQL bytea | Simple, no external deps, transactional |
| Production | AWS S3 | Scalable, cost-effective, 100MB limit |
| Pattern | Abstraction layer | Zero-downtime migration path |

---

## Sub-Agent Guidance

### Frontend Developer

**Key Files**:
- `/Users/deeptrivedi/estimation/specs/overview.md` - Section 3.1 (Frontend)
- `/Users/deeptrivedi/estimation/specs/tech-stack.md` - Section 1 (Frontend Stack)

**Implementation Focus**:
1. React + Vite project setup (not Next.js)
2. File upload component with react-dropzone
3. API service layer for file operations
4. WebSocket integration for collaborative editor
5. Form handling with React Hook Form + Zod

**Example Code**: See tech-stack.md Section 1.4 (File Uploader Component)

### Backend Developer

**Key Files**:
- `/Users/deeptrivedi/estimation/specs/overview.md` - Section 3.2 (Backend)
- `/Users/deeptrivedi/estimation/specs/tech-stack.md` - Section 2-3 (Backend + Storage)

**Implementation Focus**:
1. Storage abstraction layer (interface + providers)
2. FastAPI endpoints for file upload/download
3. Database models for file metadata
4. LangGraph workflow integration
5. Celery tasks for background migration

**Example Code**: See tech-stack.md Section 3.2 (Storage Implementations)

---

## Quick Commands

### Development Setup

```bash
# Frontend (Vite)
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000

# Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Runs on http://localhost:8000

# Docker Compose (Full Stack)
docker-compose up --build
```

### Environment Variables

```bash
# Frontend (.env.development)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# Backend (.env)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/dbname
REDIS_URL=redis://localhost:6379/0
STORAGE_PROVIDER=database  # or 's3'
OPENROUTER_API_KEY=sk-xxx

# S3 Configuration (only if STORAGE_PROVIDER=s3)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET_NAME=quote-assistant-uploads
```

---

## File References

| Document | Purpose |
|----------|---------|
| `/Users/deeptrivedi/estimation/specs/overview.md` | Complete system architecture |
| `/Users/deeptrivedi/estimation/specs/tech-stack.md` | Detailed tech stack with code examples |
| `/Users/deeptrivedi/estimation/specs/database-schema.md` | Database schema details |
| `/Users/deeptrivedi/estimation/specs/api-contracts.md` | API endpoint specifications |

---

**Note**: All architectural decisions prioritize:
1. **Simplicity for MVP** (database storage, Docker Compose)
2. **Clear migration path** (abstraction layer for S3 transition)
3. **Zero code changes** when scaling (configuration-driven)
4. **Fast development** (Vite HMR, FastAPI async, auto docs)
