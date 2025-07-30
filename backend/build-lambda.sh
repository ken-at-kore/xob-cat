#!/bin/bash
set -e

echo "🔧 Building Lambda deployment package..."

# Clean previous build
rm -rf dist

# Copy shared files to backend for compilation
echo "📂 Copying shared files..."
rm -rf src/shared
cp -r ../shared src/shared

# Build TypeScript
echo "🔨 Compiling TypeScript..."
npm run build

# Clean up temporary shared files
rm -rf src/shared

echo "✅ Lambda build complete!"