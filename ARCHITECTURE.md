# Architecture Documentation

## Project Overview

Estimate AI is a monorepo application for generating and managing project quotes using AI. The system uses FastAPI for the backend and React + TypeScript for the frontend, orchestrated via Docker Compose.

## Monorepo Structure

```
estimation-generator/
├── backend/              # FastAPI backend service
│   ├── alembic/         # Database migrations
│   ├── app/             # Application code
│   ├── tests/           # Backend tests
│   └── requirements.txt # Python dependencies
├── frontend/            # React + TypeScript frontend
│   ├── src/            # Source code
│   └── package.json    # Node dependencies
├── docker-compose.yml   # Service orchestration
└── .env                # Environment configuration
```

### Configuration Files

**Root Level:**
- `docker-compose.yml`, `docker-compose.prod.yml` - Service orchestration
- `.env`, `.env.example` - Environment variables (all services)
- `.gitignore` - Git ignore patterns

**Backend:**
- `backend/alembic.ini` - Database migration configuration
- `backend/alembic/` - Migration scripts and history
- `backend/requirements.txt` - Production dependencies
- `backend/requirements-dev.txt` - Development dependencies
- `backend/pyproject.toml` - Python project configuration

**Frontend:**
- `frontend/package.json` - Node dependencies and scripts
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/.prettierrc` - Code formatting rules

## Backend Architecture (Python/FastAPI)

### Directory Structure

```
backend/app/
├── api/
│   └── v1/              # API version 1 endpoints
│       ├── __init__.py
│       ├── auth.py      # Authentication routes
│       ├── projects.py  # Project management routes
│       ├── quotes.py    # Quote generation routes
│       ├── chat.py      # Chat interaction routes
│       └── clients.py   # Client management routes
├── models/              # SQLAlchemy database models
│   ├── __init__.py
│   ├── user.py
│   ├── project.py
│   ├── quote.py
│   ├── client.py
│   ├── document.py
│   └── chat_message.py
├── schemas/             # Pydantic request/response schemas
│   ├── __init__.py
│   ├── auth.py
│   ├── project.py
│   ├── quote.py
│   └── client.py
├── services/            # Business logic (future)
├── config.py            # Application configuration
└── main.py              # FastAPI application entry
```

### Pattern: Models, Schemas, and APIs

Files with the same name (e.g., `project.py`) exist in multiple directories with different purposes:

1. **`models/project.py`** - SQLAlchemy ORM model (database representation)
   ```python
   class Project(Base):
       __tablename__ = "projects"
       id = Column(UUID, primary_key=True)
       # Database fields and relationships
   ```

2. **`schemas/project.py`** - Pydantic schemas (request/response validation)
   ```python
   class ProjectCreate(BaseModel):
       name: str
       platform: str
       # Validation rules
   ```

3. **`api/v1/project.py`** - FastAPI route handlers (HTTP endpoints)
   ```python
   @router.post("/projects")
   async def create_project(data: ProjectCreate):
       # Route handler logic
   ```

This separation of concerns is intentional and follows FastAPI best practices.

## Frontend Architecture (React/TypeScript)

### Directory Structure

```
frontend/src/
├── components/          # React components
│   ├── common/         # Shared components (ErrorBoundary, etc.)
│   ├── editor/         # Quote editor components
│   ├── estimate/       # Estimate-related components
│   ├── layout/         # Layout components
│   ├── project/        # Project management components
│   └── ui/             # UI primitives (Button, Input, etc.)
├── pages/              # Route page components
│   ├── Dashboard.tsx
│   ├── NewProject.tsx
│   ├── NewQuote.tsx
│   └── QuoteEdit.tsx
├── services/           # API client services
│   ├── api.ts          # Base API client
│   ├── quote.service.ts    # Quote generation (class-based)
│   ├── quotes.service.ts   # Quote queries (function-based)
│   └── client.service.ts   # Client management
├── hooks/              # Custom React hooks
│   ├── useQuotes.ts
│   └── useProjectForm.ts
├── store/              # Zustand state management
│   └── authStore.ts
├── types/              # TypeScript type definitions
│   ├── quote.types.ts
│   ├── project.ts
│   └── client.ts
├── App.tsx             # Main app component with routing
└── main.tsx            # Application entry point
```

### Pattern: Barrel Exports (index.ts)

Multiple `index.ts` files exist throughout the frontend to re-export components and utilities. This is a standard pattern for cleaner imports:

```typescript
// components/ui/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Dropdown } from './Dropdown';
```

**This allows:**
```typescript
// ✅ Clean imports
import { Button, Input, Dropdown } from '@/components/ui';

// ❌ Instead of
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/dropdown';
```

### Services Architecture

The frontend has **two quote services** with distinct purposes:

**`quote-generation.service.ts`** - Class-based quote generation
- Real-time progress tracking
- Quote generation with streaming updates
- Direct export downloads (PDF, DOCX)
- Used by: EstimateChat, ExportDialog

**`quotes.service.ts`** - Function-based quote queries
- React Query integration
- CRUD operations (list, get, update, delete)
- Status management (finalize, archive)
- Feedback and export job management
- Used by: useQuotes hook, quote list views

See `frontend/src/services/README.md` for detailed service documentation.

## Database Architecture

### Technology Stack
- **PostgreSQL** with **pgvector** extension
- Hosted via Docker Compose
- Migrations managed by Alembic

### Migration System

Migrations are stored in `backend/alembic/versions/` with naming convention:
```
YYYYMMDD_NNNNNN_description.py
```

Examples:
- `20260210_000001_add_additional_instructions_to_projects.py`
- `20260210_000002_restrict_platform_to_wordpress_only.py`
- `20260210_000003_add_clients_table.py`

**Commands:**
```bash
# Apply migrations
cd backend
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# View migration history
alembic history

