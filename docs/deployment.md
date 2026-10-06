# Setup and deployment

SQL migrations own application workflows, constraints and RLS. Prisma is an introspected client; it is not a second authentication system or the migration authority.

## Local development

Use Node.js 24. Copy `.env.example` to `.env` and fill the Supabase settings. Never place a service-role key, database connection string or private credential in a `VITE_` variable.

```powershell
npm ci --prefix backend --ignore-scripts
npm ci --prefix frontend --ignore-scripts
npm run dev --prefix backend
# In another terminal:
npm run dev --prefix frontend
```

The frontend runs on port 5173 and the API defaults to 5000. Without `VITE_API_BASE_URL`, the browser uses `/api`; Vite proxies this to the local API. The backend reads injected environment variables first, then `backend/.env`, then root `.env`.

## Database

For a new Supabase project, apply SQL migrations `001_mediahub.sql`, `002_workflow.sql`, and `003_reporting.sql` once through the Supabase SQL editor. For an existing installation, inspect the schema first; do not replay baseline migrations.

Set `DIRECT_URL` to the database owner connection for administrative scripts, then run:

```powershell
npm run db:check --prefix backend
npm run db:migrate --prefix backend
```

`db:check` validates pending migrations and workflow/authorization/request/commerce/contract/order-payment/production assertions in a transaction and rolls everything back. `db:migrate` applies migrations 004–024 with an advisory lock and checksum ledger. Before commit, it runs all seven assertion suites in a savepoint and rolls back synthetic test data. Previously applied SQL files must not be edited. The runner skips unchanged applied migrations. Migration 019 aligns BUSINESS ownership with CUSTOMER and active conversation membership. Migration 020 adds separate requests/packages, assignment history, private notes/files and linked conversations. Migration 021 reuses quotations/items with an exclusive request/project origin, adds proposals and order snapshots, hides unpublished drafts, freezes sent terms and serializes customer acceptance. Migration 022 adds versioned contract terms and immutable APPLICATION acknowledgment, plus synchronized order/request transfers. Owner consent moves an order to WAITING_PAYMENT without creating a receipt or production project. Migration 023 adds separate order payment requests/immutable manual-bank receipts, bounded outstanding amounts and Admin verification; enough verified receipt can confirm an order without creating production. No historic orders, signatures or receipts are backfilled. Deploy the corresponding API/UI together; new request quotes are excluded from legacy quotation/payment routes.

Migration 024 reuses projects/milestones with a nullable order origin and separate production_status. Confirmed-order creation independently checks acknowledgment/verified receipts; current assignment gates production/milestone actions. New-origin rows use the order workspace and are excluded from legacy project mutation APIs. No old project status or financial evidence is converted. See [production workflow](../PRODUCTION_WORKFLOW.md).

The scripts do not persist test users, customers, invoices or service records. Run database checks during a suitable maintenance window because they acquire brief schema locks.

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

| Key | Use |
| --- | --- |
| `hero` | Homepage headline, supporting text and image |
| `about` | Company introduction, vision, mission and values |
| `privacy` | Approved privacy policy |
| `terms` | Approved terms |
| `company_name` | Company name in the content field |
| `company_email` | Public email in the content field |
| `company_phone` | Public telephone in the content field |
| `company_address` | Public address in the content field |

Website settings are public editorial content when published. Never store credentials there. Company/legal copy needs the business owner's review before publication.

## Workflow

Visitors submit public contact enquiries with optional private PDF/image attachments. Service-request entry requires active CUSTOMER/BUSINESS and preserves selected service/package/creator through login. `/customer/requests/new` creates a separate request and commercial conversation atomically; it creates no project/order or payment obligation. Staff sees reduced queue summaries, then claims a request to view its brief, converse, record private notes, transfer/release or change consultation status. Admin oversees requests and manages service packages; each submitted brief preserves its package snapshot. Creator proposals, quote versions, accepted-order snapshots and versioned contract acknowledgment are implemented. New-order manual payment requests and immutable Admin-verified receipts are implemented; order production planning/milestones are implemented; deliverable/final-payment/refund/provider gates remain pending; see [the database refactor plan](../DATABASE_REFACTOR_PLAN.md) and [contract integration](../CONTRACT_INTEGRATION.md).

