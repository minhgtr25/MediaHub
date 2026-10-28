# MediaHub Frontend

The frontend is a React, TypeScript and Vite application. It uses Supabase Auth in the browser and sends application data requests to the Node API through `/api`.

## Local development

From the repository root, install both application packages and start the API and frontend:

```powershell
npm ci --prefix backend --ignore-scripts
npm ci --prefix frontend --ignore-scripts
npm run dev
```

The root command starts the API and Vite, reusing a healthy local MediaHub API when one is already running. For frontend-only work, `npm run dev --prefix frontend` starts Vite by itself.

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and, when needed, `VITE_API_BASE_URL` in the root `.env`. Only public browser settings belong in `VITE_` variables; never expose a service-role key.

## Source layout

- `src/pages/` contains public, auth, Admin, Customer, Creator and shared workspaces.
- `src/components/`, `src/layouts/` and `src/contexts/` contain shared UI, navigation and session/site state.
- `src/lib/` and `src/services/` hold API-facing helpers, permissions and client utilities.
- `src/styles.css` preserves cascade order by importing `styles/base.css`, `styles/shared-overrides.css`, `styles/system.css` and `styles/workflows.css`. `styles/brand.css` loads after those layers.

## Checks

Run these from the repository root:

```powershell
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Playwright intercepts Supabase Auth and API calls for deterministic browser tests. Those tests cover the login and registration interface and client state; use a non-production QA Supabase account to verify real credentials and email delivery. See [local setup and deployment](../docs/operations/deployment.md) and the [documentation index](../docs/README.md) for backend, database and workflow guidance.
