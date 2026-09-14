#!/usr/bin/env bash
# Starts AeroTwin / Celestia (SIH26054) end to end: sets up the Python venv
# and frontend node_modules if missing, then runs the FastAPI backend and
# the Vite dev server together. Ctrl+C stops both.
#
# Usage:
#   ./start.sh
#   BACKEND_PORT=8001 FRONTEND_PORT=5174 ./start.sh   # override default ports

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo "=================================================="
echo " AeroTwin / Celestia (SIH26054)"
echo "=================================================="

# --- sanity checks -----------------------------------------------------
if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 not found on PATH." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "error: node/npm not found on PATH (needed for the frontend)." >&2
  exit 1
fi

# --- 1. Python environment ----------------------------------------------
if [ ! -d ".venv" ]; then
  echo "==> No .venv found - creating one..."
  if command -v uv >/dev/null 2>&1; then
    uv venv .venv
  else
    python3 -m venv .venv
  fi
fi

PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

if ! "$PYTHON_BIN" -c "import fastapi, uvicorn, simengine" >/dev/null 2>&1; then
  echo "==> Installing Python dependencies (simengine + backend)..."
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python .venv -e ".[dev,backend]"
  else
    "$PYTHON_BIN" -m pip install -e ".[dev,backend]"
  fi
fi

# --- 2. Frontend dependencies --------------------------------------------
if [ ! -d "frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies (npm install)..."
  (cd frontend && npm install)
fi

# --- 3. run backend + frontend together, clean up on exit ---------------
PIDS=()

cleanup() {
  echo ""
  echo "==> Shutting down..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  wait >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "==> Starting backend on http://${BACKEND_HOST}:${BACKEND_PORT}"
"$PYTHON_BIN" -m uvicorn backend.app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
PIDS+=("$!")

echo -n "==> Waiting for backend health check"
backend_up=false
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://${BACKEND_HOST}:${BACKEND_PORT}/api/health"; then
    backend_up=true
    break
  fi
  echo -n "."
  sleep 1
done
echo ""
if [ "$backend_up" != true ]; then
  echo "error: backend did not become healthy in time - check the output above." >&2
  exit 1
fi
echo "==> Backend is up."

echo "==> Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}"
(
  cd frontend
  VITE_API_BASE_URL="http://${BACKEND_HOST}:${BACKEND_PORT}" \
  VITE_WS_URL="ws://${BACKEND_HOST}:${BACKEND_PORT}/ws/telemetry" \
    npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) &
PIDS+=("$!")

echo ""
echo "=================================================="
echo " Backend:   http://${BACKEND_HOST}:${BACKEND_PORT}  (docs at /docs)"
echo " Frontend:  http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo " Press Ctrl+C to stop both."
echo "=================================================="

wait
