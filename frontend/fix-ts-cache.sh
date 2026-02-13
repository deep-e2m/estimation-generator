#!/bin/bash

echo "🔧 Fixing TypeScript Cache Issues..."
echo ""

# Kill any running TypeScript servers
echo "1. Killing TypeScript language server processes..."
pkill -f "tsserver" 2>/dev/null || true
sleep 1

# Clear all TypeScript caches
echo "2. Clearing TypeScript build caches..."
rm -rf node_modules/.tmp
rm -rf node_modules/.cache
rm -rf node_modules/.vite
rm -rf .turbo
rm -rf dist
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Touch all UI component files to force reload
echo "3. Touching UI component files to force reload..."
cd src/components/ui
touch *.tsx
cd ../../..

echo ""
echo "✅ Cache cleared! Now please:"
echo "   1. In Cursor, press Cmd+Shift+P"
echo "   2. Type 'TypeScript: Restart TS Server'"
echo "   3. Or press Cmd+Shift+P and type 'Developer: Reload Window'"
echo ""
