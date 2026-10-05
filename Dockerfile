# Multi-stage build for AeroTwin / Celestia (SIH26054)
# Stage 1: Build the React + TypeScript frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + SimEngine + Static frontend
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /app

# Install system dependencies (build-essential needed for some scientific packages if wheel not cached)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml and source code
COPY pyproject.toml ./
COPY simengine/ ./simengine/
COPY backend/ ./backend/

# Install the Python package and its backend dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e ".[backend]"

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 7860 8000

# Run uvicorn using shell form so $PORT is evaluated at runtime (compatible with HF Spaces, Render, Koyeb)
CMD uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-7860}
