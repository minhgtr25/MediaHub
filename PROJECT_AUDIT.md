# MediaHub — Project Audit

Audit date: 2026-10-03 (Asia/Saigon). Baseline commit: `ec754ff`. This is a source and live schema audit, not a claim that the product meets the requested definition of done.

## Current Architecture

- **Frontend:** React + TypeScript + Vite, React Router, lucide-react, Supabase browser client. `App.tsx` defines public, customer, staff, admin and authenticated messenger routes. CSS is handwritten; there is no Tailwind/shadcn/MUI dependency. `components/ui.tsx` already supplies forms, fields, pagination, loading/error states and badges.
- **State:** AuthContext and SiteSettings contexts; local React state; `useApi` with request cancellation. `services/api.ts` centralizes bearer tokens and the API envelope. No Redux or query-cache framework.
- **Backend:** Node.js 24 locally/CI/containers; Express 5, TypeScript/ESM `.mts` entrypoints, Zod, multer, helmet, CORS and rate limits. Root package declares Node 22, inconsistent with the actual runtime. `app.mts` has about 960 nonempty lines plus resource routers.
- **Persistence:** `config/database.ts` creates the active Supabase service-role client. PostgreSQL RPCs implement transactional business writes. Prisma is an older introspected model/client, not the HTTP persistence path; marketplace/support/payment additions are missing from it. SQL migrations are authoritative.
- **Authentication:** Supabase Auth token validation via `auth.getUser`, followed by active-profile and customer-record lookup. Auth trigger creates a CUSTOMER profile and customer record; audience metadata does not grant staff/admin access. Reset/invitation links use Supabase Auth.
- **Deployment:** existing Vercel frontend/backend service routing and container entrypoint; Docker Compose/Nginx alternate deployment. No deployment is performed as part of this baseline audit. Private configuration was inspected by key presence only and is not copied into documents.
- **Libraries:** locked npm dependencies installed successfully with `npm ci --ignore-scripts`; frontend/backend ESLint and TypeScript baseline checks pass. Backend compiles. Baseline Node test runner and Vite build hit Windows sandbox `spawn EPERM`, requiring a permitted execution retry before judging code correctness.

## Current Roles

Persisted roles are ADMIN, STAFF, CUSTOMER, BUSINESS, CREATOR and STUDENT_CREATOR. Guest is unauthenticated, not a stored role. Live aggregate counts confirm that BUSINESS and creator accounts really exist; they cannot be silently deleted or renamed. BUSINESS must have customer-equivalent commerce access, scoped to its own customer record. Creator accounts retain their existing member-only messaging; creator profiles also support a null account link and can remain managed entities.

## Existing Pages

| Area | Existing routes / pages |
| --- | --- |
| Public | home, services/list/detail, creator discovery/profile, portfolio/list/detail (`/projects` is a public portfolio alias), process, partners, about/privacy/terms, contact, request-project |
| Auth | login, register, forgot-password, reset-password |
| Customer | dashboard, project list/create/detail/files/quotation/revisions/messages, quotations, invoices/detail, support/list/conversation, payments, profile, notifications |
| Staff | dashboard is a support inbox; assigned support conversations, profile, notifications |
| Admin | dashboard, projects/detail/messages, leads/detail/conversion, accounts/invite, customers, employees, revenue, services, portfolio, testimonials, partners, process, settings, files, quotations/detail, invoices, support, payment settings, payments, activity logs |
| Shared | `/messages` and `/messages/:id`, 403/500/network/session errors, catch-all |

Routing, auth/service/hook layers, layouts, API routers, workflow migrations/RLS, deployment configuration and business-critical workspaces were reviewed. Page/form/API call sites across the remaining modules were inventoried. Generated Prisma files and static reference media are dependency artifacts; full visual QA and exhaustive line-by-line cleanup remain later phases.

## Existing API

