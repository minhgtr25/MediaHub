# MediaHub

React/TypeScript/Vite, Express/TypeScript, Supabase PostgreSQL/Auth/Storage.

- [Setup and deployment](docs/deployment.md)
- [Architecture audit](docs/production-audit.md)
- [Production verification status](docs/production-qa.md)
- [Current repository and business audit](PROJECT_AUDIT.md)
- [Refactor checklist](MEDIAHUB_REFACTOR_CHECKLIST.md) and [verified progress](REFACTOR_PROGRESS.md)
- [Business flow](BUSINESS_FLOW.md), [role permissions](ROLE_PERMISSION_MATRIX.md), [database plan](DATABASE_REFACTOR_PLAN.md) and [design rules](DESIGN_RULES.md)

Migrations 019–024 are applied to the configured database. Scoped requests, proposals, quote versions, orders, contract acknowledgment, manual bank payment requests and order production planning/milestones are implemented. Immutable verified receipts can confirm an eligible order; staff then creates and starts production. Deliverable approval/final payment/completion, refunds and provider-backed signatures/gateway remain pending. Legacy project/payment history is preserved. Use [current progress](REFACTOR_PROGRESS.md), [contract boundaries](CONTRACT_INTEGRATION.md), [payment boundaries](PAYMENT_INTEGRATION.md) and [production foundation](PRODUCTION_WORKFLOW.md) for verification and release limits.

Use Node.js 24. Copy `.env.example` to `.env`, configure Supabase, then run `npm ci --prefix backend --ignore-scripts` and `npm ci --prefix frontend --ignore-scripts`. Start each app with its `npm run dev` script. Never put private credentials in a `VITE_` variable.

For the requested local role tests, `npm run db:test-accounts --prefix backend` provisions six confirmed test identities using the explicitly requested shared test password. The script assigns roles through the existing administrator RPC and verifies sign-in; it only updates identities recorded as belonging to this test batch. Read credentials from the Git/Docker-ignored `.qa/ROLE_TEST_ACCOUNTS.md`. Run `npm run db:verify-test-accounts --prefix backend` for read-only login/permission checks. Both commands use the Supabase project configured in `.env`; they do not start an isolated local Supabase server.
