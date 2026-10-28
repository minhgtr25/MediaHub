import fs from "node:fs/promises";
import pg from "pg";
import { createHash } from "node:crypto";
import { loadEnvironment } from "../dist/config/env.js";
import { runWorkflowSuites } from "./run-workflow-suites.mjs";
import { migrationFiles } from "./migration-files.mjs";
import { shouldSkipMigration } from "./migration-preconditions.mjs";
loadEnvironment();
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
  const ledger = await client.query(
    "select to_regclass('public.mediahub_schema_migrations') as name",
  );
  for (const name of migrationFiles) {
    const sql = await fs.readFile(
      new URL(`../../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    );
    if (ledger.rows[0].name) {
      const prior = await client.query(
        "select checksum from public.mediahub_schema_migrations where name=$1",
        [name],
      );
      if (prior.rowCount) {
        if (
          prior.rows[0].checksum !==
          createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex")
        )
          throw new Error(`Applied migration checksum changed: ${name}`);
        console.log(`Verified applied migration ${name}`);
        continue;
      }
    }
    if (await shouldSkipMigration(name, client)) {
      console.log(`Skipped empty-data migration ${name}`);
      continue;
    }
    await client.query(
      sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, ""),
    );
    console.log(`Validated migration ${name}`);
  }
  await runWorkflowSuites(client);
  console.log(
    "Validated transactional workflow, ownership and RLS assertions.",
  );
  await client.query("rollback");
  console.log("Rolled back all schema changes and test data.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(
    "Migration check failed:",
    error.code ?? error.name,
    error.message,
    error.where ?? "",
    error.position ?? "",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