| Prefix | Behavior / guard at baseline |
| --- | --- |
| `/api/public` | catalog, creator filters/discovery/profile, home/content, portfolio, enquiries with optional private file, sitemap/robots |
| `/api/auth/me`, `/api/notifications` | authenticated account/profile preferences and own alerts |
| `/api/customer` | CUSTOMER/BUSINESS collections/dashboard, though SQL report only supports CUSTOMER |
| `/api/projects` | list/detail/history/files/download, create/edit, quotation accept/reject, review/revision/acceptance; ownership for detail, incomplete list filtering |
| `/api/support` | tickets, queue, agents, messages, claim/assign/status; bypasses later STAFF restriction; only CUSTOMER receives owner filtering |
| `/api/payments` | settings, plans/installments, eligible projects and create/report/confirm/reject; excludes STAFF but fails to exclude creator roles or scope BUSINESS |
| `/api/messages` | member-only conversations/history/read/message; direct creator/profile recipient creation is not transactional |
| `/api/admin` | ADMIN guard; catalog/content/account/project/quote/invoice/revenue/lead operations |

All private HTTP data is read with a service-role client, so backend scoping is essential even with database RLS.

## Existing Database

Read-only inspection of the configured database confirmed 44 public tables, RLS enabled on each, migrations 004–018 in the checksum ledger, and live function definitions matching the reviewed legacy behavior. Baseline migrations 001–003 precede the ledger. Five storage buckets exist: avatars/portfolio public; project-files/deliverables/lead-attachments private with 50/50/10 MB limits.

Existing entity mapping and migration strategy: [DATABASE_REFACTOR_PLAN.md](DATABASE_REFACTOR_PLAN.md). Important functions: `project_action` + private base, `dashboard_report` + private base, `save_quotation`, `manage_quotation`, `convert_lead`, `support_action`, `payment_action`, `owns_project`, `is_conversation_member`. Actor-bearing RPCs are service-role-only. SQL triggers enforce project transitions, record history/audit and create notifications.

## Current Business Flow

Guest enquiry → admin qualifies/invites/matches email → conversion creates a SUBMITTED project. Logged-in CUSTOMER creates a project directly. Admin reviews → saves draft quote → sends → customer accepts → admin starts production → uploads deliverables → customer requests revision or accepts → project completes and creates a draft invoice → admin issues/records payment.

Separate payment plans support a fixed deposit/balance split based on the accepted quote. Balance reporting opens after project completion. This differs from the requested final-payment-before-completion sequence. Support tickets and direct messenger conversations are disconnected from the commercial workflow. There is no separate request/order/contract or creator-proposal entity.

## Problems Found

The following findings describe the audit baseline. Both P0 findings and several role/auth/UX issues are now fixed; see [REFACTOR_PROGRESS.md](REFACTOR_PROGRESS.md) for verified changes and remaining work. Missing commerce entities remain missing.

### Critical / P0

1. **Private collection exposure:** BUSINESS/CREATOR/STUDENT_CREATOR can reach project/support/payment reads where filtering only checks `role === 'CUSTOMER'`. BUSINESS project detail also includes unpublished quote/invoice drafts. Creator support detail ownership checks fall through. Files: `app.mts`, `support-routes.ts`, `payment-routes.ts`.
2. **Disabled-account realtime access:** `is_conversation_member` checks identity membership but not `profiles.active`; a suspended account can continue direct database/realtime reads.

### High

