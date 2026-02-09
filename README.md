# MRP / ERP Frontend

Next.js (App Router) frontend for the MRP/ERP UI.

## Prerequisites


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

- [docs/api-ui-testing.md](docs/api-ui-testing.md) — UI-based API testing for integrated modules (Raw Materials / WIP / Finished Goods).
- [docs/system-settings-ui-testing.md](docs/system-settings-ui-testing.md) — UI-based API testing for System Settings routes.
