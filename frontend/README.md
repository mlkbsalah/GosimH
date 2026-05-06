# SecondLife — Frontend

Next.js 16 app for Slaï, the AI appliance diagnosis assistant. Users upload appliance photos, describe the problem, and receive a verdict: DIY repair guide, local repair shops, or smart replacement options.

---

## Architecture

```
/src/app/
  page.tsx              — Landing page (hero, how-it-works, solutions)
  diagnostic/page.tsx   — 4-screen diagnostic flow (capture → details → thinking → result)
  api/
    identify/route.ts   — Proxy: POST → FastAPI :8000/api/identify
    diagnose/route.ts   — Proxy: POST → FastAPI :8000/api/diagnose
    health/route.ts     — Proxy: GET  → FastAPI :8000/api/health
/src/components/
  brand.tsx             — SlaiAvatar and WordmarkSecondlife SVG components
  icons.tsx             — Icon set used across the app
```

The frontend does **no AI work itself** — it proxies all requests to the Python FastAPI backend. See `backend/README.md` for the backend setup.

---

## Requirements

Node.js 18+, npm 9+

---

## Environment variables

Create a `.env.local` file in `frontend/`:

```ini
# Optional — defaults to http://localhost:8000 if not set
BACKEND_URL=http://localhost:8000
```

---

## Launching the application

### Option 1 — Frontend only (backend must already be running)

```bash
cd GosimH/frontend
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

### Option 2 — Frontend + backend together (recommended)

This starts both servers with a single command from the frontend directory:

```bash
cd GosimH/frontend
npm install
npm run dev:all
```

Output is color-coded: **cyan** = Next.js dev server, **yellow** = FastAPI backend.

Before running `dev:all`, make sure the Python backend dependencies are installed and the `.env` file in `backend/` is configured. See `backend/README.md`.

---

## User flow

| Screen | What happens |
|---|---|
| **Capture** | User uploads up to 4 photos and/or types a description, then submits |
| **Details** | User selects location, appliance age, repair budget, and available tools |
| **Thinking** | App calls `/api/identify` (vision), then `/api/diagnose` (agents) — progress steps animate while waiting |
| **Result** | Verdict card + path-specific content: DIY step-by-step guide, nearby repair shops, or replacement models |

---

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run dev:backend` | Start FastAPI backend on port 8000 |
| `npm run dev:all` | Start both frontend and backend concurrently |
| `npm run build` | Production build |
| `npm run start` | Start production server (requires `build` first) |
| `npm run lint` | Run ESLint |

---

## Tech stack

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.x | Framework (App Router) |
| `react` | 19.x | UI |
| `tailwindcss` | 4.x | Styling |
| `typescript` | 5.x | Type safety |
| `concurrently` | 9.x | Run frontend + backend in one terminal |
