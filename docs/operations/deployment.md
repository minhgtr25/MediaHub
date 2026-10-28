# Setup and deployment

The backend uses Supabase JS for application queries and tracked SQL migrations for schema changes. Apply and verify changes with `npm run db:migrate --prefix backend` and `npm run db:check --prefix backend`.

## Local development

Use Node.js 24. Copy `.env.example` to `.env` and fill the Supabase settings. Never place a service-role key, database connection string or private credential in a `VITE_` variable.

```powershell
npm ci --prefix backend --ignore-scripts
npm ci --prefix frontend --ignore-scripts
npm run dev
```

Vite serves `http://localhost:5173` and proxies `/api` to the backend on port 5000; if port 5173 is occupied, Vite selects the next available port. The API port comes from `PORT` (default `5000`). If a healthy MediaHub API is already running there, the dev command reuses it; otherwise it starts the API. `Ctrl+C` stops processes started by this command. Without `VITE_API_BASE_URL`, the browser uses `/api`. The backend reads injected environment variables first, then `backend/.env`, then root `.env`.

## Database

For a new Supabase project, apply SQL migrations `001_mediahub.sql`, `002_workflow.sql`, and `003_reporting.sql` once through the Supabase SQL editor. For an existing installation, inspect the schema first; do not replay baseline migrations.

Set `DIRECT_URL` to the database owner connection for administrative scripts, then run:

```powershell
npm run db:check --prefix backend
npm run db:migrate --prefix backend
```

`db:check` verifies applied migration checksums and validates all 18 workflow suites in a transaction, then rolls everything back. `db:migrate` applies pending migrations 004–044 with an advisory lock and checksum ledger. Before commit, it runs the same suites in a savepoint and rolls back synthetic test data. Previously applied SQL files must not be edited. The runner skips unchanged applied migrations. For a current catalog and dependency summary, use `npm run db:audit --prefix backend`; see the [Supabase schema audit](../architecture/supabase-schema-audit.md) for the recorded table and field decisions.

Migration 043 records a no-op when no demo service rows exist (for a new project) or when all matching rows are already inactive. It refuses partial or unclassified demo data. Migration 044 removes only unchanged deterministic legacy seed rows and refuses modified rows or unexpected dependencies.

The order, payment, contract, production and variation workflows are described in [business-flow](../business/business-flow.md), [production workflow](../business/production-workflow.md) and the corresponding migration files. Database suites use rollback-only fixtures; they do not persist test users, customers, invoices or service records.

## First administrator

Register and verify the intended account using Supabase Auth. An authorized database operator then selects that specific email:

```powershell
npm run build --prefix backend
node backend/scripts/bootstrap-admin.mjs --email you@example.com
```

This only works when there is no active administrator. Later role changes use `/admin/users`, which prevents removing the last administrator or disabling your own administrator access. No password is stored or displayed by the application.

## Publish actual website content

Use the admin UI to create services, portfolio entries, partners and process steps. Mark records active/published; mark selected services/portfolio entries featured for the homepage. Empty datasets intentionally show empty states. No fake customers, revenue, testimonials or project statistics are seeded.

Under `/admin/settings`, add and publish these keys:

| Key               | Use                                              |
| ----------------- | ------------------------------------------------ |
| `hero`            | Homepage headline, supporting text and image     |
| `about`           | Company introduction, vision, mission and values |
| `privacy`         | Approved privacy policy                          |
| `terms`           | Approved terms                                   |
| `company_name`    | Company name in the content field                |
| `company_email`   | Public email in the content field                |
| `company_phone`   | Public telephone in the content field            |
| `company_address` | Public address in the content field              |

Website settings are public editorial content when published. Never store credentials there. Company/legal copy needs the business owner's review before publication.

## Workflow

Visitors submit public contact enquiries with optional private PDF/image attachments. Service-request entry requires active CUSTOMER/BUSINESS and preserves selected service/package/creator through login. `/customer/requests/new` creates a separate request and commercial conversation atomically; it creates no project/order or payment obligation. Staff sees reduced queue summaries, then claims a request to view its brief, converse, record private notes, transfer/release or change consultation status. Admin oversees requests and manages service packages; each submitted brief preserves its package snapshot. Creator proposals, quote versions, accepted-order snapshots and versioned contract acknowledgment are implemented. New-order manual payment requests and immutable Admin-verified receipts are implemented; order production planning/milestones are implemented; deliverable/final-payment/refund/provider gates remain pending; see [the database refactor plan](../architecture/database-refactor-plan.md) and [contract integration](../business/contract-integration.md).

