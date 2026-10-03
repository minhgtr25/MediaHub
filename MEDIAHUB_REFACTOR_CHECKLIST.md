# MediaHub Refactor Checklist

Final scope is IMPLEMENTATION_PLAN.md, approved for implementation 2026-10-03. It supersedes the earlier three-account-role target below. Creator is a fourth authenticated role, commissions outside the system, Staff confirms final receipts, automatic longest-idle consultation assignment and final-delivery completion are required. Historical checked tasks below are not acceptance of the final workflow.

Updated: 2026-10-03. Check only implemented AND verified tasks. Existing functionality is reused; this checklist tracks the requested refactor, not just whether a page exists.

The requested phase lists disagree about numbering. This file follows the execution order in section 33: database before customer/staff, security integrated early and reviewed again before release.

## Revised scope — latest user clarification

- [x] Revise the product plan to Guest, Customer, Staff and Admin; only CUSTOMER/STAFF/ADMIN are account roles
- [x] Separate managed creator profiles and external partner relationships from account roles in the target design
- [ ] Normalize application guards, account administration, SQL/RLS and QA provisioning to three stored roles with a reviewed legacy identity migration
- [ ] Complete UI/UX audit and mobile/desktop verification of service browsing, request cards, assigned-Staff chat, creator selection inside chat and commercial cards
- [ ] Complete electronic-contract integration, amount/reference-bound payment QR and delivery/revision/acceptance journey
- [ ] Complete Staff email activation invitations, verified financial/expense reporting, audit views and policy-based Staff commissions

Checked legacy compatibility work below records prior implementation; it does not override this revised target or imply that role normalization is complete.

## Phase 0 — Audit

- [x] Source architecture/dependency/module inventory analyzed
- [x] Routing and auth/state/service layers analyzed
- [x] Existing persisted roles and permission gaps analyzed
- [x] Database migrations/RPC/RLS and live schema inspected read-only
- [x] API and business-critical workspaces analyzed
- [x] UI component/CSS and security problems recorded
- [x] Audit, flow, permission matrix, database plan and progress documents created before code edits
- [ ] Complete browser visual/accessibility audit (later UI phase)

## Phase 1 — Architecture / P0 foundation

- [x] Centralize compatible customer/legacy role predicates
- [x] Close private project/support/payment collection and draft leaks
- [x] Define separate request/order/project lifecycle and compatibility strategy (design; implementation remains Phase 3)
- [x] Normalize workspace navigation / safe login return
- [x] Align runtime documentation/configuration

## Phase 2 — Authentication & Authorization

- [x] Align BUSINESS with CUSTOMER in SQL without changing stored roles
- [x] Require active membership for database/realtime conversations
- [x] Regression tests: guest, owner, other customer/business, creator, staff, admin, suspended account
- [x] Preserve all existing roles when admin edits account activation
- [x] Protect project-request submission; retain public contact enquiry
- [x] Guard stale auth refresh/session results with generation checks (source/build verified)
- [x] Provision one confirmed identity per persisted role; user-requested shared local test password, sign-in verification and 42 read-only API permission probes; credentials ignored by Git/Docker
- [ ] Browser regression for logout/token refresh/account suspension races
- [ ] Invitation lifecycle and activation/password setup; no plaintext passwords

## Phase 3 — Database model / business entities

- [x] Add requests / request assignments / packages with compatible relationships (020 applied, rollback-only assertions pass)
- [x] Add separate orders linked to accepted quote version (021 applied; snapshots, uniqueness and no early project/invoice verified)
- [x] Add creator proposals and proposal/quote/order conversation events
- [ ] Add contracts and acknowledgment events
- [ ] Add transactions/commission history and audit metadata
- [ ] Backfill strategy, FK/index/RLS verification; no guessed financial history
- [x] Database assertions pass before applying migrations 019–021; each future migration still requires its own verification

## Phase 4 — Customer

- [x] Request creation with package, creator/advice choice, budget/timeline/brief/references (API/SQL and frontend build verified; authenticated browser pending)
- [ ] Own request/order/project lists and next-action summaries
- [x] Assigned staff visible before first message in existing support detail (API test passes)
- [x] Assigned staff visible before messages in request workspace (API/source verified)
- [x] Assigned staff and accepted terms visible in scoped order workspace (SQL/HTTP/build; browser order submission remains pending)
- [x] Proposal shortlist/select/reject and quote revisions (SQL/HTTP and customer/staff browser samples)
- [x] Versioned contract terms and explicit application acknowledgment (SQL/HTTP/build; browser pending)
- [ ] Collected/remaining payment and project review/acceptance journeys

## Phase 5 — Staff

