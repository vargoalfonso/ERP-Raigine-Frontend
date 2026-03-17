# MRP / ERP Frontend

Next.js (App Router) frontend for the MRP/ERP UI.

## Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm (or any compatible package manager)

## Setup

Install dependencies:

```bash
npm install
```

## Environment Variables

This app expects an API base URL:

- `NEXT_PUBLIC_API_URL` (required) — used as the base URL for API requests.

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Adjust the URL to match your backend.

Note: some deployments mount the backend behind a reverse proxy at `/api`.

- If your backend is reachable at `http://HOST/api/...`, you may set `NEXT_PUBLIC_API_URL` to `http://HOST/api`.
- If your backend is reachable at `http://HOST/...` and routes already include `/api/...`, set `NEXT_PUBLIC_API_URL` to `http://HOST`.

This frontend normalizes the URL to avoid accidental `/api/api/...` requests.

Optional (recommended for production): keep the debug smoke-test page disabled.

```bash
# Enable /api-smoke route (debug only)
ENABLE_API_SMOKE=false

# Block common crawlers/bots (recommended)
BLOCK_BOTS=true
```

If your backend expects a different login identifier field (e.g. `username` instead of `email`), set:

```bash
NEXT_PUBLIC_AUTH_LOGIN_FIELD=username
```

## Run (Development)

```bash
npm run dev
```

Open http://localhost:3000

## Build & Run (Production)

```bash
npm run build
npm run start
```

## Troubleshooting

- If you see network/API errors, verify `NEXT_PUBLIC_API_URL` is set correctly.
- If login or authorized pages redirect unexpectedly, clear site cookies and try again.
