import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
import { loadEnvironment } from "../dist/config/env.js";
import { runWorkflowSuites } from "./run-workflow-suites.mjs";
import { migrationFiles } from "./migration-files.mjs";
import { shouldSkipMigration } from "./migration-preconditions.mjs";
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
  for (const name of migrationFiles) {
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
    const skipped = await shouldSkipMigration(name, client);
    if (!skipped) {
      await client.query(
        sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, ""),
      );
    }
    await client.query(
      "insert into public.mediahub_schema_migrations(name,checksum) values($1,$2)",
      [name, checksum],
    );
    console.log(`${skipped ? "Recorded no-op" : "Applied"} ${name}`);
  }
  await client.query("savepoint verification");
  await runWorkflowSuites(client);
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