- [x] Staff request dashboard: queue, assigned consultation, deadlines and next tasks (API/SQL/build; browser pending)
- [x] Claim/release/transfer request with scoped access; previous staff revoked in SQL/HTTP checks
- [x] Creator finder and multiple proposal cards (SQL/HTTP and two-proposal browser sample)
- [x] Scoped draft/publish/versioned quote management; customer responses cannot be impersonated
- [ ] Assigned request quote/contract/payment/project/milestone management
- [x] Internal notes/assignment reasons excluded from customer views at API/RLS and shared-message boundaries

## Phase 6 — Conversation workspace

- [x] Request-linked workspace, staff/header/brief side panel and transactional creation (API/SQL/build)
- [x] Order links reuse the request conversation with active-order write gates (SQL/HTTP/build)
- [x] Creator/quote/order cards and links; header refresh on events/focus/visible periodic refresh
- [ ] Creator/quote/contract/payment/project/system cards
- [ ] Private attachments and read timestamps
- [x] Request attachment scope, private project-files storage and 180-second signed downloads; persisted read timestamps and stable older-message cursor (SQL/HTTP/helper tests)
- [x] Implement messenger error feedback, send lock and draft preservation; remove unsupported presence/inert controls (build/helper tests)
- [ ] Authenticated browser regression for failed sends, rapid sends, realtime/read receipts; older-message pagination
- [ ] Transactional conversation creation and recipient policy

## Phase 7 — Quote / Contract / Payment

- [x] Immutable published quote versions and revision history; expired/obsolete/other-request acceptance denied
- [x] Accepted current quote creates one WAITING_CONTRACT order; repeated acceptance reuses snapshots
- [x] Accepted quote/order/contract relations, immutable terms/evidence, owner-only latest-version acknowledgment and synchronized order transfer
- [x] Server-validated deposit/full/milestone/remaining requests, due date/reference, fixed bank snapshot, owner reports and immutable Admin-verified receipt history (SQL/HTTP/build; browser pending)
- [ ] QR linked to stored amount/order/payment reference
- [ ] Reconcile concurrent confirmations, invoices, refunds and audit
- [x] External e-sign integration boundary documented; no provider-backed signature claimed
- [ ] Gateway integration and verified amount-specific QR configuration

## Phase 8 — Project lifecycle

- [x] Atomic/idempotent project creation from confirmed order with actual acknowledgment/verified receipt checks; legacy mutation paths blocked (SQL/HTTP/build)
- [x] Production PLANNING/READY/IN_PROGRESS/ON_HOLD, current assignment/customer/selected creator links and scoped milestone/deadline/history management (SQL/HTTP/build)
- [ ] Milestones, revisions, staff/customer/creator/deadline/deliverables
- [ ] Final payment and acceptance gates with legacy compatibility
- [ ] Completion and one review per completed project

## Phase 9 — Admin

- [ ] Staff invitations/reset/enable/disable/permissions/performance
- [x] Request assignment/transfer and operational oversight at API/SQL; admin UI built (browser pending)
- [ ] Financial control, system issues and enriched audit viewer
- [ ] Creator profile/portfolio administration

## Phase 10 — Commission & Analytics

- [ ] Policy-based estimates from defined revenue basis
- [ ] Approve/adjust/pay history with reasons and audit
- [ ] Staff/customer/creator/conversion/outstanding analytics
- [ ] Email abstraction and notification event coverage

## Phase 11 — UI/UX

- [x] Written design rules reuse current CSS/components
- [x] Remove fabricated metric multipliers, fallback partner names, fixed ratings and unsupported security/discount claims
- [ ] Review existing published demo content/partner/ratings with content owner; no historic records deleted
- [ ] Human-readable status labels and useful empty/loading/error feedback
- [ ] Unified customer/staff commerce layout
- [ ] Mobile/tablet/desktop visual and keyboard checks

## Phase 12 — Testing

- [x] Frontend/backend build/typecheck/lint pass for P0 and request foundation
- [x] Node authorization regression suite passes
- [x] Rollback-only SQL workflow/RLS suite passes
- [ ] Browser customer → staff → quote → contract → payment → project journey
- [ ] Browser staff/admin critical journeys
- [x] Three private storage buckets deny anonymous downloads; signed downloads work and QA files removed
- [x] Production frontend bundle contains none of configured private secrets; scan added to CI
- [ ] Full responsive/keyboard/accessibility checks across authenticated workspaces (guest samples passed)

## Phase 13 — Deployment readiness

- [x] Review migration 019 risk and order before application
- [x] Apply verified compatible migration 019 and verify ledger
- [x] Apply reviewed additive migrations 020–024 and verify 004–024 ledger plus seven rollback assertion suites
- [x] README/deployment/API changes documented for current tranche
- [ ] Hosting runtime/container/redirects/CORS/email/realtime checks
- [ ] Production smoke/rollback plan; deployment status reported accurately

See [REFACTOR_PROGRESS.md](REFACTOR_PROGRESS.md) for phase evidence and the exact next task.
