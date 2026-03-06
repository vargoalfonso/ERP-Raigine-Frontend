# MRP / ERP Frontend

Next.js (App Router) frontend for the MRP/ERP UI.

## Prerequisites

- Node.js `>= 18.18` (recommended: Node `20`)


## Setup

Install dependencies:

```bash
npm install
```

## Environment Variables

This app expects an API base URL:


Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Adjust the URL to match your backend.

Optional (recommended for production): keep the debug smoke-test page disabled.

```bash
# Enable /api-smoke route (debug only)
ENABLE_API_SMOKE=false

# Block common crawlers/bots (recommended)
BLOCK_BOTS=true
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


## Docs

- [docs/api-ui-testing.md](docs/api-ui-testing.md) — UI-based API testing + list of pages already connected to API.
- [docs/api-pages-endpoints-matrix.md](docs/api-pages-endpoints-matrix.md) — Endpoint ↔ page matrix (what can be tested where).
- [docs/system-settings-ui-testing.md](docs/system-settings-ui-testing.md) — UI-based API testing for System Settings routes.
