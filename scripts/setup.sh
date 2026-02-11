#!/bin/bash
# =============================================================================
# Project Setup Script
# =============================================================================
# Quick setup for new developers. Run this after cloning the repository.
#
# Usage: ./scripts/setup.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

echo "=========================================="
echo "Project Setup"
echo "=========================================="
echo ""

# 1. Install git hooks
echo "📌 Step 1: Installing git hooks..."
./scripts/install-hooks.sh
echo ""

# 2. Frontend setup
echo "📌 Step 2: Setting up frontend..."
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    cd frontend
    if command -v npm &> /dev/null; then
        npm install
        echo "✓ Frontend dependencies installed"
    else
        echo "⚠ npm not found - skipping frontend setup"
    fi
    cd "$REPO_ROOT"
else
    echo "⚠ Frontend directory not found"
fi
echo ""

# 3. Backend setup
echo "📌 Step 3: Setting up backend..."
if [ -d "backend" ] && [ -f "backend/setup_dev.sh" ]; then
    cd backend
    ./setup_dev.sh
    cd "$REPO_ROOT"
else
    echo "⚠ Backend setup script not found"
fi
echo ""

# 4. Environment files
echo "📌 Step 4: Checking environment files..."
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✓ Created .env from .env.example"
    echo "  ⚠ Please configure your .env file with proper values"
else
    echo "✓ Environment file exists"
fi
echo ""

echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Quick start:"
echo "  docker-compose up -d    # Start all services"
echo ""
echo "Or manually:"
echo "  cd frontend && npm run dev"
echo "  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo ""
