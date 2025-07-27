#!/bin/bash
# Kill any running dev servers on known ports
lsof -ti:3000 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true && lsof -ti:3001 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true

# Start frontend and backend in background, with nohup to detach from terminal
nohup bash -c "cd frontend && npm run dev" > frontend.log 2>&1 &
nohup bash -c "cd backend && npm run dev"  > backend.log 2>&1 &

# Wait for both servers to respond (timeout after ~30s)
echo "Starting servers, please wait..."
for i in {1..30}; do
  curl -sf http://localhost:3000 && curl -sf http://localhost:8000 && break
  sleep 1
done

# Check if servers are up, then output result
if curl -sf http://localhost:3000 && curl -sf http://localhost:8000; then
  echo "✅ Servers ready (frontend: http://localhost:3000, backend: http://localhost:8000)"
else
  echo "❌ Server failed to start within timeout."
  echo "Frontend log last 10 lines:" && tail -10 frontend.log
  echo "Backend log last 10 lines:"  && tail -10 backend.log
fi
