# Free & Easy Deployment Guide for AeroTwin / Celestia

This project is a full-stack digital twin application with:
- **FastAPI backend** (Python 3.12, physics simulation engine, REST API + live WebSocket `/ws/telemetry`).
- **React frontend** (Vite, React 19, Three.js 3D engine, Leaflet map, telemetry graphs).

Because the backend now automatically serves the built frontend (`frontend/dist`), **the entire app can be deployed as a single service for free with 0 configuration**.

---

## Option 1: Render.com (Recommended - Easiest 1-Click Free Setup)

Render offers a 100% free web service tier with custom domains, free SSL, and WebSocket support.

### Steps:
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Add production deployment configs"
   git push origin main
   ```
2. Go to [render.com](https://render.com) and sign in with GitHub.
3. Click **New +** > **Blueprint** (or **Web Service**).
4. Select your `uav-engine-twin` repository.
5. Render will automatically detect the [`render.yaml`](../render.yaml) file:
   - **Runtime**: Docker
   - **Instance Type**: Free
   - **Health Check**: `/api/health`
6. Click **Apply / Create Web Service**.
7. Wait 2–3 minutes for the build to finish. Your app will be live at `https://<your-service-name>.onrender.com`!

> **Note on Free Tier**: Render spins down free web services after 15 minutes of inactivity. When you visit the link again, it takes ~45 seconds to spin up.

---

## Option 2: Koyeb (100% Free Always-On Alternative)

Koyeb offers 1 free `nano` service that **does not sleep/spin down**:

### Steps:
1. Push code to GitHub.
2. Go to [koyeb.com](https://www.koyeb.com/) and sign up.
3. Click **Create Service** > **GitHub**.
4. Select your repository.
5. Choose **Dockerfile** as the build method.
6. Under **Ports**, set port to `8000` (HTTP).
7. Click **Deploy**.

---

## Option 3: Hugging Face Spaces (100% Free with 16GB RAM)

If you want high memory and CPU without sleep limits:
1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) and create a new Space.
2. Select **Space SDK**: **Docker** > **Blank**.
3. Clone the space repo or connect your GitHub repository.
4. Copy the project files (including [`Dockerfile`](../Dockerfile)).
5. Hugging Face builds and deploys your digital twin with free persistent hosting!

---

## Option 4: Split Deployment (Vercel Frontend + Render Backend)

If you prefer using Vercel for the frontend:
1. **Deploy Backend on Render**:
   - Create a Web Service for the repo.
   - Build Command: `pip install -e .[backend]`
   - Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - Copy the backend URL: e.g. `https://aerotwin-api.onrender.com`.
2. **Deploy Frontend on Vercel**:
   - Go to [vercel.com](https://vercel.com) and import the repo.
   - Set **Root Directory**: `frontend`.
   - Add Environment Variables:
     - `VITE_API_BASE_URL`: `https://aerotwin-api.onrender.com`
     - `VITE_WS_URL`: `wss://aerotwin-api.onrender.com/ws/telemetry`
   - Click **Deploy**.
