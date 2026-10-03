# Database Refactor Plan

Updated 2026-10-03. PostgreSQL/Supabase SQL migrations are authoritative. Baseline read-only inspection confirmed migrations 004–018 applied and 44 public tables with RLS. Migration 019 has since been verified and applied; the table inventory is unchanged. Baseline 001–003 is untracked by the additive ledger. Preserve all applied files/checksums and production rows.

## Existing → Required Mapping

| Existing tables | Reuse / gap / proposed additive change |
| --- | --- |
| profiles, customers, employees | Keep identity/customer; employees is HR data without a profile FK. Add staff profile/invitation metadata rather than replacing Auth |
| services, categories, skills | Reuse catalog/taxonomy; add service_packages |
| creator_profiles, creator_categories, creator_skills, creator_portfolio, creator_reviews | Reuse managed talent; add publish/status/price range administration; account FK stays optional |
| leads | Keep public CONTACT enquiries; do not treat email-only leads as authenticated service requests |
| projects, project_services, project_status_history | Preserve legacy project flow; add nullable request/order/assigned-staff/creator relationships and separate execution state for new projects |
| quotations, quotation_items | Reuse totals/items. Add request_id, version, previous_version_id and revision policy; keep published versions immutable; drafts may be edited before publication |
| invoices | Keep historical financial documents; do not mistake invoice issue or completion for collection |
| payment_settings, payment_plans, payment_installments | Reuse bank configuration/plans and existing receipts; add order relation/payment kind/due date/verification history as needed |
| project_files, deliverables, revision_requests, project_milestones, project_team_members | Reuse production files/revisions/milestones/team, extend assignment/customer access for new orders |
| conversations, conversation_members, conversation_messages | Reuse member model/realtime. Add request/order links and typed commerce cards/events; keep legacy direct conversations |
| support_tickets, support_messages, project_messages | Keep support/legacy messages; don't duplicate them as new service requests or delete historic threads |
| notifications | Reuse event alerts; extend reliable routing/event payloads/preferences |
| audit_logs | Add nullable before/after/metadata/reason/IP with careful secret/PII redaction; retain existing records |
| portfolio, testimonials, partners, work_processes, website_settings | Reuse published content; remove fabricated UI fallbacks |
| project_applications, favorite_creators, saved_projects | Preserve marketplace records; proposals for managed requests need their own workflow semantics |
| mediahub_schema_migrations | Keep advisory locking/checksum ledger |
| order_contracts, contract_acknowledgments (022) | Versioned terms linked to exact accepted quote; immutable published history and APPLICATION evidence; no provider signature |
| order_payment_requests, order_payment_receipts (023) | Separate order-origin model preserves project-only plans; fixed amount/bank snapshot, pending reservation, owner report and immutable Admin MANUAL_BANK evidence |
| projects/project_milestones/order links (024) | Reuse legacy tables with nullable unique order origin, separate production_status, milestone intent key, explicit workflow guards and scoped reads |
| Still missing after 024 | Order deliverable/final-payment/acceptance gates, refund/adjustment ledger, commissions/commission_events, staff invitation lifecycle |

## First Migration: P0 permission alignment

Migration 019 updates existing function permission predicates: BUSINESS as customer-equivalent in project/report/support/payment/lead matching and ownership; explicitly denies unsupported support actors; active membership for conversation RLS. It preserves all six stored role choices in account management. No historic-role/status rewrite or financial backfill. Node and rollback-only SQL tests pass, and the migration is applied.

Migration 020 adds service_packages, requests, assignment history, private notes/attachment metadata, nullable conversation/notification/audit links and scoped request RPC/RLS. Catalog data is copied into a brief snapshot at creation; later package edits do not change it. A request/workspace is created atomically with idempotency, without creating a project/order. Current owner/assignment controls linked conversation access; transfer revokes prior staff. It reuses the private project-files bucket and preserves legacy threads. Applied after passing three rollback suites; ledger verification 004–020 passes. No historic commercial backfill. Applied 020 is immutable; its subsequent extension is described below.

## Migration Strategy

