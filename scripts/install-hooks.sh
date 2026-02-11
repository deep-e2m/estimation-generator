#!/bin/bash
# =============================================================================
# Install Git Hooks
# =============================================================================
# This script configures git to use hooks that prevent AI co-authorship from
# appearing in your commits.
#
# Usage: ./scripts/install-hooks.sh
#
# Method: Uses git's core.hooksPath to point to scripts/git-hooks/ so hooks
# are automatically shared via the repository.
# =============================================================================

set -e

# Find repo root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

HOOKS_DIR="$REPO_ROOT/scripts/git-hooks"

# Verify hooks exist
if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ Error: Hooks directory not found at $HOOKS_DIR"
    exit 1
fi

echo "Installing git hooks..."

# Make hooks executable
chmod +x "$HOOKS_DIR"/* 2>/dev/null || true

# Configure git to use our hooks directory
git config core.hooksPath scripts/git-hooks

echo "  ✓ Git configured to use scripts/git-hooks/"
echo "  ✓ commit-msg hook (blocks AI co-authorship)"
echo "  ✓ prepare-commit-msg hook (auto-strips AI co-authorship)"
echo ""
echo "Git hooks installed successfully!"
echo "AI co-authorship will now be blocked/stripped from commits."
echo ""
echo "To verify: git config core.hooksPath"
