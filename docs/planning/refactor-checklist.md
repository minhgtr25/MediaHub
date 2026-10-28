# Codebase cleanup checklist — 2026-10-23

This checklist tracks repository organization, documentation, Supabase cleanup and verification. Product roles and business behavior remain defined by the [approved implementation plan](implementation-plan.md) and the [business workflow](../business/business-flow.md). Dated implementation history is kept separately in [development-progress-vi.md](development-progress-vi.md).

## Completed

- [x] Root commands provide local development, build, tests, E2E, lint, typecheck and formatting checks.
- [x] Runtime dependencies are scoped to backend and frontend packages; obsolete Prisma configuration/client files are removed.
- [x] Unused TypeScript locals and parameters are rejected by compiler settings.
- [x] Frontend modules are grouped by public, Admin, Customer, Creator, shared workflows and layouts. Admin lead and resource screens, account pages, billing, project files/quotes, Creator proposals/quotes, Creator profile versus portfolio/media editors, request chat versus message-content/file rendering, shared idempotency-key and auto-refresh hooks, payment overview versus payment forms, request/order routers, public service routes, Admin service-package routes and public/workspace layouts have separate modules.
- [x] Frontend CSS is organized into base, shared override, system and workflow layers; rules without source or test class references were removed conservatively.
- [x] Workflow and architecture Markdown is indexed under `docs/`; the current Supabase audit, data dictionary and progress checkpoint are maintained.
- [x] Supabase migrations 037–044 remove unused/legacy tables and synthetic fields, quarantine/remove unchanged demo content, and deactivate demo services that retain historical references.
- [x] The live schema audit found 73 public tables, 737 columns and no unreferenced table/view columns. Empty tables and null-valued fields were retained where workflows or database dependencies still reference them.
- [x] Backend **161 tests**, frontend **14 tests**, **32 desktop/mobile E2E tests**, and **18 rollback-only SQL workflow suites** pass at the latest full verification checkpoints.
- [x] Backend/frontend lint, typecheck, formatting and production builds pass. Local dev and production preview serve `/login`, `/register` and `/api/health` successfully.

## Still required for final acceptance

- [ ] Run real login, registration and email confirmation against an isolated non-production Supabase project. The current `.env` points to a hosted project; never provision QA accounts there. Keep keys and passwords in local environment files, not this document or chat.
- [x] Recheck remaining high-complexity modules by responsibility. Execution coordination, Staff decisions, and Creator replacement invitations now have separate modules with shared labels/hooks/types.
- [ ] After the final code changes, rerun backend/frontend tests, E2E, lint, typecheck, format checks, database migration audit and production build/preview.

The uncommitted worktree is intentional. Do not commit, deploy, reset the database or change existing Auth identities as part of this checklist.
