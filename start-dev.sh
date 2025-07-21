#!/bin/bash

# Start both backend and frontend dev servers in parallel using concurrently

# Ensure we're in the project root
cd "$(dirname "$0")"

# Check if concurrently is installed, install if missing
if ! npx --no-install concurrently --version > /dev/null 2>&1; then
  echo "Installing concurrently..."
  npm install concurrently --save-dev
fi

# Run both dev servers
npx concurrently "cd backend && npm run dev" "cd frontend && npm run dev" 