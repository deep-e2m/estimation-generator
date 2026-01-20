#!/bin/bash
# =============================================================================
# Docker Start Script for Quote Generation Assistant
# =============================================================================
# This script helps you start the application with Docker Compose.
#
# Usage:
#   ./scripts/docker-start.sh          # Development mode
#   ./scripts/docker-start.sh --prod   # Production mode
#   ./scripts/docker-start.sh --build  # Rebuild containers
#   ./scripts/docker-start.sh --help   # Show help
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Default values
PRODUCTION=false
BUILD=false
DETACH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            PRODUCTION=true
            shift
            ;;
        --build)
            BUILD=true
            shift
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --prod, --production   Run in production mode"
            echo "  --build                Rebuild containers"
            echo "  -d, --detach           Run in background"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                     Start in development mode"
            echo "  $0 --prod              Start in production mode"
            echo "  $0 --build             Rebuild and start"
            echo "  $0 -d                  Start in background"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}.env file created. Please review and update with your settings.${NC}"
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Build compose command
COMPOSE_CMD="docker compose"

if [ "$PRODUCTION" = true ]; then
    echo -e "${BLUE}Starting in PRODUCTION mode...${NC}"
    COMPOSE_CMD="$COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml"
else
    echo -e "${BLUE}Starting in DEVELOPMENT mode...${NC}"
fi

# Add flags
COMPOSE_ARGS="up"

if [ "$BUILD" = true ]; then
    echo -e "${YELLOW}Rebuilding containers...${NC}"
    COMPOSE_ARGS="$COMPOSE_ARGS --build"
fi

if [ "$DETACH" = true ]; then
    COMPOSE_ARGS="$COMPOSE_ARGS -d"
fi

# Print info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Quote Generation Assistant${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
if [ "$PRODUCTION" = true ]; then
    echo -e "Mode:     ${YELLOW}Production${NC}"
    echo -e "Frontend: ${BLUE}http://localhost:80${NC}"
else
    echo -e "Mode:     ${YELLOW}Development${NC}"
    echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
fi
echo -e "Backend:  ${BLUE}http://localhost:8000${NC}"
echo -e "API Docs: ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo ""

# Run docker compose
echo -e "${BLUE}Running: $COMPOSE_CMD $COMPOSE_ARGS${NC}"
echo ""

$COMPOSE_CMD $COMPOSE_ARGS
