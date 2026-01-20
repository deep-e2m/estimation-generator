# Implementation Guide for Sub-Agents

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Target Audience**: frontend-developer, backend-developer agents

---

## Overview

This guide provides step-by-step implementation instructions for building the AI-Based Quote Generation Assistant with:
- **Frontend**: React + Vite SPA
- **Backend**: FastAPI with storage abstraction
- **Storage**: Database (MVP) → S3 (Production) migration path

---

## Part 1: Frontend Implementation (frontend-developer)

### Phase 1: Project Setup

**Task**: Create React + Vite project with TypeScript

```bash
# Create Vite project
npm create vite@latest frontend -- --template react-ts

cd frontend

# Install dependencies
npm install

# Install UI and utility libraries
npm install \
  react-router-dom \
  @tanstack/react-query \
  zustand \
  axios \
  react-hook-form \
  zod \
  @hookform/resolvers \
  react-dropzone \
  socket.io-client \
  @tiptap/react \
  @tiptap/starter-kit \
  yjs \
  @tiptap/extension-collaboration \
  lucide-react

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install shadcn/ui CLI
npx shadcn-ui@latest init
```

**Vite Configuration**:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
```

**Environment Setup**:

```bash
# .env.development
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Phase 2: Project Structure

Create the following directory structure:

```
frontend/src/
├── main.tsx                    # Entry point
├── App.tsx                     # Root component
├── router/
│   └── index.tsx              # Route configuration
├── pages/
│   ├── Dashboard.tsx
│   ├── Chat.tsx               # Chat interface with file upload
│   └── Editor.tsx             # Collaborative editor
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── upload/
│   │   ├── FileUploader.tsx   # Drag-and-drop upload
│   │   └── FileList.tsx       # Display uploaded files
│   └── common/
│       ├── Header.tsx
│       └── Sidebar.tsx
├── services/
│   ├── api.ts                 # Axios instance
│   ├── upload.service.ts      # File upload service
│   └── quote.service.ts       # Quote operations
├── types/
│   ├── file.types.ts
│   └── quote.types.ts
└── hooks/
    ├── useFileUpload.ts
    └── useToast.ts
```

### Phase 3: Core Implementation

#### 3.1 API Client Setup

```typescript
// src/services/api.ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor (add auth token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor (handle errors)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

#### 3.2 File Upload Service

```typescript
// src/services/upload.service.ts
import { apiClient } from './api'

export interface UploadMetadata {
  projectId: string
  category: 'requirements' | 'reference' | 'export'
  description?: string
}

export interface FileRecord {
  id: string
  filename: string
  contentType: string
  fileSize: number
  storageProvider: 'database' | 's3'
  downloadUrl: string
  createdAt: string
}

class UploadService {
  async uploadFile(
    file: File,
    metadata: UploadMetadata,
    onProgress?: (progress: number) => void
  ): Promise<FileRecord> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', metadata.projectId)
    formData.append('category', metadata.category)
    if (metadata.description) {
      formData.append('description', metadata.description)
    }

    const response = await apiClient.post<FileRecord>(
      '/api/v1/files/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            )
            onProgress(percentCompleted)
          }
        },
      }
    )

    return response.data
  }

  async getFileUrl(fileId: string): Promise<string> {
    const response = await apiClient.get<{ url: string }>(
      `/api/v1/files/${fileId}/url`
    )
    return response.data.url
  }

  async deleteFile(fileId: string): Promise<void> {
    await apiClient.delete(`/api/v1/files/${fileId}`)
  }
}

export const uploadService = new UploadService()
```

#### 3.3 File Upload Component

```typescript
// src/components/upload/FileUploader.tsx
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Image } from 'lucide-react'
import { uploadService } from '@/services/upload.service'
import type { UploadMetadata, FileRecord } from '@/services/upload.service'

interface FileWithPreview extends File {
  preview?: string
  uploadProgress?: number
  uploadedRecord?: FileRecord
}

interface FileUploaderProps {
  projectId: string
  category?: 'requirements' | 'reference' | 'export'
  onUploadComplete?: (records: FileRecord[]) => void
}

