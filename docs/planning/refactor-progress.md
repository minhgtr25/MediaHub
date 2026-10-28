# MediaHub cleanup checkpoint — 2026-10-23

This is the current implementation snapshot. Product behavior and role boundaries are defined in the [approved implementation plan](implementation-plan.md) and the [business workflow](../business/business-flow.md). Dated background notes remain in [Vietnamese development history](development-progress-vi.md); use the live code and applied migrations when those notes differ from current behavior.

## Codebase

- Root scripts provide `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck`, `format` and `format:check`. Runtime dependencies belong to the backend or frontend package.
- Source is grouped by app, domain and role. Page modules that combined unrelated workflows have been split, including Admin resource/customer/revenue/lead pages and static resource schemas, Customer billing, project file/quotation forms and types, Creator directory versus profile, public versus workspace layouts, account/authentication pages, Creator portfolio/media editors versus profile overview, request conversation state versus message-content/file rendering, shared idempotency-key and auto-refresh hooks across variation, Creator media and execution flows, Creator proposals versus customer quotations, execution coordination versus Staff decisions and Creator replacement invitations, Service Request/catalog/package/order API routes, and the order-payment overview versus payment forms/cards.
- Frontend styles are grouped into base, shared overrides, system and workflow layers. A conservative scan removed 228 rules whose classes had no source or test markup references.
- Unused TypeScript declarations are rejected by compiler settings. The backend's obsolete Prisma setup and generated client were removed; SQL migrations and typed Supabase models define persistence.
- Removed the unused legacy model barrel and its stale generator, which only generated from migration 001 and failed its own check against the maintained schema types. Base-schema files now identify the initial migration explicitly; current mappings remain composed through `platform.types.ts`.
- The Supabase type composition is split into shared domain aliases, RPC/function signatures and table mappings; `platform.types.ts` only combines these pieces into the database client contract.
- Admin and Customer workspace navigation now live in role-specific layout modules; shared menu groups, links and logout behavior live in `WorkspaceNavigation.tsx`. Staff and Creator remain in the shared workspace layout. Route trees are split by role under `frontend/src/routes/`; `App.tsx` now composes the groups and `lazyPages.ts` owns lazy page loading.
- Setup and workflow documentation is indexed in [docs](../README.md). The detailed product role, request, order, payment and production behavior stays in the business documents.

## Supabase cleanup

- Migrations 037–044 are applied and recorded. Four unused/legacy tables, seven synthetic creator metrics, two revoked RPCs, quarantined demo portfolios and unchanged legacy demo workflow rows were removed. Six referenced demo services were deactivated instead of deleted.
- The current audit found 73 public tables, 737 columns, 120 SQL functions, 82 triggers and 81 RLS policies. All 37 empty tables have workflow/dependency references. The 29 nullable fields with no current values remain referenced. No table/view column lacks a detected application or database dependency.
- Eighteen demo Creator profiles remain because they are connected to Auth accounts and workflow history. The complete table map and retention decisions are in the [data dictionary](../architecture/supabase-data-dictionary.md) and [schema audit](../architecture/supabase-schema-audit.md).
- Keep applied migrations immutable. `npm run db:check --prefix backend` checks migration checksums and 18 rollback-only SQL workflow suites. Use additive migrations for future schema changes.

## Verification on 2026-10-23

- Backend unit/HTTP tests: **161 passed**. Frontend tests: **14 passed**. Desktop/mobile Playwright E2E: **32 passed** after the latest page-module reorganizations.
- Backend/frontend lint, typecheck, format checks and production build passed.
- Local development returned HTTP 200 for `/login` and `/register`; `/api/health` returned `ok` through the API proxy.
- The built frontend preview returned HTTP 200 for `/login`, `/register` and proxied `/api/health`.
- Migration checksums and all 18 rollback-only SQL suites passed. The live schema audit matched the inventory above.

## Remaining verification boundary

Playwright intercepts Auth and API calls, so its successful login and registration journeys verify the UI and client state, not real Supabase credentials or email delivery. The local `.env` points at a hosted Supabase project; the repository has no QA account manifest, Supabase CLI or Docker runtime. Deployment instructions prohibit provisioning test users against production, so no hosted account was created. A read-only Auth settings check on 2026-10-23 confirmed signup is enabled and email confirmation is required. To verify real credentials and confirmation email, configure an isolated non-production Supabase project, provide a private QA account manifest and permitted email setup, then run `npm run db:verify-test-accounts --prefix backend` and browser journeys against that environment.

The local changes remain uncommitted and undeployed. Historical checkpoint detail is retained in [development-progress-vi.md](development-progress-vi.md).