Business-contact and Creator-application forms can notify the intake team by SMTP after the lead has been saved. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `INTAKE_NOTIFICATION_EMAIL` in the backend/Vercel environment together, then redeploy. Use port 587 with `SMTP_SECURE=false`, or port 465 with `SMTP_SECURE=true`, as required by the mail provider. The notification includes the submitted details and a link to the Admin lead record; private Creator CV files are not attached. If SMTP is unavailable, the lead remains saved in Admin and the API logs the delivery failure. Configure `SITE_URL` to make the Admin link absolute.

For new service orders, payment requests are available only after the customer acknowledges the sent contract and the order enters `WAITING_PAYMENT`. Staff/Admin can issue a deposit request or a full-payment request against the accepted order total; transfer receipts stay pending until a Staff/Admin user verifies the actual bank receipt. Bank details and QR are configured separately in Admin payment settings.

Legacy `/customer/projects/new`, public PROJECT_REQUEST lead identity checks and admin lead/project conversion remain compatible. Existing conversion matches customers by verified email and reuses an already converted project; it is a separate legacy path.

Administrators review projects, save/edit quotation drafts, preview and send quotations. Customers confirm acceptance or rejection. The server calculates totals, discounts and tax. Projects progress through production, deliverable review and revisions. Customer acceptance completes the project and creates a draft invoice. Administrators issue it and record payment only after confirming actual receipt. There is no payment gateway or simulated payment.

Messages, milestones, notifications and history come from PostgreSQL. Staff has request consultation and the existing support workspace; legacy project/payment access stays Admin/customer only. Commercial request conversations use current owner/assignment/Admin scope, stable message pagination and private attachments in project-files; private notes/transfer reasons are excluded from customer views. Direct member-only Messenger and deposit/balance plans remain compatible. Legacy invoice/manual receipts still require reconciliation with installment confirmations before financial release; see [the audit](../architecture/repository-audit.md). No payment gateway or e-sign provider is configured.

The optional `db:test-accounts` command provisions test identities in the Supabase project configured by `.env`; it is separate from rollback-only migration fixtures. Set a `MEDIAHUB_QA_PASSWORD` of at least 10 characters locally and keep the generated `.qa/role-accounts.json` manifest private. `db:verify-test-accounts` signs in using that manifest and runs read-only permission probes; it does not provision accounts. Browser E2E tests use an isolated local Vite server with mocked auth/API responses, so they verify the login and registration UI flow, not real Supabase credentials. Do not use the provisioning command against a production project.

## Storage and Auth configuration

- Public buckets: `portfolio`, `avatars`.
- Private buckets: `project-files`, `deliverables`, `lead-attachments`.
- Private downloads require API ownership/admin checks and short-lived signed URLs.
- Configure Supabase Auth Site URL, redirect allowlist and email delivery for the real domain. Registration returns to `/login`; recovery/invitations use `/reset-password`.
- Set `AUTH_REDIRECT_URL` to the real `/reset-password` URL and `CORS_ORIGIN` to exact allowed frontend origins.
- The browser uses public Supabase configuration. The API verifies tokens with Supabase and resolves current roles/activation from PostgreSQL.

## Deployment

Set production values:

```text
NODE_ENV=production
SITE_URL=https://your-domain.example
CORS_ORIGIN=https://your-domain.example
AUTH_REDIRECT_URL=https://your-domain.example/reset-password
VITE_API_BASE_URL=/api
```

With Docker installed, run from the repository root:

```powershell
docker compose --env-file .env -f deploy/compose.yaml config --quiet
docker compose --env-file .env -f deploy/compose.yaml up --build -d
```

The supplied configuration exposes the frontend on port 8080, keeps the backend inside the container network, proxies `/api`, and routes `/sitemap.xml` and `/robots.txt` to the API. Terminate HTTPS at your hosting platform/reverse proxy. `TRUST_PROXY_HOPS=1` matches the supplied Nginx-to-API setup; adjust it only to match your trusted proxy chain.

For separate hosting, publish `frontend/dist`, run `npm start` from the built backend, configure SPA fallback, and proxy sitemap/robots endpoints. `frontend/public/_redirects` provides SPA fallback only; configure the API proxy at the hosting platform.

`/api/health` is liveness; `/api/ready` additionally checks PostgreSQL. Dockerfiles/Nginx configuration are supplied, but container execution has not been verified because Docker is unavailable in this environment.

## Verification

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run db:check --prefix backend
node backend/scripts/smoke.mjs
node backend/scripts/check-storage.mjs
node backend/scripts/check-client-secrets.mjs
```

The smoke script reads the configured API/database. The storage check creates uniquely named temporary QA files, verifies signed versus anonymous access, then removes its own files. Playwright intercepts Supabase Auth and API calls, so its login/registration coverage verifies the local UI and client state, not real credentials or email delivery. The current progress document records browser coverage separately from API/SQL checks; authenticated customer/staff/admin journeys and full accessibility/responsive acceptance remain release requirements.
