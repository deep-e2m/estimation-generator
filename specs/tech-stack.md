# Technology Stack Specification

**Document Version**: 1.0
**Last Updated**: 2026-01-20
**Status**: Final
**Classification**: Internal

---

## Table of Contents

1. [Frontend Technology Stack](#1-frontend-technology-stack)
2. [Backend Technology Stack](#2-backend-technology-stack)
3. [File Storage Abstraction Design](#3-file-storage-abstraction-design)
4. [Database and Caching](#4-database-and-caching)
5. [AI/LLM Infrastructure](#5-aillm-infrastructure)
6. [DevOps and Deployment](#6-devops-and-deployment)
7. [Migration Strategies](#7-migration-strategies)

---

## 1. Frontend Technology Stack

### 1.1 React + Vite Rationale

#### Why React (not Next.js)?

| Consideration | React + Vite | Next.js | Decision |
|--------------|--------------|---------|----------|
| **Use Case Fit** | SPA, client-heavy, WebSocket-intensive | SSR/SSG, SEO-critical, server-first | React + Vite |
| **Dev Experience** | Instant HMR (<100ms), ESM-native | Slower HMR, webpack/turbopack | React + Vite |
| **Build Speed** | 2-3x faster production builds | Slower, more complex build config | React + Vite |
| **Deployment** | Static SPA, any CDN/S3 | Requires Node.js server for SSR | React + Vite |
| **WebSocket Integration** | Simple, client-side only | Complex with SSR hydration | React + Vite |
| **Learning Curve** | Simpler, pure React patterns | Framework-specific conventions | React + Vite |
| **Bundle Size** | Minimal, tree-shaking optimized | Larger due to framework overhead | React + Vite |

**Conclusion**: This application is a **real-time, WebSocket-heavy SPA** with no SEO requirements (internal tool). React + Vite provides:
- Fastest development experience
- Simpler deployment (static files only)
- Better performance for WebSocket-heavy apps
- Lower infrastructure complexity

#### Why Vite 7?

```javascript
// vite.config.js - Optimized Configuration
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  plugins: [
    react({
      // Fast Refresh for instant updates
      fastRefresh: true,
      // Automatic JSX runtime
      jsxRuntime: 'automatic',
    }),
    // Brotli compression for production
    compression({ algorithm: 'brotliCompress' })
  ],

  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', 'yjs'],
          'vendor-state': ['zustand', '@tanstack/react-query'],
        }
      }
    },
    // Source maps for debugging
    sourcemap: true,
    // Minify with esbuild (faster than terser)
    minify: 'esbuild',
  },

  server: {
    // Hot reload port
    port: 3000,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      }
    }
  },

  // Environment variable prefix
  envPrefix: 'VITE_',
})
```

### 1.2 Complete Frontend Stack

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| **Framework** | React | 18.x | Industry standard, mature ecosystem |
| **Build Tool** | Vite | 7.x | Fastest HMR, optimized builds |
| **Language** | TypeScript | 5.x | Type safety, better DX |
| **Routing** | React Router | 6.x | Standard SPA routing, code splitting |
| **UI Framework** | Tailwind CSS | 3.x | Utility-first, fast development |
| **Component Library** | shadcn/ui | Latest | Accessible, customizable, Radix-based |
| **State Management** | Zustand | 4.x | Minimal boilerplate, intuitive API |
| **Async State** | React Query | 5.x | Caching, invalidation, optimistic updates |
| **Forms** | React Hook Form | 7.x | Performance, minimal re-renders |
| **Validation** | Zod | 3.x | Type-safe schema validation |
| **WebSocket** | Socket.io-client | 4.x | Reconnection, fallback, room management |
| **Editor** | TipTap | 2.x | Extensible, ProseMirror-based |
| **Collaboration** | Y.js | 13.x | CRDT for real-time sync |
| **File Upload** | react-dropzone | 14.x | Drag-and-drop, validation |
| **HTTP Client** | Axios | 1.x | Interceptors, request cancellation |

### 1.3 Project Structure

```
frontend/
├── public/                      # Static assets
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root component
│   ├── router/                 # Route configurations
│   │   └── index.tsx
│   ├── pages/                  # Page components
│   │   ├── Dashboard/
│   │   ├── Chat/
│   │   ├── Editor/
│   │   └── Admin/
│   ├── components/             # Reusable components
│   │   ├── ui/                # shadcn/ui components
│   │   ├── chat/
│   │   ├── editor/
│   │   └── common/
│   ├── features/               # Feature-based modules
│   │   ├── auth/
│   │   ├── quotes/
│   │   ├── projects/
│   │   └── upload/
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API service layer
│   │   ├── api.ts             # Axios instance
│   │   ├── auth.service.ts
│   │   ├── quote.service.ts
│   │   └── upload.service.ts
│   ├── stores/                 # Zustand stores
│   │   ├── auth.store.ts
│   │   └── editor.store.ts
│   ├── types/                  # TypeScript types
│   ├── utils/                  # Helper functions
│   └── styles/                 # Global styles
├── .env.development
├── .env.production
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

### 1.4 File Upload Component Example

```typescript
// src/components/upload/FileUploader.tsx
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Image, X } from 'lucide-react'
import { uploadService } from '@/services/upload.service'
import { useToast } from '@/hooks/use-toast'

interface FileWithPreview extends File {
  preview?: string
}

export const FileUploader = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Add preview URLs for images
    const filesWithPreview = acceptedFiles.map(file =>
      Object.assign(file, {
        preview: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined
      })
    )

    setFiles(prev => [...prev, ...filesWithPreview])

    // Upload files
    setUploading(true)
    try {
      const uploadPromises = acceptedFiles.map(file =>
        uploadService.uploadFile(file, {
          projectId: currentProjectId,
          category: 'requirements'
        })
      )

      await Promise.all(uploadPromises)

      toast({
        title: 'Success',
        description: `${acceptedFiles.length} file(s) uploaded successfully`
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB limit
    maxFiles: 5
  })

  const removeFile = (index: number) => {
    setFiles(prev => {
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
              or click to select files (max 10MB each)
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
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 1.5 API Service Layer

```typescript
// src/services/upload.service.ts
import { apiClient } from './api'

export interface UploadMetadata {
  projectId: string
  category: 'requirements' | 'reference' | 'export'
  description?: string
}

export interface FileUploadResponse {
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
    metadata: UploadMetadata
  ): Promise<FileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', metadata.projectId)
    formData.append('category', metadata.category)
    if (metadata.description) {
      formData.append('description', metadata.description)
    }

    const response = await apiClient.post<FileUploadResponse>(
      '/api/v1/files/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 100)
          )
          // Emit progress event for UI updates
          window.dispatchEvent(
            new CustomEvent('upload-progress', {
              detail: { filename: file.name, progress: percentCompleted }
            })
          )
        }
      }
    )

    return response.data
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await apiClient.get(`/api/v1/files/${fileId}/download`, {
      responseType: 'blob'
    })
    return response.data
  }

  async deleteFile(fileId: string): Promise<void> {
    await apiClient.delete(`/api/v1/files/${fileId}`)
  }

  async getFileUrl(fileId: string): Promise<string> {
    const response = await apiClient.get<{ url: string }>(
      `/api/v1/files/${fileId}/url`
    )
    return response.data.url
  }
}

export const uploadService = new UploadService()
```

---

## 2. Backend Technology Stack

### 2.1 FastAPI Rationale

| Feature | FastAPI | Flask | Django | Winner |
|---------|---------|-------|--------|--------|
| Async Support | Native (ASGI) | Limited | ASGI via channels | FastAPI |
| Performance | High (Starlette) | Medium | Medium | FastAPI |
| Type Safety | Pydantic models | Manual | Django ORM | FastAPI |
| API Documentation | Auto-generated | Manual | DRF required | FastAPI |
| WebSocket Support | Native | Flask-SocketIO | Channels | FastAPI |
| Learning Curve | Moderate | Easy | Steep | FastAPI |
| Async DB Queries | Native | Limited | Django ORM | FastAPI |

### 2.2 Complete Backend Stack

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| **Framework** | FastAPI | 0.128+ | Async, type hints, auto docs |
| **Language** | Python | 3.11+ | Performance, type hints |
| **ASGI Server** | Uvicorn | 0.30+ | High-performance ASGI |
| **ORM** | SQLAlchemy | 2.0+ | Mature, async support |
| **Migrations** | Alembic | 1.13+ | Database version control |
| **Validation** | Pydantic | 2.x | Type-safe data validation |
| **WebSocket** | Socket.io | 5.x | Room management, reconnection |
| **Task Queue** | Celery | 5.x | Distributed task processing |
| **Message Broker** | Redis | 7.x | In-memory speed |
| **HTTP Client** | httpx | 0.27+ | Async HTTP requests |
| **AI Framework** | LangGraph | 0.2+ | Stateful AI workflows |
| **Testing** | pytest + pytest-asyncio | Latest | Async test support |

### 2.3 Project Structure

```
backend/
├── alembic/                    # Database migrations
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI app entry point
│   ├── config.py              # Configuration management
│   ├── dependencies.py        # Dependency injection
│   ├── api/                   # API routes
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── projects.py
│   │   │   ├── quotes.py
│   │   │   ├── files.py       # File upload/download endpoints
│   │   │   └── chat.py
│   ├── core/                  # Core business logic
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   └── middleware.py
│   ├── services/              # Service layer (business logic)
│   │   ├── auth_service.py
│   │   ├── quote_service.py
│   │   ├── storage/           # Storage abstraction
│   │   │   ├── __init__.py
│   │   │   ├── interface.py   # Abstract base class
│   │   │   ├── database.py    # DB storage implementation
│   │   │   ├── s3.py          # S3 storage implementation
│   │   │   └── factory.py     # Storage factory
│   │   └── ai/
│   │       ├── langgraph_workflow.py
│   │       └── rag_service.py
│   ├── models/                # SQLAlchemy models
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── quote.py
│   │   └── file_upload.py
│   ├── schemas/               # Pydantic schemas
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── quote.py
│   │   └── file.py
│   ├── repositories/          # Data access layer
│   │   ├── user_repository.py
│   │   └── file_repository.py
│   └── utils/                 # Utility functions
├── tests/
├── .env
├── requirements.txt
├── pyproject.toml
└── Dockerfile
```

---

## 3. File Storage Abstraction Design

### 3.1 Architecture Pattern: Repository + Strategy

The storage abstraction uses a combination of **Repository Pattern** (data access) and **Strategy Pattern** (pluggable storage backends).

```
+---------------------------------------------------------------+
|                    Application Layer                          |
|  (API Routes, Service Layer)                                  |
+---------------------------------------------------------------+
                            |
                            | Depends on abstraction
                            v
+---------------------------------------------------------------+
|               FileStorageInterface (ABC)                      |
|  - upload(file, metadata) -> FileRecord                       |
|  - download(file_id) -> StreamingResponse                     |
|  - delete(file_id) -> bool                                    |
|  - get_download_url(file_id, expires_in) -> str               |
+---------------------------------------------------------------+
                            |
                            | Implemented by
              +-------------+-------------+
              |                           |
+-------------v------------+  +-----------v-----------+
| DatabaseStorageProvider  |  | S3StorageProvider     |
|                          |  |                       |
| - PostgreSQL bytea       |  | - AWS S3 bucket       |
| - Base64 for data URLs   |  | - Presigned URLs      |
| - Synchronous I/O        |  | - Async boto3         |
| - 10MB limit             |  | - Multipart upload    |
+--------------------------+  +-----------------------+
```

### 3.2 Code Implementation

#### 3.2.1 Storage Interface (Abstract Base Class)

```python
# app/services/storage/interface.py
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional
from datetime import datetime
from pydantic import BaseModel

class FileMetadata(BaseModel):
    """Metadata for file uploads"""
    filename: str
    content_type: str
    file_size_bytes: int
    uploaded_by: str  # User ID
    project_id: Optional[str] = None
    category: str = 'general'  # 'requirements', 'reference', 'export'
    description: Optional[str] = None

class FileRecord(BaseModel):
    """Stored file record"""
    id: str
    filename: str
    content_type: str
    file_size_bytes: int
    storage_provider: str  # 'database' or 's3'
    storage_key: str  # DB: blob_id, S3: s3://bucket/key
    uploaded_by: str
    project_id: Optional[str]
    created_at: datetime
    metadata: dict

class FileStorageInterface(ABC):
    """
    Abstract interface for file storage operations.

    Implementations must provide:
    - Database storage (MVP): stores files in PostgreSQL bytea
    - S3 storage (Production): stores files in AWS S3
    """

    @abstractmethod
    async def upload(
        self,
        file: BinaryIO,
        metadata: FileMetadata
    ) -> FileRecord:
        """
        Upload a file to storage.

        Args:
            file: File object (binary stream)
            metadata: File metadata (filename, content_type, etc.)

        Returns:
            FileRecord with storage details

        Raises:
            StorageException: If upload fails
            FileSizeExceeded: If file exceeds size limit
        """
        pass

    @abstractmethod
    async def download(self, file_id: str) -> bytes:
        """
        Download file contents.

        Args:
            file_id: Unique file identifier

        Returns:
            File contents as bytes

        Raises:
            FileNotFoundError: If file doesn't exist
            StorageException: If download fails
        """
        pass

    @abstractmethod
    async def delete(self, file_id: str) -> bool:
        """
        Delete a file from storage.

        Args:
            file_id: Unique file identifier

        Returns:
            True if deleted, False if not found

        Raises:
            StorageException: If deletion fails
        """
        pass

    @abstractmethod
    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        Get a download URL for the file.

        For DB storage: Returns a data URL (base64 encoded)
        For S3 storage: Returns a presigned URL

        Args:
            file_id: Unique file identifier
            expires_in: URL expiration time in seconds (default: 1 hour)

        Returns:
            Download URL (data URL or presigned URL)

        Raises:
            FileNotFoundError: If file doesn't exist
        """
        pass

    @abstractmethod
    def get_max_file_size(self) -> int:
        """
        Get maximum file size limit in bytes.

        Returns:
            Maximum file size in bytes
        """
        pass
```

#### 3.2.2 Database Storage Implementation

```python
# app/services/storage/database.py
import base64
from typing import BinaryIO
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete
from app.services.storage.interface import (
    FileStorageInterface,
    FileMetadata,
    FileRecord
)
from app.models.file_upload import FileUpload, FileBlob
from app.core.exceptions import StorageException, FileSizeExceeded

class DatabaseStorageProvider(FileStorageInterface):
    """
    PostgreSQL-based file storage implementation.

    Stores file content in bytea column, suitable for MVP/development.
    Advantages:
    - Simple deployment (no external dependencies)
    - Transactional consistency
    - No additional infrastructure cost

    Limitations:
    - 10MB file size limit (prevent DB bloat)
    - Higher memory usage for large files
    - Not suitable for high-volume production
    """

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def upload(
        self,
        file: BinaryIO,
        metadata: FileMetadata
    ) -> FileRecord:
        """Upload file to PostgreSQL bytea column"""

        # Read file contents
        file_contents = await file.read()

        # Validate file size
        if len(file_contents) > self.MAX_FILE_SIZE:
            raise FileSizeExceeded(
                f"File size {len(file_contents)} exceeds maximum "
                f"{self.MAX_FILE_SIZE} bytes"
            )

        try:
            # Create file upload record
            file_upload = FileUpload(
                filename=metadata.filename,
                content_type=metadata.content_type,
                file_size_bytes=metadata.file_size_bytes,
                storage_provider='database',
                storage_key='',  # Will be updated with blob_id
                uploaded_by=metadata.uploaded_by,
                project_id=metadata.project_id,
                metadata={
                    'category': metadata.category,
                    'description': metadata.description
                }
            )

            self.db.add(file_upload)
            await self.db.flush()  # Get file_upload.id

            # Create blob record
            file_blob = FileBlob(
                file_upload_id=file_upload.id,
                blob_data=file_contents
            )

            self.db.add(file_blob)

            # Update storage_key to reference blob
            file_upload.storage_key = f"blob:{file_blob.id}"

            await self.db.commit()
            await self.db.refresh(file_upload)

            return FileRecord(
                id=str(file_upload.id),
                filename=file_upload.filename,
                content_type=file_upload.content_type,
                file_size_bytes=file_upload.file_size_bytes,
                storage_provider='database',
                storage_key=file_upload.storage_key,
                uploaded_by=file_upload.uploaded_by,
                project_id=file_upload.project_id,
                created_at=file_upload.created_at,
                metadata=file_upload.metadata or {}
            )

        except Exception as e:
            await self.db.rollback()
            raise StorageException(f"Failed to upload file: {str(e)}")

    async def download(self, file_id: str) -> bytes:
        """Download file from database"""

        # Get file upload record
        result = await self.db.execute(
            select(FileUpload).where(FileUpload.id == file_id)
        )
        file_upload = result.scalar_one_or_none()

        if not file_upload:
            raise FileNotFoundError(f"File {file_id} not found")

        # Get blob
        result = await self.db.execute(
            select(FileBlob).where(FileBlob.file_upload_id == file_id)
        )
        file_blob = result.scalar_one_or_none()

        if not file_blob:
            raise StorageException(f"File blob for {file_id} not found")

        return bytes(file_blob.blob_data)

    async def delete(self, file_id: str) -> bool:
        """Delete file from database"""

        try:
            # Delete file upload (cascade deletes blob)
            result = await self.db.execute(
                sql_delete(FileUpload).where(FileUpload.id == file_id)
            )
            await self.db.commit()

            return result.rowcount > 0

        except Exception as e:
            await self.db.rollback()
            raise StorageException(f"Failed to delete file: {str(e)}")

    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600
    ) -> str:
        """
        Get data URL for database-stored file.

        Returns a base64-encoded data URL since file is in database.
        """

        # Get file upload record
        result = await self.db.execute(
            select(FileUpload).where(FileUpload.id == file_id)
        )
        file_upload = result.scalar_one_or_none()

        if not file_upload:
            raise FileNotFoundError(f"File {file_id} not found")

        # Get blob
        result = await self.db.execute(
            select(FileBlob).where(FileBlob.file_upload_id == file_id)
        )
        file_blob = result.scalar_one_or_none()

        if not file_blob:
            raise StorageException(f"File blob for {file_id} not found")

        # Create data URL
        blob_data = bytes(file_blob.blob_data)
        base64_data = base64.b64encode(blob_data).decode('utf-8')

        return f"data:{file_upload.content_type};base64,{base64_data}"

    def get_max_file_size(self) -> int:
        """Return maximum file size for database storage"""
        return self.MAX_FILE_SIZE
```

#### 3.2.3 S3 Storage Implementation

```python
# app/services/storage/s3.py
import boto3
from botocore.exceptions import ClientError
from typing import BinaryIO
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete
from app.services.storage.interface import (
    FileStorageInterface,
    FileMetadata,
    FileRecord
)
from app.models.file_upload import FileUpload
from app.core.exceptions import StorageException, FileSizeExceeded
from app.config import settings

class S3StorageProvider(FileStorageInterface):
    """
    AWS S3-based file storage implementation.

    Stores files in S3, suitable for production.
    Advantages:
    - Scales to unlimited storage
    - 100MB file size limit
    - Cost-effective for large files
    - CDN integration via CloudFront

    Features:
    - Multipart upload for large files
    - Presigned URLs for secure downloads
    - Lifecycle policies for cost optimization
    """

    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.S3_BUCKET_NAME

    def _generate_s3_key(
        self,
        file_id: str,
        filename: str,
        category: str
    ) -> str:
        """Generate S3 object key with organized structure"""

        # Structure: uploads/{category}/{year}/{month}/{file_id}/{filename}
        now = datetime.utcnow()
        return f"uploads/{category}/{now.year}/{now.month:02d}/{file_id}/{filename}"

    async def upload(
        self,
        file: BinaryIO,
        metadata: FileMetadata
    ) -> FileRecord:
        """Upload file to S3"""

        # Read file contents
        file_contents = await file.read()

        # Validate file size
        if len(file_contents) > self.MAX_FILE_SIZE:
            raise FileSizeExceeded(
                f"File size {len(file_contents)} exceeds maximum "
                f"{self.MAX_FILE_SIZE} bytes"
            )

        try:
            # Create file upload record (get ID first)
            file_upload = FileUpload(
                filename=metadata.filename,
                content_type=metadata.content_type,
                file_size_bytes=metadata.file_size_bytes,
                storage_provider='s3',
                storage_key='',  # Will be updated
                uploaded_by=metadata.uploaded_by,
                project_id=metadata.project_id,
                metadata={
                    'category': metadata.category,
                    'description': metadata.description
                }
            )

            self.db.add(file_upload)
            await self.db.flush()  # Get file_upload.id

            # Generate S3 key
            s3_key = self._generate_s3_key(
                str(file_upload.id),
                metadata.filename,
                metadata.category
            )

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_contents,
                ContentType=metadata.content_type,
                Metadata={
                    'uploaded_by': metadata.uploaded_by,
                    'project_id': metadata.project_id or '',
                    'original_filename': metadata.filename
                }
            )

            # Update storage_key
            file_upload.storage_key = f"s3://{self.bucket_name}/{s3_key}"

            await self.db.commit()
            await self.db.refresh(file_upload)

            return FileRecord(
                id=str(file_upload.id),
                filename=file_upload.filename,
                content_type=file_upload.content_type,
                file_size_bytes=file_upload.file_size_bytes,
                storage_provider='s3',
                storage_key=file_upload.storage_key,
                uploaded_by=file_upload.uploaded_by,
                project_id=file_upload.project_id,
                created_at=file_upload.created_at,
                metadata=file_upload.metadata or {}
            )

        except ClientError as e:
            await self.db.rollback()
            raise StorageException(f"S3 upload failed: {str(e)}")
        except Exception as e:
            await self.db.rollback()
            raise StorageException(f"Failed to upload file: {str(e)}")

    async def download(self, file_id: str) -> bytes:
        """Download file from S3"""

        # Get file upload record
        result = await self.db.execute(
            select(FileUpload).where(FileUpload.id == file_id)
        )
        file_upload = result.scalar_one_or_none()

        if not file_upload:
            raise FileNotFoundError(f"File {file_id} not found")

        # Extract S3 key from storage_key (s3://bucket/key)
        s3_key = file_upload.storage_key.replace(f"s3://{self.bucket_name}/", "")

        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return response['Body'].read()

        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"File {file_id} not found in S3")
            raise StorageException(f"S3 download failed: {str(e)}")

    async def delete(self, file_id: str) -> bool:
        """Delete file from S3 and database"""

        try:
            # Get file upload record
            result = await self.db.execute(
                select(FileUpload).where(FileUpload.id == file_id)
            )
            file_upload = result.scalar_one_or_none()

            if not file_upload:
                return False

            # Extract S3 key
            s3_key = file_upload.storage_key.replace(
                f"s3://{self.bucket_name}/", ""
            )

            # Delete from S3
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )

            # Delete from database
            await self.db.execute(
                sql_delete(FileUpload).where(FileUpload.id == file_id)
            )
            await self.db.commit()

            return True

        except Exception as e:
            await self.db.rollback()
            raise StorageException(f"Failed to delete file: {str(e)}")

    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600
    ) -> str:
        """Generate presigned URL for S3 file download"""

        # Get file upload record
        result = await self.db.execute(
            select(FileUpload).where(FileUpload.id == file_id)
        )
        file_upload = result.scalar_one_or_none()

        if not file_upload:
            raise FileNotFoundError(f"File {file_id} not found")

        # Extract S3 key
        s3_key = file_upload.storage_key.replace(f"s3://{self.bucket_name}/", "")

        try:
            # Generate presigned URL
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ResponseContentDisposition': f'attachment; filename="{file_upload.filename}"'
                },
                ExpiresIn=expires_in
            )
            return url

        except ClientError as e:
            raise StorageException(f"Failed to generate presigned URL: {str(e)}")

    def get_max_file_size(self) -> int:
        """Return maximum file size for S3 storage"""
        return self.MAX_FILE_SIZE
```

#### 3.2.4 Storage Factory

```python
# app/services/storage/factory.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.storage.interface import FileStorageInterface
from app.services.storage.database import DatabaseStorageProvider
from app.services.storage.s3 import S3StorageProvider
from app.config import settings

class StorageFactory:
    """
    Factory for creating storage provider instances.

    Configuration is driven by STORAGE_PROVIDER environment variable:
    - 'database': Use PostgreSQL bytea storage (MVP)
    - 's3': Use AWS S3 storage (Production)
    """

    @staticmethod
    def create(db_session: AsyncSession) -> FileStorageInterface:
        """
        Create storage provider based on configuration.

        Args:
            db_session: Database session for metadata storage

        Returns:
            FileStorageInterface implementation

        Raises:
            ValueError: If unknown storage provider configured
        """
        provider = settings.STORAGE_PROVIDER.lower()

        if provider == 'database':
            return DatabaseStorageProvider(db_session)
        elif provider == 's3':
            return S3StorageProvider(db_session)
        else:
            raise ValueError(
                f"Unknown storage provider: {provider}. "
                f"Must be 'database' or 's3'"
            )
```

#### 3.2.5 FastAPI Endpoint Integration

```python
# app/api/v1/files.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.dependencies import get_db, get_current_user
from app.services.storage.factory import StorageFactory
from app.services.storage.interface import FileMetadata, FileRecord
from app.core.exceptions import FileSizeExceeded
from app.schemas.user import User

router = APIRouter(prefix="/files", tags=["files"])

@router.post("/upload", response_model=FileRecord)
async def upload_file(
    file: UploadFile = File(...),
    project_id: str = None,
    category: str = "general",
    description: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file to storage.

    Automatically uses configured storage provider (DB or S3).
    """

    # Create storage provider
    storage = StorageFactory.create(db)

    # Validate file size against provider limit
    file_size = 0
    chunks = []
    while chunk := await file.read(8192):  # Read in 8KB chunks
        chunks.append(chunk)
        file_size += len(chunk)

        if file_size > storage.get_max_file_size():
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum {storage.get_max_file_size()} bytes"
            )

    # Reconstruct file
    file_contents = b''.join(chunks)

    # Create metadata
    metadata = FileMetadata(
        filename=file.filename,
        content_type=file.content_type,
        file_size_bytes=file_size,
        uploaded_by=str(current_user.id),
        project_id=project_id,
        category=category,
        description=description
    )

    # Upload file
    try:
        # Create a file-like object from bytes
        from io import BytesIO
        file_obj = BytesIO(file_contents)

        record = await storage.upload(file_obj, metadata)
        return record

    except FileSizeExceeded as e:
        raise HTTPException(status_code=413, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download a file.

    Returns file contents directly from storage.
    """

    storage = StorageFactory.create(db)

    try:
        file_contents = await storage.download(file_id)

        # Get file metadata for headers
        from sqlalchemy import select
        from app.models.file_upload import FileUpload

        result = await db.execute(
            select(FileUpload).where(FileUpload.id == file_id)
        )
        file_upload = result.scalar_one_or_none()

        if not file_upload:
            raise HTTPException(status_code=404, detail="File not found")

        return StreamingResponse(
            iter([file_contents]),
            media_type=file_upload.content_type,
            headers={
                'Content-Disposition': f'attachment; filename="{file_upload.filename}"'
            }
        )

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}/url")
async def get_file_url(
    file_id: str,
    expires_in: int = 3600,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a download URL for a file.

    - For DB storage: Returns data URL (base64)
    - For S3 storage: Returns presigned URL
    """

    storage = StorageFactory.create(db)

    try:
        url = await storage.get_download_url(file_id, expires_in)
        return {"url": url}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a file from storage.
    """

    storage = StorageFactory.create(db)

    try:
        deleted = await storage.delete(file_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="File not found")

        return {"message": "File deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 3.3 Configuration Management

```python
# app/config.py
from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # Storage Configuration
    STORAGE_PROVIDER: Literal['database', 's3'] = 'database'

    # AWS S3 Configuration (only needed if STORAGE_PROVIDER=s3)
    AWS_ACCESS_KEY_ID: str = ''
    AWS_SECRET_ACCESS_KEY: str = ''
    AWS_REGION: str = 'us-east-1'
    S3_BUCKET_NAME: str = ''

    # Database Configuration
    DATABASE_URL: str

    # Other settings...

    class Config:
        env_file = '.env'

settings = Settings()
```

### 3.4 Database Models

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
    storage_provider = Column(String(20), nullable=False)  # 'database' or 's3'
    storage_key = Column(String, nullable=False)  # 'blob:uuid' or 's3://bucket/key'
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

---

## 4. Database and Caching

### 4.1 PostgreSQL with pgvector

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vector embeddings table for knowledge base
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,  -- 'quote', 'plugin_doc', 'guideline'
    source_id UUID NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL,  -- OpenAI text-embedding-3-small
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create HNSW index for fast vector search
CREATE INDEX ON knowledge_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 4.2 Redis Caching Strategy

| Use Case | TTL | Pattern |
|----------|-----|---------|
| User sessions | 7 days | `session:{user_id}` |
| Rate limiting | 60 seconds | `ratelimit:{ip}:{endpoint}` |
| WebSocket rooms | Connection lifetime | `ws:room:{quote_id}` |
| LLM response cache | 24 hours | `llm:cache:{hash(prompt)}` |
| Knowledge base cache | 1 hour | `kb:search:{hash(query)}` |

---

## 5. AI/LLM Infrastructure

### 5.1 LangGraph Workflow

```python
# app/services/ai/langgraph_workflow.py
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from typing import TypedDict, List, Dict

class QuoteState(TypedDict):
    messages: List[Dict]
    requirements: Dict
    research_results: Dict
    quote_draft: str
    needs_clarification: bool
    feedback: Dict

def create_quote_workflow():
    workflow = StateGraph(QuoteState)

    # Add nodes
    workflow.add_node("extract_requirements", extract_requirements_node)
    workflow.add_node("check_clarity", clarity_check_node)
    workflow.add_node("ask_clarification", ask_clarification_node)
    workflow.add_node("rag_search", knowledge_base_search_node)
    workflow.add_node("research_plugins", plugin_research_node)
    workflow.add_node("generate_quote", quote_generation_node)

    # Add edges
    workflow.set_entry_point("extract_requirements")
    workflow.add_edge("extract_requirements", "check_clarity")
    workflow.add_conditional_edges(
        "check_clarity",
        lambda state: "ask_clarification" if state["needs_clarification"] else "rag_search"
    )
    workflow.add_edge("ask_clarification", END)
    workflow.add_edge("rag_search", "research_plugins")
    workflow.add_edge("research_plugins", "generate_quote")
    workflow.add_edge("generate_quote", END)

    # Compile with checkpointing
    checkpointer = PostgresSaver(connection_string=settings.DATABASE_URL)
    return workflow.compile(checkpointer=checkpointer)
```

---

## 6. DevOps and Deployment

### 6.1 Docker Configuration

#### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 6.2 Docker Compose (Development)

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
      - VITE_WS_URL=ws://localhost:8000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/quote_assistant
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_PROVIDER=database  # or 's3' for production
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    depends_on:
      - db
      - redis

  db:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=quote_assistant
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.celery_app worker --loglevel=info
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/quote_assistant
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_PROVIDER=database
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

## 7. Migration Strategies

### 7.1 Database to S3 Migration Plan

#### Phase 1: Enable Dual-Write Mode

```python
# app/services/storage/dual_write.py
class DualWriteStorageProvider(FileStorageInterface):
    """
    Transition provider that writes to both DB and S3.
    Reads from DB but validates S3 copy exists.
    """

    def __init__(self, db_session: AsyncSession):
        self.db_provider = DatabaseStorageProvider(db_session)
        self.s3_provider = S3StorageProvider(db_session)

    async def upload(self, file: BinaryIO, metadata: FileMetadata) -> FileRecord:
        # Write to DB (primary)
        db_record = await self.db_provider.upload(file, metadata)

        # Write to S3 (shadow write)
        try:
            await file.seek(0)  # Reset file pointer
            s3_record = await self.s3_provider.upload(file, metadata)

            # Log successful shadow write
            logger.info(f"Shadow write to S3 successful: {s3_record.id}")
        except Exception as e:
            # Log but don't fail upload
            logger.error(f"Shadow write to S3 failed: {str(e)}")

        return db_record
```

#### Phase 2: Background Migration Job

```python
# app/services/storage/migration.py
from celery import Task
from sqlalchemy import select
from app.models.file_upload import FileUpload, FileBlob

@celery.task(bind=True, max_retries=3)
def migrate_file_to_s3(self: Task, file_id: str):
    """
    Migrate a single file from database to S3.

    Args:
        file_id: File upload ID to migrate
    """

    async def _migrate():
        async with AsyncSession() as db:
            # Get file upload record
            result = await db.execute(
                select(FileUpload).where(
                    FileUpload.id == file_id,
                    FileUpload.storage_provider == 'database'
                )
            )
            file_upload = result.scalar_one_or_none()

            if not file_upload:
                logger.warning(f"File {file_id} not found or already migrated")
                return

            # Get blob
            result = await db.execute(
                select(FileBlob).where(FileBlob.file_upload_id == file_id)
            )
            file_blob = result.scalar_one_or_none()

            if not file_blob:
                logger.error(f"Blob for file {file_id} not found")
                return

            # Upload to S3
            s3_provider = S3StorageProvider(db)

            from io import BytesIO
            file_obj = BytesIO(bytes(file_blob.blob_data))

            metadata = FileMetadata(
                filename=file_upload.filename,
                content_type=file_upload.content_type,
                file_size_bytes=file_upload.file_size_bytes,
                uploaded_by=str(file_upload.uploaded_by),
                project_id=str(file_upload.project_id) if file_upload.project_id else None,
                category=file_upload.metadata.get('category', 'general'),
                description=file_upload.metadata.get('description')
            )

            s3_record = await s3_provider.upload(file_obj, metadata)

            # Update file_upload record
            file_upload.storage_provider = 's3'
            file_upload.storage_key = s3_record.storage_key

            await db.commit()

            # Delete blob from database (optional, can keep for rollback)
            # await db.execute(delete(FileBlob).where(FileBlob.id == file_blob.id))
            # await db.commit()

            logger.info(f"Successfully migrated file {file_id} to S3")

    # Run async function
    import asyncio
    asyncio.run(_migrate())


@celery.task
def migrate_all_files_to_s3():
    """
    Batch migration task for all database-stored files.
    """

    async def _get_file_ids():
        async with AsyncSession() as db:
            result = await db.execute(
                select(FileUpload.id).where(
                    FileUpload.storage_provider == 'database'
                )
            )
            return [str(row[0]) for row in result.fetchall()]

    # Get all file IDs
    import asyncio
    file_ids = asyncio.run(_get_file_ids())

    logger.info(f"Starting migration of {len(file_ids)} files to S3")

    # Queue migration tasks (rate-limited)
    for file_id in file_ids:
        migrate_file_to_s3.apply_async(args=[file_id], countdown=1)
```

#### Phase 3: Switch to S3 Primary

```bash
# Update environment variable
export STORAGE_PROVIDER=s3

# Restart services
docker-compose restart backend
```

### 7.2 Migration Timeline

| Week | Activity | Deliverable |
|------|----------|-------------|
| 1 | Deploy dual-write provider | All new uploads go to both DB and S3 |
| 2 | Run migration job for existing files | All files copied to S3 |
| 3 | Validate S3 copies | Integrity checks, download tests |
| 4 | Switch to S3 primary | Update STORAGE_PROVIDER=s3 |
| 5 | Monitor and optimize | Performance tuning, cost analysis |
| 6 | Remove DB blobs (optional) | Clean up blob_data column |

---

## Summary

This technical stack provides:

1. **Modern Frontend**: React + Vite for fastest development experience
2. **Async Backend**: FastAPI with full async support for WebSocket and AI workflows
3. **Flexible Storage**: Abstraction layer enabling zero-downtime migration from DB to S3
4. **Scalable AI**: LangGraph for complex, stateful AI workflows
5. **Production-Ready**: Docker-first deployment with clear migration paths

The architecture enables:
- **Fast MVP deployment** (database storage, simple Docker Compose)
- **Seamless scaling** (switch to S3, add ECS Fargate)
- **Zero code changes** when migrating storage backends
- **Clear separation of concerns** between frontend and backend teams

All sub-agents (frontend-developer, backend-developer) have clear interfaces and implementation patterns to follow.
