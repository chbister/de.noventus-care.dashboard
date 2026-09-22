# Base44 Dev Environment

## Project Overview
This is a **Base44 SDK** Vite + React frontend ("Noventus Care GmbH") that connects to a
hosted Base44 backend. It is NOT a standalone app — all data, auth, and business logic
live on the Base44 backend, accessed via the `@base44/sdk` client and the
`@base44/vite-plugin`.

## Required Credentials (external — user must provide)
- `VITE_BASE44_APP_ID` — the Base44 app ID (from the Base44 dashboard)
- `VITE_BASE44_APP_BASE_URL` — the Base44 backend URL (e.g., `https://your-app.base44.app`)

Without real values the Vite dev server starts but the app cannot authenticate or load data.
Placeholders live in `.env.base44-defaults`; real values are delivered via `/run/base44/app.env`.

## Running the app
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- Vite dev server runs on port 5173 inside the container, mapped to host port 3000.
- Live reload is enabled (Vite HMR).
- `npm install` runs automatically on container start.

## Architecture notes
- The `@base44/vite-plugin` proxies `/api` requests to the Base44 backend using
  `VITE_BASE44_APP_BASE_URL`, so the app uses a single-origin wiring (no separate API port).
- `serverUrl: ''` in `src/api/base44Client.js` means all API calls are relative — they go
  through the Vite dev server proxy.
- No legacy SDK imports are used (`BASE44_LEGACY_SDK_IMPORTS` is not needed).
- Auth is handled by `src/lib/AuthContext.jsx` which calls the Base44 backend's public-settings
  endpoint.

## Verifying it works
1. `docker compose -f docker-compose.base44.yml ps` — web service should be Up.
2. `curl -s http://localhost:3000` — should return the Vite HTML shell.
3. With real credentials, the app should load past the loading spinner and show the login/dashboard.
