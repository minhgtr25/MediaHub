# Creator directory and marketplace data

MediaHub uses Supabase PostgreSQL for application data, Supabase Auth for accounts and Supabase Storage for media. The Express API uses the service-role client; the service-role key must never reach the browser.

## Current managed Creator workflow

- `creator_profiles` stores a managed professional profile. `profiles` links a Creator account when the Creator is onboarded.
- `creator_categories`, `creator_skills` and `creator_portfolio` store discovery data; category and skill catalogs are shared.
- `creator_company_agreements` records the Admin-managed company relationship.
- `request_creator_selections`, `creator_assignments` and `creator_proposals` store the current request and order workflow.
- Public discovery uses a restricted database projection and completed-order review data. Private account, contract and contact fields stay out of the public response.

## Legacy marketplace records

`project_applications` and `creator_reviews` belonged to the older open marketplace workflow. The configured database contained 36 rows in each table; every row linked to a Creator profile classified by migration 037 as synthetic demo content. Neither table had current application callers, database functions, triggers or incoming foreign keys. Migration 039 removed them after rechecking each row and uses no `CASCADE`.

The unused `favorite_creators` and `saved_projects` shortlist tables were empty, had no application or RPC callers and had no dependent tables in the configured database. Migration `038_remove_unused_shortlists.sql` retires them with an emptiness check and `RESTRICT` behavior.

## Demo data

`backend/scripts/seed-demo.mjs` is limited to a local Supabase URL and requires `MEDIAHUB_ALLOW_DEMO_SEED=true`. Demo account creation also requires a password supplied through the local-only `MEDIAHUB_DEMO_PASSWORD` environment variable. Never run demo seeding against a hosted or production project.