# Check current version
alembic current
```

## State Management

### Backend
- **SQLAlchemy ORM** for database state
- **Pydantic** for request/response validation
- **JWT tokens** for authentication state

### Frontend
- **React Query** for server state (caching, fetching)
- **Zustand** for client state (authentication, UI state)
- **React hooks** for component state

## Authentication Flow

1. User logs in via `/api/v1/auth/login`
2. Backend returns JWT access token
3. Frontend stores token in Zustand store (`authStore`)
4. API client includes token in `Authorization` header
5. Backend validates token on protected routes

## AI Integration

### Quote Generation
- Uses OpenRouter API for AI model access
- Supports multiple models (configured in backend)
- Generates structured quotes with:
  - Scope and requirements analysis
  - Deliverables breakdown
  - Time estimates (hours)
  - Cost calculations
  - Assumptions and risks

### Chat Interface
- Interactive quote refinement
- Real-time streaming responses
- Context-aware suggestions

## Common Patterns

### Python Packages (`__init__.py`)

Multiple `__init__.py` files are required for Python packages. These files can be empty or contain package-level imports:

```python
# backend/app/models/__init__.py
from .user import User
from .project import Project
from .quote import Quote
```

### TypeScript Barrel Exports (`index.ts`)

As described above, `index.ts` files re-export components for cleaner imports. This is a standard TypeScript/JavaScript pattern.

### API Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "pagination": { ... }  // Optional, for paginated responses
}
```

## Migration History

### January 2026 - Project Reorganization

**Context:** The codebase was refactored from a monolithic structure to a cleaner microservices-oriented layout.

**Changes:**
- ✅ Moved Alembic from root to `backend/`
- ✅ Consolidated `docker-compose.yml` to root
- ✅ Consolidated environment templates to root
- ✅ Moved `frontend/src/lib/api.ts` to `frontend/src/services/api.ts`
- ✅ Refactored `auth.service.ts` into Zustand store (`authStore.ts`)
- ✅ Simplified routing from `router/index.tsx` to `App.tsx`

**Rationale:**
- Clearer separation between frontend and backend
- Better alignment with monorepo best practices
- Reduced configuration duplication
- Simplified deployment and development workflow

### February 2026 - Client Management & Platform Restrictions

**Changes:**
- ✅ Added `clients` table and API
- ✅ Restricted platform field to WordPress only (per business requirements)
- ✅ Added `additional_instructions` field to projects

## Development Workflow

### Starting the Application

```bash
# Start all services
docker-compose up -d

# Backend only (with hot reload)
cd backend
python -m uvicorn app.main:app --reload

# Frontend only (with hot reload)
cd frontend
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests (if configured)
cd frontend
npm test
```

### Creating Migrations

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Deployment

### Production Build

```bash
# Build frontend
cd frontend
npm run build

# Frontend assets will be in frontend/dist/

# Backend runs via Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

Required environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing
- `OPENROUTER_API_KEY` - API key for AI model access
- `FRONTEND_URL` - Frontend application URL
- `BACKEND_URL` - Backend API URL

## Key Design Decisions

### Why Two Quote Services?

The frontend has two quote service files because they serve different architectural needs:

1. **Generation requires state** - Class-based service with abort controllers and progress callbacks
2. **Querying is stateless** - Function-based service optimized for React Query
3. **Performance** - Separate concerns allow targeted optimization

See `frontend/src/services/README.md` for full rationale.

### Why Separate Models, Schemas, and APIs?

This separation follows the **Single Responsibility Principle**:

1. **Models** - Represent database structure (SQLAlchemy ORM)
2. **Schemas** - Define API contracts (Pydantic validation)
3. **APIs** - Handle HTTP routing (FastAPI routes)

This allows:
- Database changes without affecting API contracts
- API validation without database dependencies
- Clear boundaries between layers

### Why Monorepo?

Benefits:
- Shared types and contracts between frontend/backend
- Atomic commits across full stack
- Simplified dependency management
- Easier deployment orchestration

Trade-offs:
- Larger repository size
- Requires Docker for local development
- More complex CI/CD setup

## Troubleshooting

### Common Issues

**Alembic migrations fail:**
```bash
# Reset migrations (development only!)
alembic downgrade base
alembic upgrade head
```

**Frontend can't connect to backend:**
- Check `VITE_API_BASE_URL` in `.env`
- Verify backend is running on correct port
- Check CORS configuration in `backend/app/main.py`

**Database connection errors:**
- Verify PostgreSQL container is running: `docker-compose ps`
- Check `DATABASE_URL` in `.env`
- Ensure pgvector extension is installed

## Future Improvements

- [ ] Add end-to-end tests (Playwright)
- [ ] Implement WebSocket support for real-time updates
- [ ] Add background job processing (Celery/Redis)
- [ ] Implement quote template system
- [ ] Add multi-language support
- [ ] Improve export customization options

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

---

Last Updated: 2026-02-10
