const demoServiceCleanup = "043_deactivate_demo_services.sql";

export async function shouldSkipMigration(name, client) {
  if (name !== demoServiceCleanup) return false;

  const result = await client.query(`
    select count(*)::integer as total,
      count(*) filter (where active)::integer as active
    from public.services
    where description ilike '%demo%MediaHub:%'
  `);
  const total = result.rows[0].total;
  const active = result.rows[0].active;

  if (![0, 6].includes(total) || ![0, 6].includes(active)) {
    throw new Error(
      `Expected zero or six demo services in a consistent state; found ${active} active of ${total}.`,
    );
  }

  return total === 0 || active === 0;
}
