import test from "node:test";
import assert from "node:assert/strict";
import { shouldSkipMigration } from "../scripts/migration-preconditions.mjs";

function clientWith(total, active) {
  return {
    query: async () => ({ rows: [{ total, active }] }),
  };
}

test("unrelated migrations do not run demo data preconditions", async () => {
  assert.equal(
    await shouldSkipMigration("042_example.sql", clientWith(0, 0)),
    false,
  );
});

test("demo service cleanup skips an empty catalog on a new Supabase project", async () => {
  assert.equal(
    await shouldSkipMigration(
      "043_deactivate_demo_services.sql",
      clientWith(0, 0),
    ),
    true,
  );
});

test("demo service cleanup skips rows already inactive", async () => {
  assert.equal(
    await shouldSkipMigration(
      "043_deactivate_demo_services.sql",
      clientWith(6, 0),
    ),
    true,
  );
});

test("demo service cleanup runs when all six seeded rows are active", async () => {
  assert.equal(
    await shouldSkipMigration(
      "043_deactivate_demo_services.sql",
      clientWith(6, 6),
    ),
    false,
  );
});

test("demo service cleanup stops on a partial or unclassified seed", async () => {
  await assert.rejects(
    shouldSkipMigration("043_deactivate_demo_services.sql", clientWith(6, 3)),
    /consistent state/,
  );
  await assert.rejects(
    shouldSkipMigration("043_deactivate_demo_services.sql", clientWith(2, 2)),
    /consistent state/,
  );
});