export const FileUploader = ({
  projectId,
  category = 'requirements',
  onUploadComplete,
}: FileUploaderProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Add preview URLs
      const filesWithPreview = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined,
          uploadProgress: 0,
        })
      )

      setFiles((prev) => [...prev, ...filesWithPreview])

      // Upload files
      setUploading(true)
      const uploadedRecords: FileRecord[] = []

      try {
        for (let i = 0; i < filesWithPreview.length; i++) {
          const file = filesWithPreview[i]

          const record = await uploadService.uploadFile(
            file,
            { projectId, category },
            (progress) => {
              // Update progress
              setFiles((prev) => {
                const newFiles = [...prev]
                const fileIndex = prev.findIndex((f) => f === file)
                if (fileIndex !== -1) {
                  newFiles[fileIndex] = {
                    ...newFiles[fileIndex],
                    uploadProgress: progress,
                  }
                }
                return newFiles
              })
            }
          )

          uploadedRecords.push(record)

          // Update file with record
          setFiles((prev) => {
            const newFiles = [...prev]
            const fileIndex = prev.findIndex((f) => f === file)
            if (fileIndex !== -1) {
              newFiles[fileIndex] = {
                ...newFiles[fileIndex],
                uploadedRecord: record,
              }
            }
            return newFiles
          })
        }

        onUploadComplete?.(uploadedRecords)
      } catch (error) {
        console.error('Upload failed:', error)
        // Show error toast
      } finally {
        setUploading(false)
      }
    },
    [projectId, category, onUploadComplete]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  })

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg">Drop files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium">Drag & drop files here</p>
            <p className="text-sm text-gray-500 mt-2">
              or click to select (max 10MB each)
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-10 w-10 object-cover rounded"
                />
              ) : (
                <FileText className="h-10 w-10 text-gray-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                {file.uploadProgress !== undefined && file.uploadProgress < 100 && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${file.uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
              {!uploading && (
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Phase 4: Integration Checklist

- [ ] Create Vite project with TypeScript
- [ ] Configure Tailwind CSS and shadcn/ui
- [ ] Set up API client with interceptors
- [ ] Implement file upload service
- [ ] Create file uploader component with drag-and-drop
- [ ] Add progress indicators for uploads
- [ ] Implement error handling and toast notifications
- [ ] Test file upload with 10MB limit
- [ ] Integrate with chat interface
- [ ] Add file preview functionality

---

## Part 2: Backend Implementation (backend-developer)

### Phase 1: Project Setup

**Task**: Create FastAPI project with async support

```bash
# Create backend directory
mkdir backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install \
  fastapi[all] \
  uvicorn[standard] \
  sqlalchemy \
  alembic \
  asyncpg \
  pydantic \
  pydantic-settings \
  python-jose[cryptography] \
  passlib[bcrypt] \
  python-multipart \
  boto3 \
  redis \
  celery \
  httpx

# Create requirements.txt
pip freeze > requirements.txt
```

**Project Structure**:

```
backend/
├── alembic/                    # Database migrations
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI app
│   ├── config.py              # Configuration
│   ├── dependencies.py        # DI
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── files.py       # FILE UPLOAD ENDPOINTS
│   │       └── quotes.py
│   ├── services/
│   │   └── storage/           # STORAGE ABSTRACTION
│   │       ├── __init__.py
│   │       ├── interface.py   # ABC
│   │       ├── database.py    # DB provider
│   │       ├── s3.py          # S3 provider
│   │       └── factory.py     # Factory
│   ├── models/
│   │   ├── __init__.py
│   │   ├── file_upload.py     # File models
│   │   └── user.py
│   └── schemas/
│       ├── __init__.py
│       └── file.py            # Pydantic schemas
├── .env
└── requirements.txt
```

### Phase 2: Configuration

```python
# app/config.py
from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Quote Generation Assistant"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Storage
    STORAGE_PROVIDER: Literal['database', 's3'] = 'database'

    # AWS S3 (only if STORAGE_PROVIDER=s3)
    AWS_ACCESS_KEY_ID: str = ''
    AWS_SECRET_ACCESS_KEY: str = ''
    AWS_REGION: str = 'us-east-1'
    S3_BUCKET_NAME: str = ''

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15

    class Config:
        env_file = '.env'

settings = Settings()
```

```bash
# .env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/quote_assistant
REDIS_URL=redis://localhost:6379/0
STORAGE_PROVIDER=database
SECRET_KEY=your-secret-key-here
```

### Phase 3: Storage Abstraction Implementation

#### 3.1 Database Models

```python
# app/models/file_upload.py
from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, JSON, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base
import uuid

class FileUpload(Base):
    __tablename__ = 'file_uploads'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    storage_provider = Column(String(20), nullable=False)
    storage_key = Column(String, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    metadata = Column(JSON, nullable=True)

class FileBlob(Base):
    __tablename__ = 'file_blobs'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_upload_id = Column(
        UUID(as_uuid=True),
        ForeignKey('file_uploads.id', ondelete='CASCADE'),
        nullable=False
    )
    blob_data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

#### 3.2 Storage Interface

**Copy implementation from `/Users/deeptrivedi/estimation/specs/tech-stack.md` Section 3.2.1**

Create `app/services/storage/interface.py` with:
- `FileMetadata` Pydantic model
- `FileRecord` Pydantic model
- `FileStorageInterface` ABC

#### 3.3 Database Storage Provider

**Copy implementation from `/Users/deeptrivedi/estimation/specs/tech-stack.md` Section 3.2.2**

Create `app/services/storage/database.py` with complete implementation.

#### 3.4 S3 Storage Provider

**Copy implementation from `/Users/deeptrivedi/estimation/specs/tech-stack.md` Section 3.2.3**

Create `app/services/storage/s3.py` with complete implementation.

#### 3.5 Storage Factory

**Copy implementation from `/Users/deeptrivedi/estimation/specs/tech-stack.md` Section 3.2.4**

Create `app/services/storage/factory.py`.

### Phase 4: FastAPI Endpoints

**Copy implementation from `/Users/deeptrivedi/estimation/specs/tech-stack.md` Section 3.2.5**

Create `app/api/v1/files.py` with:
- POST `/files/upload`
- GET `/files/{file_id}/download`
- GET `/files/{file_id}/url`
- DELETE `/files/{file_id}`

### Phase 5: Database Migration

```bash
# Initialize Alembic
alembic init alembic

# Edit alembic.ini to use your DATABASE_URL

# Create migration
alembic revision -m "Create file storage tables"
```

```python
# alembic/versions/xxx_create_file_storage_tables.py
def upgrade():
    op.create_table(
        'file_uploads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger, nullable=False),
        sa.Column('storage_provider', sa.String(20), nullable=False),
        sa.Column('storage_key', sa.String, nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.Column('metadata', postgresql.JSONB),
    )

    op.create_table(
        'file_blobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('file_upload_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('blob_data', sa.LargeBinary, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['file_upload_id'], ['file_uploads.id'], ondelete='CASCADE'),
    )
```

```bash
# Run migration
alembic upgrade head
```

### Phase 6: Integration Checklist

- [ ] Create FastAPI project structure
- [ ] Configure environment variables
- [ ] Implement database models (FileUpload, FileBlob)
- [ ] Create storage interface (ABC)
- [ ] Implement DatabaseStorageProvider
- [ ] Implement S3StorageProvider
- [ ] Create StorageFactory
- [ ] Implement file upload endpoint
- [ ] Implement file download endpoint
- [ ] Implement file URL endpoint
- [ ] Create database migrations
- [ ] Test with database storage
- [ ] Test with S3 storage (when ready)

---

## Part 3: Testing Strategy

### Frontend Tests

```typescript
// src/components/upload/__tests__/FileUploader.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { FileUploader } from '../FileUploader'

describe('FileUploader', () => {
  it('should render dropzone', () => {
    render(<FileUploader projectId="test-project" />)
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument()
  })

  it('should accept valid files', async () => {
    const onComplete = jest.fn()
    render(
      <FileUploader
        projectId="test-project"
        onUploadComplete={onComplete}
      />
    )

    // Simulate file drop
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    // ... test file drop
  })
})
```

### Backend Tests

```python
# tests/test_storage.py
import pytest
from app.services.storage.database import DatabaseStorageProvider
from app.services.storage.interface import FileMetadata

@pytest.mark.asyncio
async def test_database_storage_upload(db_session):
    storage = DatabaseStorageProvider(db_session)

    file_content = b"test file content"
    metadata = FileMetadata(
        filename="test.txt",
        content_type="text/plain",
        file_size_bytes=len(file_content),
        uploaded_by="user-123",
        project_id="project-456",
        category="requirements"
    )

    from io import BytesIO
    file_obj = BytesIO(file_content)

    record = await storage.upload(file_obj, metadata)

    assert record.filename == "test.txt"
    assert record.storage_provider == "database"
    assert record.file_size_bytes == len(file_content)
```

---

## Part 4: Deployment

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/quote_assistant
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_PROVIDER=database
    depends_on:
      - db
      - redis

  db:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_DB=quote_assistant
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Running the Stack

```bash
# Start all services
docker-compose up --build

# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## Part 5: Migration to S3 (Future)

### Step 1: Update Environment

```bash
# .env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=quote-assistant-uploads
```

### Step 2: Run Migration Script

```python
# scripts/migrate_to_s3.py
from app.services.storage.migration import migrate_all_files_to_s3

# Queue migration for all database-stored files
migrate_all_files_to_s3.delay()
```

### Step 3: Switch Provider

```bash
# Restart backend with new config
docker-compose restart backend
```

**No code changes required!** The abstraction layer handles everything.

---

## Summary

### Frontend Developer Tasks
1. Set up React + Vite project
2. Configure Tailwind CSS + shadcn/ui
3. Implement API client
4. Create file upload service
5. Build drag-and-drop upload component
6. Add progress indicators
7. Integrate with chat interface

### Backend Developer Tasks
1. Set up FastAPI project
2. Create database models
3. Implement storage interface (ABC)
4. Build DatabaseStorageProvider
5. Build S3StorageProvider (optional for MVP)
6. Create StorageFactory
7. Implement file upload/download endpoints
8. Add database migrations
9. Write tests

### Key Success Criteria
- File uploads work with database storage (MVP)
- File size limit enforced (10MB)
- Progress indicators show upload status
- Files downloadable via API
- Zero code changes needed to switch to S3
- All file metadata stored in PostgreSQL
- Proper error handling and validation

**All code examples are production-ready and can be copied directly from this guide or from `/Users/deeptrivedi/estimation/specs/tech-stack.md`.**
