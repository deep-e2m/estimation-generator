# Estimation Generator

A full-stack application for generating project estimates using AI.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd estimation-generator

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d
```

### Local Development Setup

**IMPORTANT: Run setup first to install git hooks**

```bash
# Quick setup (recommended)
./scripts/setup.sh

# Or manually:
./scripts/install-hooks.sh  # Install git hooks (required)

# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && ./setup_dev.sh
source .venv/bin/activate
uvicorn app.main:app --reload
```

## Developer Guidelines

### Git Hooks (Required)

This project uses git hooks to maintain code quality. **All developers must install hooks:**

```bash
./scripts/install-hooks.sh
```

This configures git to use hooks from `scripts/git-hooks/` which:
- Automatically strips AI co-authorship from commits
- Blocks commits containing AI tool attributions

**Note:** Hooks are also auto-installed when running:
- `npm install` in the frontend directory
- `./setup_dev.sh` in the backend directory
- `./scripts/setup.sh` from the root

### CI Protection

GitHub Actions will **reject pushes** containing AI co-authorship in commit messages. If your push is rejected:

1. Run `./scripts/install-hooks.sh` to prevent future issues
2. Rebase your commits to remove the Co-authored-by lines:
   ```bash
   git rebase -i HEAD~N  # Where N is the number of commits to edit
   ```

## Project Structure

```
├── backend/          # FastAPI backend
├── frontend/         # React + Vite frontend
├── docker-compose.yml
├── scripts/
│   ├── setup.sh           # Full project setup
│   ├── install-hooks.sh   # Git hooks installer
│   └── git-hooks/         # Shared git hooks
└── .github/workflows/     # CI/CD pipelines
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, React Query
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Redis, Celery
- **AI:** OpenRouter API (Claude models), RAG with pgvector
- **Infrastructure:** Docker, GitHub Actions