#!/bin/bash
# Kill any process on port 3001 (backend)
lsof -ti:3001 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true

# Start backend in background with logging
nohup bash -c "cd backend && npm run dev" > backend.log 2>&1 &

# Wait for backend to respond (timeout after ~30s)
echo "Starting backend server, please wait..."
for i in {1..30}; do
  curl -sf http://localhost:3001/health && break
  sleep 1
done

# Check if backend is up
if curl -sf http://localhost:3001/health; then
  echo "✅ Backend ready at http://localhost:3001"
else
  echo "❌ Backend failed to start within timeout."
  echo "Backend log last 10 lines:" && tail -10 backend.log
fi
