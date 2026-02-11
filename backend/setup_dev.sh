#!/bin/bash
# Development Environment Setup Script
# This script sets up a local Python virtual environment for development

set -e  # Exit on error

echo "=========================================="
echo "Setting up Development Environment"
echo "=========================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
echo "📦 Installing dependencies..."
.venv/bin/pip install --upgrade pip setuptools wheel > /dev/null
.venv/bin/pip install -r requirements.txt

# Install git hooks (prevents AI co-authorship)
echo "🔧 Installing git hooks..."
if [ -f "../scripts/install-hooks.sh" ]; then
    cd .. && ./scripts/install-hooks.sh && cd backend
    echo "✓ Git hooks installed"
else
    echo "⚠ Git hooks script not found (skipping)"
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Activate the virtual environment:"
echo "   source .venv/bin/activate"
echo ""
echo "2. Copy .env.example to .env and configure:"
echo "   cp .env.example .env"
echo ""
echo "3. Run migrations:"
echo "   alembic upgrade head"
echo ""
echo "4. Start the development server:"
echo "   uvicorn app.main:app --reload"
echo ""
echo "=========================================="
