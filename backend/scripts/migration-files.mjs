import fs from "node:fs/promises";

const migrationDirectory = new URL(
  "../../supabase/migrations/",
  import.meta.url,
);

export const migrationFiles = (await fs.readdir(migrationDirectory))
  .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
  .filter((name) => Number(name.slice(0, 3)) >= 4)
  .sort((left, right) => Number(left.slice(0, 3)) - Number(right.slice(0, 3)));
