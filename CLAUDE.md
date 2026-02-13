# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Estimate AI is a full-stack monorepo application for generating project estimates/quotes using AI. The system uses FastAPI (Python) for the backend and React + TypeScript + Vite for the frontend, orchestrated via Docker Compose.

## Development Commands

### Initial Setup

```bash
# Quick setup (installs git hooks and dependencies)
./scripts/setup.sh

# Or manually install git hooks (REQUIRED)
./scripts/install-hooks.sh
```

**CRITICAL**: Git hooks MUST be installed before committing. They prevent AI co-authorship from appearing in commits. CI will reject pushes containing AI attribution.

### Running the Application

```bash
# Start all services with Docker (recommended)
docker-compose up -d

# Backend only (local development)
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend only (local development)
cd frontend
npm run dev
```

### Backend Development

```bash
# Setup local environment
cd backend
./setup_dev.sh
source .venv/bin/activate

# Run tests
pytest

# Run specific test file
pytest tests/test_auth.py

# Run with coverage
pytest --cov=app

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic current
alembic history
alembic downgrade -1
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm preview
```

## Architecture Essentials

### Backend Structure (FastAPI)

The backend follows a **three-layer separation**:

1. **`backend/app/models/`** - SQLAlchemy ORM models (database schema)
2. **`backend/app/schemas/`** - Pydantic models (API request/response validation)
3. **`backend/app/api/v1/`** - FastAPI route handlers (HTTP endpoints)

Files with the same name (e.g., `project.py`) exist in each layer with different purposes. This is intentional and follows FastAPI best practices.

**Database Migrations**: Located in `backend/alembic/versions/` with naming convention `YYYYMMDD_NNNNNN_description.py`. Always use Alembic for schema changes.

### Frontend Structure (React/TypeScript)

**Two Quote Services** (intentionally separate):

1. **`frontend/src/services/quote-generation.service.ts`** (class-based)
   - Real-time quote generation with progress tracking
   - Streaming updates, cancellation support
   - Direct PDF/DOCX export downloads
   - Used by: EstimateChat, ExportDialog

2. **`frontend/src/services/quotes.service.ts`** (function-based)
   - Quote CRUD operations, list/fetch/update/delete
   - React Query integration
   - Status management (finalize, archive)
   - Feedback and export job monitoring
   - Used by: useQuotes hook, quote list views

See `frontend/src/services/README.md` for detailed service architecture rationale.

**Barrel Exports**: `index.ts` files throughout the codebase re-export components for cleaner imports. This is standard TypeScript practice, not duplication.

### State Management

- **Backend**: SQLAlchemy ORM + JWT tokens for auth
- **Frontend**:
  - React Query for server state (caching, fetching)
  - Zustand for client state (auth store)
  - React hooks for component state

### API Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "pagination": { ... }  // Optional
}
```

## Key Design Patterns

### Python `__init__.py` Files

Multiple `__init__.py` files are required for Python packages. They are not empty duplicates—they define package boundaries and can contain package-level imports.

### TypeScript Barrel Exports

Multiple `index.ts` files re-export modules for cleaner imports:

```typescript
// ✅ Enabled by index.ts
import { Button, Input } from '@/components/ui';

// ❌ Without barrel exports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
```

### Monorepo Benefits

- Shared types between frontend/backend
- Atomic full-stack commits
- Simplified dependency management
- Unified Docker deployment

## Environment Configuration

Copy `.env.example` to `.env` and configure:

**Required for AI features**:
- `OPENROUTER_API_KEY` - Get from https://openrouter.ai/keys

**Database** (auto-configured in Docker):
- `DATABASE_URL` - PostgreSQL with pgvector extension
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**Authentication**:
- `SECRET_KEY` - JWT signing (must be 32+ chars in production)

**See `.env.example` for complete configuration options**

## AI Integration (OpenRouter)

- Quote generation uses OpenRouter API for multiple AI models
- Supports streaming responses for real-time updates
- RAG (Retrieval-Augmented Generation) with pgvector for context
- Configuration in `.env`: temperature, max tokens, timeout

## Docker Services

```bash
# View running services
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild specific service
docker-compose up -d --build backend

# Stop all services
docker-compose down

# Reset everything (WARNING: deletes data)
docker-compose down -v
```

**Services**:
- `frontend` - React app (port 3000)
- `backend` - FastAPI (port 8000)
- `db` - PostgreSQL with pgvector (port 5432)
- `redis` - Cache (port 6379)
- `celery-worker` - Background tasks
- `migrations` - One-time migration runner

## Git Workflow

### Commit Requirements

**NEVER skip git hooks**. They are configured to:
- Block AI co-authorship (Co-authored-by: Claude, etc.)
- Auto-strip AI attribution from commit messages

CI/CD will reject pushes with AI attribution.

### Branches

- `main` - Production branch
- `dev` - Development branch (default for PRs)
- Feature branches follow `dev-<feature-name>`

## Testing

### Backend Tests

Located in `backend/tests/`:
- `conftest.py` - Pytest fixtures
- `test_*.py` - Test modules

Run with `pytest` from backend directory.

### Frontend Tests

Currently minimal. Use component-level testing when adding features.

## Common Patterns to Recognize

### Two Services for Different Purposes

If you see two similar services (like quote services), check if they serve different architectural needs:
- Class-based for stateful operations (streaming, progress)
- Function-based for stateless queries (React Query integration)

### Models vs Schemas vs APIs

When you see `project.py` in multiple directories:
- `models/project.py` = Database table definition
- `schemas/project.py` = API validation rules
- `api/v1/project.py` = HTTP route handlers

This is **separation of concerns**, not duplication.

### API Client Configuration

Frontend API client (`frontend/src/services/api.ts`):
- Uses Vite proxy in development (relative URLs)
- Includes auth token interceptors
- Handles error responses uniformly

## Troubleshooting

### "AI co-authorship detected" error
```bash
./scripts/install-hooks.sh
git commit --amend  # Remove Co-authored-by line
```

### Frontend can't connect to backend
- Check `VITE_API_URL` in `.env`
- Verify backend is running: `docker-compose ps backend`
- Check CORS in `backend/app/main.py`

### Database migration conflicts
```bash
cd backend
alembic downgrade -1  # Rollback one migration
alembic upgrade head  # Reapply
```

### Docker containers won't start
```bash
docker-compose down -v  # Reset volumes (WARNING: deletes data)
docker-compose up -d
```

## Important Files

- `ARCHITECTURE.md` - Detailed architectural documentation
- `README.md` - Quick start and setup guide
- `frontend/src/services/README.md` - Services architecture
- `.env.example` - Environment configuration template
- `specs/` - Feature specs and implementation plans
- `docker-compose.yml` - Service orchestration

## Development Philosophy

- **Type Safety**: TypeScript in frontend, Pydantic in backend
- **API-First**: Define contracts (schemas) before implementation
- **Separation of Concerns**: Models, schemas, and APIs are distinct layers
- **Docker-First**: Primary development environment is Docker Compose
- **Git Hooks Required**: Code quality gates enforced at commit time
