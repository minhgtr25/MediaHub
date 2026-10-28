# MediaHub

MediaHub is a React, TypeScript and Vite frontend with an Express and TypeScript API. Supabase provides PostgreSQL, authentication and storage.

## Start locally

Use Node.js 24, configure `.env` from `.env.example`, install both app dependencies, then start the API and frontend from the repository root:

```powershell
npm ci --prefix backend --ignore-scripts
npm ci --prefix frontend --ignore-scripts
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` to the API on port `5000`. If port 5173 is occupied, Vite selects the next available port. The API port comes from `PORT` (default `5000`). If a healthy MediaHub API is already running there, the dev command reuses it; otherwise it starts the API. `Ctrl+C` stops processes started by this command. Keep service-role keys, database credentials and other private values out of `VITE_` variables.

## Common checks

Run these commands from the repository root:

```powershell
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run format:check
npm run build
```

## Documentation

See [the documentation index](docs/README.md) for setup, business workflows, architecture, design guidance and dated implementation records. SQL in `supabase/migrations/` is the source of truth for database changes; dated progress documents are evidence from their checkpoint, not a live database status check.
