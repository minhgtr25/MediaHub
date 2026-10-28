# MediaHub production audit — 2026-09-11

## Existing architecture

- React/Vite frontend: public home and portfolio under `/projects`; Supabase login, registration and password recovery; customer dashboard, project creation/detail, profile and notifications; admin dashboard, projects, customers, revenue, employees and three CMS resources.
- Express API: public services/portfolio/testimonials; authenticated identity, notifications and projects; admin reporting, customers, invoices, CMS and uploads. Project changes call a transactional SQL function.
- Database migrations 001–003 define profiles, customers, employees, services, projects, project_services, quotations, quotation_items, project_files, project_status_history, deliverables, revision_requests, reviews, testimonials, invoices, notifications and portfolio.
- Supabase Auth creates profile/customer records through a trigger. API checks tokens and resolves database roles. STAFF exists in database but has no application access.
- RLS covers all existing application tables. Business RPC execution is restricted to service_role. Private project files and deliverables use backend-authorized signed URLs. Public buckets contain avatars and portfolio images.
- Supabase is the active application database client. Prisma schema/client and a separate postgres configuration also exist; they are not the HTTP application's persistence path. Database/result/error helpers are duplicated.

## Gaps against requested architecture

Missing public service detail, informational pages, contact/request-to-lead, portfolio slugs and expanded case studies. Missing leads, partners, process, settings, audit, milestones, messages and recruitment models. Customer project, quotation and invoice collection routes are absent. Admin CMS and business management are incomplete. Existing quotation sends immediately; acceptance immediately creates an invoice, unlike the requested acceptance/delivery/invoice sequence. Revision approval marks every historic deliverable approved. Profiles lack account deactivation. Public selectors use wildcard fields. Homepage includes an unsupported satisfaction statistic. No error boundary, lint/typecheck scripts, tests, deployment guide or sitemap.

## Baseline checks

- Git has existing untracked `frontend/.agents/` and `frontend/skills-lock.json`; preserve these.
- Frontend and backend build both fail before compilation: dependencies are absent (`tsc` not found).
- Local migrations describe intended database state; deployed schema, RLS and buckets have not been verified. No production readiness claim is justified by static review alone.

## Implementation sequence

1. Install dependencies; repair actual compiler failures and establish repeatable checks.
2. Extend existing API and schema additively; preserve old migrations and supported routes.
3. Implement public discovery and lead submission with validated, rate-limited writes; wire administrator lead management.
4. Add customer collection routes and reuse existing project actions; improve error handling and remove unsupported public claims.
5. Extend CMS/workflows, ownership tests, migration verification and deployment documentation.
6. Verify builds, lint, typechecks, live database journeys and responsive browser layouts. Record unverified work explicitly.

# Historical audit snapshot (2026-09-11)

This records the repository state at the time of the audit. Prisma references are historical; Prisma has since been removed.