3. BUSINESS is enabled by frontend/middleware but rejected by project/report/payment/support SQL and by CUSTOMER-only enquiry redirect. Existing customer journeys break for business accounts.
4. Guest can submit PROJECT_REQUEST through public lead API, against the required login boundary. CONTACT enquiries should remain public.
5. Request/order/project are merged in legacy projects. No contract gate, project deposit gate, versioned quote revision workflow or staff commerce authorization.
6. Staff invitations grant access immediately after email invitation; no explicit invitation lifecycle. UI role select omits BUSINESS/CREATOR/STUDENT_CREATOR, risking unintended role changes when editing existing accounts.
7. Direct conversation and members are created in separate writes, leaving orphan records on failure. Arbitrary profile recipient creation needs an explicit product policy.
8. Several paid paths disagree: invoice `paid` versus installment confirmation. Concurrent installment confirmations can miss final invoice synchronization; invoice creation occurs after some installment receipts. Refund/reconciliation/financial audit are incomplete.
9. Generated baseline types allow weak `any` casts for marketplace API queries; filter joins do not consistently constrain parent creators. Public creator wildcard reads include internal account IDs.

### Medium

10. Homepage fabricates creator/project/ratings/satisfaction/experience and partner claims; filters contain seed-specific slugs. Metrics must come from verified records and unavailable values should be omitted.
11. Auth return redirects and workspace navigation are duplicated; creator users land on customer links they cannot use. Refresh can race with logout/profile resolution.
12. Messenger silently restores a failed message without showing an error, permits concurrent sends, shows online/read status without supporting evidence, and has inert controls/history pagination gaps.
13. Customer conversation does not show the assigned staff unless that staff has sent a message. No next-step summary or unified commercial side panel.
14. Audit contains actor/action/entity/time only. Direct HTTP CMS writes lack transaction actor context. Missing old/new values/reasons and several important event categories.
15. Staff/admin dashboards, commission, notifications/email beyond current trigger/Auth behavior are incomplete.

### Low

16. Existing production docs refer only to migrations 004–013 and claim STAFF/realtime unavailable; these documents are outdated.
17. Large page/service modules, sparse lint configuration, duplicated transition/status strings and layers of CSS overrides increase maintenance cost.
18. Dockerfile port/default runtime documentation disagrees with Compose overrides. Browser-level accessibility, responsive layout and auth-email delivery still require verification.

## Technical Debt

Keep Supabase Auth, Express routes, existing catalog/customer/workspace components and SQL migration authority. Avoid adding another UI framework, replacing working legacy projects or regenerating the unrelated auth Prisma schema during commerce work. Extract permissions/status helpers before extending workspaces. Add regression tests that exercise HTTP authorization and database behavior, not only helper outputs.

## UX Problems

Customer sees technical/fallback labels for unmapped states; assignment/next action/paid-versus-remaining information is fragmented. Public request selection is lost on redirect. Staff has only support operations. Admin account role editing is unsafe for legacy marketplace users. CSS already contains responsive rules and reusable tokens; improve them incrementally and verify actual screens rather than declaring responsive acceptance from CSS alone.

## Security Problems

Critical API scoping and inactive membership defects above. Strengths: verified tokens, active-account checks, strict Zod bodies, no customer-provided payment amount in create-plan RPC, service-only workflow RPC, private storage signed download checks, file signatures, rate limits, secret separation. RLS is enabled but cannot compensate for unscoped service-role API reads. No secret values were emitted or stored in this audit.

## Missing Business Features

Service packages; service requests with assignments/transfer/rejection; proposal cards with selection; quote versions/revision request; contract records/acknowledgment and optional e-sign provider; distinct orders; commercial conversations/events; staff projects/milestones; payment types/due dates/refunds/transactions; commission policy/history; staff invitation lifecycle; complete analytics and email abstraction.

## Recommended Refactor

1. Close collection/detail role leaks and inactive RLS membership; preserve BUSINESS as customer-equivalent without mutating stored roles.
2. Add reviewed migration 019 for compatible SQL permission alignment, with rollback-only workflow/RLS tests before any application.
3. Normalize role navigation and login return, protect project-request submission, retain selected service, fix unsafe account-role forms.
4. Execute later phases in the master checklist: additive requests/orders/contracts/proposals around existing catalog/project/payment data, scoped staff commerce, then coherent UX/analytics.
5. Keep checks and release evidence explicit. Build/tests passing does not imply the new commerce architecture exists.
