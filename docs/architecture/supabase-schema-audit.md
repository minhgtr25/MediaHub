# Supabase schema audit

Inspected on 2026-10-23 using read-only PostgreSQL catalog queries, exact per-table and per-column counts, current function definitions, RLS policies, constraints, and source references. No row contents or credentials were collected.

## Current inventory

- The repository contains migrations `001`–`044`. The configured project's additive migration ledger contains `004`–`044`; `001`–`003` are baseline migrations and are not recorded there.
- The configured project has 73 public tables, 737 columns, one public view, 120 public SQL functions, 82 triggers and 81 RLS policies. There are 37 empty tables and 36 populated tables.
- The per-column scan found no table/view field without a detected reference through runtime source, SQL functions, triggers, constraints, indexes, RLS policies, view dependencies or broad table reads. The full field map is emitted by the audit script's `--json` mode.
- `npm run db:audit --prefix backend` rebuilds the backend and prints the summary. After the build, run `node backend/scripts/schema-inventory.mjs --json` from the repository root for the full table, column, count, constraint, policy, function and reference inventory.
- `npm run db:check --prefix backend` verifies migration checksums and validates all 18 SQL workflow suites in a rollback-only transaction. `npm run db:migrate --prefix backend` applies pending migrations to the project configured in `.env`.

## Removed tables and fields

| Migration | Change                                                                                                                                         | Evidence and guard                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 038       | Dropped `favorite_creators` and `saved_projects`.                                                                                              | Both were empty with no code, SQL function or incoming-FK references. The migration refuses non-empty tables and uses `DROP TABLE` without `CASCADE`.                                                                                            |
| 039       | Dropped `project_applications` and `creator_reviews`.                                                                                          | Each had 36 rows, all associated with Creator profiles explicitly marked demo. No callers, triggers or incoming FKs remained. The migration refuses unclassified/non-demo rows and uses `DROP TABLE` without `CASCADE`.                          |
| 040       | Dropped `creator_profiles.study_year`, `rating`, `review_count`, `completed_projects`, `completion_rate`, `response_rate` and `response_time`. | All 18 profiles were marked demo; these synthetic metrics had no live API/view/function caller. Verified metrics are derived from completed orders. The migration locks the table, refuses non-demo profiles and drops fields without `CASCADE`. |
| 041       | Dropped revoked RPCs `legacy_order_payment_action_028` and `legacy_public_completed_creator_reviews_036`.                                      | Both were superseded and explicitly revoked, with no current app or SQL-function callers. The rollback-only workflow checks passed; `DROP FUNCTION` uses no `CASCADE`.                                                                           |
| 042       | Deleted 54 `creator_portfolio` samples and 24 company `portfolio` case studies marked `is_demo`.                                               | All company samples were unpublished; all Creator samples belonged to demo profiles. The migration refuses published samples or items attached to non-demo profiles. No incoming FKs existed; no `CASCADE` is used.                              |
| 043       | Deactivated six demo `services` while preserving their rows for history.                                                                       | All six descriptions match the local demo seed signature. They had 12 references across requests, order items, project services and quotation items, so rows are retained and removed from the active customer catalog.                          |
| 044       | Removed 24 legacy demo projects and status rows, 12 conversations/memberships, 48 messages, 4 reviews/testimonials and 30 notifications. | Deterministic IDs and seeded field signatures must match; child references must be limited to the expected workflow rows. The migration refuses modified seed records or unexpected dependencies. |

All four retired tables and both revoked RPCs are absent from the current project. Migrations 037–044 are applied and recorded in its ledger. Legacy sample portfolios and workflow records no longer appear in Admin lists or public views.

## Tables retained

No additional table met the removal criteria. All 73 public tables have an application reference or a dependency through a SQL function, foreign key, or RLS policy. This includes seven empty tables without a direct app-source mention: `case_study_assets`, `creator_replacement_invites`, `creator_replacements`, `execution_delays`, `order_variation_acknowledgments`, `order_variation_quotes` and `project_team_members`. They are read or written by active workflow functions or guarded by relational dependencies. Empty means the workflow has not produced a record in this project's current data, not that its schema is obsolete.

Tables that look similar by name represent different active workflows: `portfolio` stores the company's published case studies, while `creator_portfolio` stores a Creator's samples; `leads` stores public enquiries/applications, while `requests` represents authenticated service work; `projects` and `quotations` support the legacy project flow, while `orders` and their contract/payment/production tables support the order flow. These have separate routes, states and access rules, so merging them would change behavior and data ownership rather than remove unused schema.

## Fields with no current values

The audit found 29 nullable fields with zero non-null values in their populated tables. Each is referenced in application source, SQL functions, or a database constraint, so they remain part of supported flows:

- `conversation_messages`: `reply_to_id`
- `conversations`: `project_id`
- `creator_proposals`: `response_note`
- `customers`: `industry`, `address`
- `leads`: `service_id`, `deadline`, `customer_id`, `assigned_to`, `attachment_path`, `attachment_name`, `attachment_size`, `project_id`, `applicant_type`
- `order_contracts`: `previous_version_id`, `response_reason`
- `orders`: `closed_by`
- `profiles`: `avatar_url`, `phone`
- `project_services`: `notes`
- `project_status_history`: `note`
- `projects`: `order_id`, `production_status`
- `quotations`: `project_id`
- `requests`: `package_id`, `package_snapshot`, `cancellation_reason`
- `skills`: `category_id`
- `support_tickets`: `assigned_to`

The 356 fields belonging to currently empty tables cannot be judged by their data counts; the schema audit includes their function, application, FK and policy dependencies. No other field was removed without a dependency and data check.

Migration 044 removed the exact unchanged deterministic legacy seed data: 24 projects and their status history, 12 conversations and memberships, 48 messages, 4 reviews and 4 testimonials, and 30 notifications. Modern orders, requests and Auth identities were not removed.

## Remaining demo-marked data

The 18 demo Creator profiles remain because they are linked to existing Auth profiles and workflow history, including 12 Auth profiles, 3 proposals, 2 orders and 1 request. Deleting them would require a separate decision about those accounts and records. The six service rows matching the demo seed description are inactive; their historical request/order references remain intact, and they no longer appear in the customer catalog.

## Supabase-managed schemas

The audit and cleanup cover the application's `public` schema. Supabase-managed schemas such as `auth`, `storage`, `realtime` and `extensions` are platform-owned and are not application cleanup targets. Authentication identities and platform metadata must be reviewed through their respective Supabase features rather than treated as stray public tables.
