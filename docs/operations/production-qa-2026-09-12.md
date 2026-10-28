# Production verification status

Updated 2026-09-12. This records evidence; browser/deployment acceptance is not complete.

## Implemented

- Public service details, portfolio slug details/gallery, homepage configuration, process, partners, contact/request forms and configurable informational pages.
- Lead validation/rate limiting, private attachments, admin review, invitations and idempotent lead-to-customer/project conversion.
- Customer project workspace, quotation decisions, deliverable acceptance, revisions, messages, milestones, invoices/printing, notifications and profile preferences.
- Admin content CRUD, draft quotation editing/preview/send/cancel with tax, invoice issue/payment recording, project scope/progress/deadline updates, files, accounts and activity viewer.
- Migrations 004–013 applied to the configured database; old migrations preserved. Prisma schema/client synchronized. SQL remains authoritative.
- Error boundary, error mapping, lazy routes, form accessibility controls, sitemap/robots, Nginx/Docker configuration and CI checks.

## Evidence collected

- Final backend/frontend TypeScript and ESLint checks passed. Both production builds passed; all 6 Node security tests passed (0 failures).
- Frontend build output was checked against 4 private environment values: no matches. Git whitespace verification passed after normalizing generated Prisma output.
- Vite reports a 504.43 kB main JavaScript chunk (145.63 kB gzip) and an ineffective dynamic import for the shared content module. Further bundle splitting remains a performance improvement; these warnings do not fail the build.
- HTTP security tests cover unauthenticated protection, admin RBAC, cross-customer project/private-download denial, lead overposting/validation and file signatures.
- Database assertions cover conversion/idempotency, draft/send/tax/acceptance, revision, delivery acceptance, invoice issue/payment, historical version preservation, revoked RPC privileges, customer RLS and inactive accounts. Synthetic records are rolled back.
- Real read-only smoke checks returned 200 for health/readiness, public catalogs/content and sitemap/robots.
- Real storage checks confirmed signed downloads and denied public URLs for all three private buckets. Temporary files were removed.
- npm audit reported zero vulnerabilities after patching deepmerge-ts/mysql2 transitive dependencies; Prisma remains 7.10.

## Remaining release checks

- No ADMIN exists in the configured database. The user has been asked which registered email should become the first administrator; no account was selected implicitly.
- Browser tooling reports no available browser, including in-app browser. Responsive widths 375/390/768/1024/1440, visual layout, keyboard navigation and complete browser journeys remain unverified.
- Docker is unavailable. Image builds, Compose startup and Nginx behavior require a Docker host.
- Real-domain DNS/TLS, hosting settings, Supabase redirect allowlist and auth email delivery require deployment configuration.
- Actual company/legal content and public catalog records must be published by the owner. Empty states are intentional; fabricated production content was not inserted.

## Scope notes

- Recruitment was absent in the baseline and remains outside this implementation, consistent with the conditional requirement. No staff workspace, realtime chat or payment gateway was introduced.
- SEO metadata is client-rendered except sitemap/robots. Validate social crawler previews on the selected hosting setup.
- Audit triggers record covered writes; transactional workflow actions include the actor. Direct CMS writes appear as system/API entries when there is no database actor context.
- Existing project workspaces serve quotation/files/revision subroutes. Some administrative detail views remain inline rather than using every suggested URL independently.

Do not label the complete product production-ready until the outstanding browser, configuration and deployment checks pass.

# Historical QA snapshot (2026-09-12)

The Prisma references below describe the toolchain at the time of this snapshot. Prisma has since been removed; Supabase JS and tracked SQL migrations are the current database path.
