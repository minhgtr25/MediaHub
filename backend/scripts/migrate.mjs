import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
import { loadEnvironment } from "../dist/config/env.js";
loadEnvironment();
if (!process.argv.includes("--apply"))
  throw new Error(
    "Use --apply to apply reviewed additive migrations to the configured database.",
  );
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query("begin");
  await client.query(
    "set local lock_timeout='5s'; set local statement_timeout='30s'",
  );
  await client.query("select pg_advisory_xact_lock(736231929)");
  const baseline = await client.query(
    "select to_regclass('public.profiles') as profiles, to_regprocedure('public.dashboard_report(uuid)') as reporting",
  );
  if (!baseline.rows[0].profiles || !baseline.rows[0].reporting)
    throw new Error("Apply baseline Supabase migrations 001–003 first.");
  await client.query(`create table if not exists public.mediahub_schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now());
 alter table public.mediahub_schema_migrations enable row level security;
 revoke all on public.mediahub_schema_migrations from anon,authenticated;`);
  for (const name of [
    "004_leads.sql",
    "005_content_and_communication.sql",
    "006_workflow_extensions.sql",
    "007_account_management.sql",
    "008_catalog_details.sql",
    "009_lead_attachments.sql",
    "010_profile_preferences.sql",
    "011_project_management.sql",
    "012_quotation_drafts.sql",
    "013_lead_project_conversion.sql",
    "014_support_and_payments.sql",
    "015_staff_account_management.sql",
    "016_creator_marketplace.sql",
    "017_marketplace_social.sql",
    "018_realtime_messenger.sql",
    "019_role_authorization_alignment.sql",
    "020_service_requests.sql",
    "021_proposals_quote_versions_orders.sql",
    "022_order_contract_acknowledgment.sql",
    "023_order_payment_requests.sql",
    "024_order_production_foundation.sql",
    "025_staff_consultation_dispatch.sql",
    "026_profile_avatars.sql",
    "027_creator_team_confirmation.sql",
    "028_staff_financial_reporting.sql",
    "029_production_delivery.sql",
    "030_completed_order_reviews.sql",
    "031_company_intake.sql",
    "032_company_portfolio.sql",
    "033_service_chat.sql",
    "034_order_variations.sql",
    "035_execution_coordination.sql",
    "036_creator_profiles_discovery.sql",
  ]) {
    const sql = await fs.readFile(
      new URL(`../../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256")
      .update(sql.replace(/\r\n/g, "\n"))
      .digest("hex");
    const previous = await client.query(
      "select checksum from public.mediahub_schema_migrations where name=$1",
      [name],
    );
    if (previous.rowCount) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error(`Applied migration checksum changed: ${name}`);
      continue;
    }
    await client.query(
      sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, ""),
    );
    await client.query(
      "insert into public.mediahub_schema_migrations(name,checksum) values($1,$2)",
      [name, checksum],
    );
    console.log(`Applied ${name}`);
  }
  await client.query("savepoint verification");
  await client.query("update public.staff_dispatch_settings set enabled=false where id");
  await client.query("update public.creator_team_settings set enabled=false where id");
  await client.query(
    await fs.readFile(new URL("../test/workflow.sql", import.meta.url), "utf8"),
  );
  await client.query(await fs.readFile(new URL("../test/authorization.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/requests.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/commerce.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/contracts.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/order-payments.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/production.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/dispatch.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/profile-avatars.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/order-feedback.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/service-chat.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/creator-team.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/staff-finance.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/company-intake.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/order-variations.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/execution-coordination.sql", import.meta.url), "utf8"));
  await client.query(await fs.readFile(new URL("../test/creator-profiles.sql", import.meta.url), "utf8"));
  await client.query("rollback to savepoint verification");
  await client.query("notify pgrst, 'reload schema'");
  await client.query("commit");
  console.log(
    "Committed migrations; workflow assertions passed; test data was rolled back.",
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("Migration failed:", error.code ?? error.name, error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
