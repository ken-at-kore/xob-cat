#!/bin/bash
# Kill any process on port 3000 (frontend)
lsof -ti:3000 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true

# Start frontend in background with logging
nohup bash -c "cd frontend && npm run dev" > frontend.log 2>&1 &

# Wait for frontend to respond (timeout after ~30s)
echo "Starting frontend server, please wait..."
for i in {1..30}; do
  curl -sf http://localhost:3000 && break
  sleep 1
done

# Check if frontend is up
if curl -sf http://localhost:3000; then
  echo "✅ Frontend ready at http://localhost:3000"
else
  echo "❌ Frontend failed to start within timeout."
  echo "Frontend log last 10 lines:" && tail -10 frontend.log
fi
