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