Migration 021 is applied and verified against ledger 004–021 and all four rollback suites. Adds creator_proposals, orders/order_items and selected-proposal links. Quotations/items are reused with nullable project_id and an exclusive request/project origin; existing rows stay project-based with nullable version metadata. New request quotes have version, predecessor, creator snapshot relation, revision policy and calculated deposit/remaining terms. Publication freezes content and items; customer reads require sent_at, including cancelled-draft isolation. Actor RPCs serialize selection, revision and acceptance under a request lock; unique constraints prevent repeated orders or live quote versions. Legacy API/RPC compatibility and scope revocation are verified. New orders do not imply payment/contract evidence. Future SQL starts at 022; applied files through 021 are immutable.

Migration 022 is applied and ledger 004–022 plus five rollback suites pass. Adds order_contracts/contract_acknowledgments, server content hash, published-term/evidence guards and service-only order_action. Customer reads exclude never-sent drafts. Exact owner/latest/unexpired terms, explicit acknowledgment and active assignee gate WAITING_PAYMENT. Transfers synchronize order/request/membership under request-first locking. Legacy payments/projects are unchanged; no signature, receipt, project or historical evidence is inferred. Future SQL starts at 023; applied files through 022 are immutable.

Migration 023 is applied and rechecked against ledger 004–023/six rollback suites. Adds order-origin requests and immutable manual-bank receipts instead of altering legacy project_id/stage uniqueness. Backend/RPC/RLS scope owner/current staff/Admin. Amounts are derived or bounded by accepted total minus verified/reserved sums. Customer reporting does not collect funds; Admin literal verification, exact amount/time and unique normalized bank reference creates the immutable receipt and can confirm the order. Request-first/order locking serializes competing order actions; no invoice/project/backfill or gateway call occurs. Future SQL starts at 024; applied files through 023 are immutable.

Migration 024 adds nullable order_id/production_status to projects and nullable milestone intent keys. Existing rows/legacy states stay unchanged. Verified confirmed-order creation copies request/accepted terms/services/creator team atomically and idempotently; receipt/acknowledgment evidence is checked independently of status. Project/child triggers, revoked legacy bases/wrappers and old API exclusion prevent bypass. Current order scope governs staff/customer reads; production and milestone transitions serialize under request/order/project locks. Legacy track_project behavior is retained for old origin; new events route through request conversation. Seven rollback suites and 61 HTTP/backend tests pass before application. Future SQL starts at 025; applied files through 024 are immutable.

1. Inspect real schema, ledger, policies/function definitions/buckets (completed read-only).
2. Write future additive migrations after 019. Never edit applied migration contents.
3. Verify under transaction with lock_timeout/statement_timeout; run existing and new assertions with synthetic rows, rollback everything.
4. Apply compatible permission-only migration only after successful verification. Schema/financial model migrations remain reviewable and require their own compatibility/data-risk checks.
5. Create new entities with FKs and nullable legacy links first; deploy read-compatible API before migrating entry points. New workflows require explicit origin/version marker.
6. Backfill only unambiguous ownership/catalog relationships. Do not generate signatures/payment receipts/order acceptance from historic statuses.
7. Migrate frontend submission/workspaces incrementally, preserving old URLs and API envelope. Decommission nothing until usage/history dependencies are understood.

## Relationships / Index Requirements

requests → customers, services/packages, preferred creator, assigned profile; assignments → request and active staff; quote → request/project, version; order → customer/request/accepted quote version; contract → order/request/quote version; payment → order/plan; project → order/customer/staff/creator; conversation → request/order/project. Unique constraints prevent repeated order conversion and multiple active quote versions/selections.

Indexes: customer + created_at, assignment + status + updated_at, request/order/quote FKs, version uniqueness, conversation + created_at/id cursor, payment reference and reconciliation/status/due_date, milestone deadline/status, commission staff/status/period. Existing project/payment/support/member indexes are reused.

## RLS Requirements

Published catalogs only for Guest; active own customer request/order/payment/project; staff assigned private data or deliberately reduced queue summaries; Admin according to management policy. Draft/internal notes never appear in customer reads. Active membership required for realtime. Service-role writes use server-verified actor and transaction authorization; authenticated users cannot supply arbitrary actor RPC arguments.

## Data Migration Risk

The largest risk is treating legacy projects as already confirmed commercial orders: there are no reliable contract/deposit records. Preserve legacy lifecycle as a compatibility path. Existing demo and real records coexist; never reset/reseed the database during refactor. No production data deletion is authorized or necessary. See [MIGRATION_RISK.md](MIGRATION_RISK.md) before running migration commands.
