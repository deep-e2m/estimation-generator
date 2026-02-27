# Docker Setup for Quote Generation Assistant

This document explains how to run the Quote Generation Assistant using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start (Development)

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Start all services:**
   ```bash
   docker compose up
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Services Overview

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | React/Vite development server with hot-reload |
| backend | 8000 | FastAPI application with auto-reload |
| db | 5432 | PostgreSQL 16 database |
| redis | 6379 | Redis 7 cache |
| migrations | - | One-time Alembic migrations runner |

## Development Workflow

### Starting Services

```bash
# Start all services (foreground)
docker compose up

# Start in background
docker compose up -d

# Start specific services
docker compose up frontend backend

# Rebuild containers after Dockerfile changes
docker compose up --build
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Running Commands in Containers

```bash
# Backend shell
docker compose exec backend bash

# Run Python commands
docker compose exec backend python -c "print('Hello')"

# Run tests
docker compose exec backend pytest

# Run Alembic migrations manually
docker compose exec backend alembic upgrade head

# Create new migration
docker compose exec backend alembic revision --autogenerate -m "description"
```

### Database Operations

```bash
# Connect to PostgreSQL
docker compose exec db psql -U postgres -d quote_assistant

# Backup database
docker compose exec db pg_dump -U postgres quote_assistant > backup.sql

# Restore database
cat backup.sql | docker compose exec -T db psql -U postgres quote_assistant
```

### Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v

# Stop and remove everything including images
docker compose down --rmi all -v
```

## Production Deployment

For production, use the production compose override:

```bash
# Build and start in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Production Differences

- Frontend uses nginx to serve static files
- Backend runs with multiple workers (no hot-reload)
- Database and Redis ports are not exposed
- Resource limits are enforced
- Debug mode is disabled

### Production Configuration

Update `.env` with production values:

```bash
DEBUG=false
ENVIRONMENT=production
SECRET_KEY=<your-secure-32-char-key>
POSTGRES_PASSWORD=<strong-password>
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs <service-name>

# Check container status
docker compose ps

# Restart specific service
docker compose restart <service-name>
```

### Database connection issues

```bash
# Verify database is healthy
docker compose exec db pg_isready -U postgres

# Check database logs
docker compose logs db
```

### Backend reload crashes (WatchFiles / spawn)

If the backend exits with a traceback in `SpawnProcess` / `subprocess_started` when files change, reload in Docker may be flaky on your setup. You can disable reload and restart the backend when needed:

```bash
# One-off run without reload
docker compose run --rm -p 8000:8000 backend uvicorn app.main:app --host 0.0.0.0 --port 8000

# Or add a compose override: docker-compose.override.yml with backend command without --reload
```

For day-to-day backend dev with reload, run the backend locally (`cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`) and use Docker only for DB/Redis/frontend.

### Hot-reload not working

For macOS/Windows, file watching may need polling:

The vite.config.ts is already configured with:
```javascript
watch: {
  usePolling: true,
  interval: 1000,
}
```

### Permission issues

If you encounter permission issues with mounted volumes:

```bash
# On Linux, you may need to match container user ID
sudo chown -R 1000:1000 ./backend ./frontend
```

### Port already in use

```bash
# Change ports in .env file
FRONTEND_PORT=3001
BACKEND_PORT=8001
POSTGRES_PORT=5433
REDIS_PORT=6380
```

## Architecture

```
                     +-------------+
                     |   Browser   |
                     +------+------+
                            |
                    +-------v-------+
                    |   Frontend    |
                    | (Vite/React)  |
                    |   :3000       |
                    +-------+-------+
                            |
                    +-------v-------+
                    |    Backend    |
                    |   (FastAPI)   |
                    |    :8000      |
                    +---+-------+---+
                        |       |
              +---------+       +---------+
              |                           |
      +-------v-------+           +-------v-------+
      |  PostgreSQL   |           |     Redis     |
      |    :5432      |           |    :6379      |
      +---------------+           +---------------+
```

## Volumes

| Volume | Purpose |
|--------|---------|
| postgres_data | PostgreSQL database files |
| redis_data | Redis persistence |

## Network

All services communicate on the `estimation-network` bridge network.
Services can reach each other using their service names as hostnames:
- `frontend` -> `backend:8000`
- `backend` -> `db:5432`
- `backend` -> `redis:6379`