Business-contact and Creator-application forms can notify the intake team by SMTP after the lead has been saved. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `INTAKE_NOTIFICATION_EMAIL` in the backend/Vercel environment together, then redeploy. Use port 587 with `SMTP_SECURE=false`, or port 465 with `SMTP_SECURE=true`, as required by the mail provider. The notification includes the submitted details and a link to the Admin lead record; private Creator CV files are not attached. If SMTP is unavailable, the lead remains saved in Admin and the API logs the delivery failure. Configure `SITE_URL` to make the Admin link absolute.

For new service orders, payment requests are available only after the customer acknowledges the sent contract and the order enters `WAITING_PAYMENT`. Staff/Admin can issue a deposit request or a full-payment request against the accepted order total; transfer receipts stay pending until a Staff/Admin user verifies the actual bank receipt. Bank details and QR are configured separately in Admin payment settings.

Legacy `/customer/projects/new`, public PROJECT_REQUEST lead identity checks and admin lead/project conversion remain compatible. Existing conversion matches customers by verified email and reuses an already converted project; it is a separate legacy path.

Administrators review projects, save/edit quotation drafts, preview and send quotations. Customers confirm acceptance or rejection. The server calculates totals, discounts and tax. Projects progress through production, deliverable review and revisions. Customer acceptance completes the project and creates a draft invoice. Administrators issue it and record payment only after confirming actual receipt. There is no payment gateway or simulated payment.

Messages, milestones, notifications and history come from PostgreSQL. Staff has request consultation and the existing support workspace; legacy project/payment access stays Admin/customer only. Commercial request conversations use current owner/assignment/Admin scope, stable message pagination and private attachments in project-files; private notes/transfer reasons are excluded from customer views. Direct member-only Messenger and deposit/balance plans remain compatible. Legacy invoice/manual receipts still require reconciliation with installment confirmations before financial release; see [the audit](../PROJECT_AUDIT.md). No payment gateway or e-sign provider is configured.

For the user-requested local test identities, run `npm run db:test-accounts --prefix backend`; it creates six confirmed Auth users on the configured Supabase project and assigns roles through manage_user. The shared test password was explicitly requested by the project owner. Credentials live only in ignored `.qa/ROLE_TEST_ACCOUNTS.md` and manifest; no tokens are saved and no email is sent. `npm run db:verify-test-accounts --prefix backend` checks sign-in/current role and 60 read-only API permission probes. This command is separate from rollback-only migration fixtures; do not use seed-demo to provision role tests or overwrite existing users/content.

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
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm run lint --prefix backend
npm run typecheck --prefix backend
npm test --prefix backend
npm run db:check --prefix backend
node backend/scripts/smoke.mjs
node backend/scripts/check-storage.mjs
node backend/scripts/check-client-secrets.mjs
```

The smoke script reads the configured API/database. The storage check creates uniquely named temporary QA files, verifies signed versus anonymous access, then removes its own files. The current progress document records browser coverage separately from API/SQL checks; authenticated customer/staff/admin journeys and full accessibility/responsive acceptance remain release requirements.

After SQL changes, synchronize Prisma using `prisma:pull` and `prisma:generate`. The `auth` schema is included because `profiles.auth_user_id` references `auth.users`. Tables/enums are marked externally managed in Prisma config. Do not use Prisma Migrate or `db push` to replace Supabase SQL migrations. See [Prisma externally managed tables](https://docs.prisma.io/docs/orm/prisma-schema/data-model/externally-managed-tables).


Test account provisioning requires `MEDIAHUB_QA_PASSWORD` (minimum 10 characters) supplied through the local environment. Do not commit test credentials; generated manifests stay in `.qa/`. Verification uses the existing private manifest and does not require reprovisioning accounts.
