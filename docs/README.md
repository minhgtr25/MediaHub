# Documentation

This index points to the maintained workflow and setup documents. SQL migrations under `../supabase/migrations/` define the database schema and policies. Progress reports and audits record dated evidence; they do not describe the live Supabase project unless their evidence was checked again.

## Getting started and operations

- [Local development, database migrations and deployment](operations/deployment.md)
- [Production audit, 2026-09-11](operations/production-audit-2026-09-11.md) — historical baseline
- [Production verification, 2026-09-12](operations/production-qa-2026-09-12.md) — historical evidence

## Business workflows

- [Approved service workflow](business/business-flow.md)
- [Roles and permissions](business/role-permission-matrix.md)
- [Request intake](business/company-intake.md)
- [Creator marketplace and profiles](business/creator-marketplace.md), [professional profiles](business/creator-profiles.md)
- [Company portfolio](business/company-portfolio.md) and [public account/content behavior](business/account-and-public-content.md)
- [Order production](business/production-workflow.md), [variations and coordination](business/order-variations.md), and [completed-project review](business/completed-project-review.md)
- [Contract](business/contract-integration.md) and [payment](business/payment-integration.md) boundaries
- [Service chat](business/service-chat.md)

## Architecture and design

- [Repository audit](architecture/repository-audit.md) — dated findings; verify against current code
- [Database refactor plan](architecture/database-refactor-plan.md)
- [Supabase schema audit](architecture/supabase-schema-audit.md) — live catalog snapshot and retirement decisions
- [Supabase data dictionary](architecture/supabase-data-dictionary.md) — plain-language map of all public tables by workflow
- [Migration risk register](architecture/migration-risk.md)
- [Brand identity](design/brand-identity.md), [design rules](design/design-rules.md), and [UI/UX requirements](design/ui-ux-supplement.md)

## Plans and implementation records

- [Approved implementation scope](planning/implementation-plan.md)
- [Codebase cleanup checklist](planning/refactor-checklist.md) — current cleanup evidence and remaining verification
- [Latest recorded implementation checkpoint](planning/refactor-progress.md)
- [Vietnamese development notes](planning/development-progress-vi.md) — retained historical record

When documents conflict, use this order: current code and applied migration ledger for implementation state; `business-flow.md` and `role-permission-matrix.md` for approved product behavior; `implementation-plan.md` for the approved refactor scope. Older audits and progress reports are historical evidence.
