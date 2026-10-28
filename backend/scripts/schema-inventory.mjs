import pg from "pg";
import { fileURLToPath } from "node:url";
import { loadEnvironment } from "../dist/config/env.js";

loadEnvironment();
const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();
  const tables = await client.query(`
    select n.nspname as schema, c.relname as table,
      c.reltuples::bigint as estimated_rows,
      coalesce(obj_description(c.oid), '') as comment
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname
  `);
  const columns = await client.query(`
    select table_name, column_name, ordinal_position, data_type,
      is_nullable, column_default, is_identity,
      coalesce(col_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass::oid, ordinal_position), '') as comment
    from information_schema.columns where table_schema = 'public'
    order by table_name, ordinal_position
  `);
  const constraints = await client.query(`
    select tc.table_name, tc.constraint_name, tc.constraint_type,
      kcu.column_name, ccu.table_name as foreign_table,
      ccu.column_name as foreign_column, rc.delete_rule,
      cc.check_clause
    from information_schema.table_constraints tc
    left join information_schema.key_column_usage kcu
      on tc.constraint_catalog=kcu.constraint_catalog and tc.constraint_schema=kcu.constraint_schema
      and tc.constraint_name=kcu.constraint_name and tc.table_name=kcu.table_name
    left join information_schema.constraint_column_usage ccu
      on tc.constraint_catalog=ccu.constraint_catalog and tc.constraint_schema=ccu.constraint_schema
      and tc.constraint_name=ccu.constraint_name
    left join information_schema.referential_constraints rc
      on tc.constraint_catalog=rc.constraint_catalog and tc.constraint_schema=rc.constraint_schema
      and tc.constraint_name=rc.constraint_name
    left join information_schema.check_constraints cc
      on tc.constraint_catalog=cc.constraint_catalog and tc.constraint_schema=cc.constraint_schema
      and tc.constraint_name=cc.constraint_name
    where tc.table_schema='public' order by tc.table_name, tc.constraint_name, kcu.ordinal_position
  `);
  const indexes = await client.query(`
    select tablename as table, indexname, indexdef
    from pg_indexes where schemaname='public' order by tablename, indexname
  `);
  const policies = await client.query(`
    select tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname='public' order by tablename, policyname
  `);
  const triggers = await client.query(`
    select event_object_table as table, trigger_name, action_timing,
      event_manipulation, action_statement
    from information_schema.triggers
    where trigger_schema='public' order by event_object_table, trigger_name
  `);
  const views = await client.query(`
    select table_name as view, view_definition
    from information_schema.views where table_schema='public'
    order by table_name
  `);
  const viewColumnUses = await client.query(`
    select view_name, table_name, column_name
    from information_schema.view_column_usage where view_schema='public'
    order by view_name, table_name, column_name
  `);
  const functions = await client.query(`
    select p.proname as function, pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' order by p.proname, arguments
  `);
  const counts = [];
  const columnCounts = [];
  for (const { table } of tables.rows) {
    const tableColumns = columns.rows
      .filter((column) => column.table_name === table)
      .map((column) => column.column_name);
    const result = await client.query(
      `select count(*)::bigint as rows, ${tableColumns
        .map(
          (column) =>
            `count(${pg.escapeIdentifier(column)})::bigint as ${pg.escapeIdentifier(column)}`,
        )
        .join(", ")} from public.${pg.escapeIdentifier(table)}`,
    );
    counts.push({ table, rows: Number(result.rows[0].rows) });
    for (const column of tableColumns) {
      columnCounts.push({
        table,
        column,
        rows: Number(result.rows[0][column]),
      });
    }
  }
  const demoCreatorDependencies = [];
  const creatorForeignKeys = new Map();
  for (const constraint of constraints.rows) {
    if (
      constraint.foreign_table !== "creator_profiles" ||
      !constraint.column_name ||
      !constraint.foreign_column
    )
      continue;
    creatorForeignKeys.set(
      `${constraint.table_name}.${constraint.column_name}.${constraint.foreign_column}`,
      constraint,
    );
  }
  for (const constraint of creatorForeignKeys.values()) {
    const result = await client.query(
      `select count(*)::bigint as rows from public.${pg.escapeIdentifier(constraint.table_name)} child join public.creator_profiles creator on child.${pg.escapeIdentifier(constraint.column_name)} = creator.${pg.escapeIdentifier(constraint.foreign_column)} where creator.is_demo`,
    );
    demoCreatorDependencies.push({
      table: constraint.table_name,
      column: constraint.column_name,
      rows: Number(result.rows[0].rows),
    });
  }
  const demoData = await client.query(`
    select 'creator_profiles' as table_name,
      count(*) filter (where is_demo) as demo_rows,
      count(*) filter (where not is_demo) as retained_rows
    from public.creator_profiles
    union all
    select 'creator_portfolio', count(*) filter (where is_demo),
      count(*) filter (where not is_demo)
    from public.creator_portfolio
    union all
    select 'portfolio', count(*) filter (where is_demo),
      count(*) filter (where not is_demo)
    from public.portfolio
  `);
  const demoGuards = await client.query(`
    select
      (select count(*) from public.creator_profiles where is_demo and profile_id is not null)::bigint as demo_creator_profiles_with_auth,
      (select count(*) from public.creator_portfolio item join public.creator_profiles creator on creator.id=item.creator_id where item.is_demo and not creator.is_demo)::bigint as demo_portfolio_items_on_real_creators,
      (select count(*) from public.portfolio where is_demo and published)::bigint as published_demo_company_cases,
      (select count(*) from public.services where active and description ilike '%demo%MediaHub:%')::bigint as active_demo_services,
      (select count(*) from public.projects where id in (select (lpad(to_hex(5000+g),8,'0')||'-1000-4000-8000-000000000001')::uuid from generate_series(0,23) g))::bigint as seeded_legacy_projects,
      (select count(*) from public.conversations where id in (select (lpad(to_hex(9000+g),8,'0')||'-1000-4000-8000-000000000001')::uuid from generate_series(0,11) g))::bigint as seeded_legacy_conversations,
      (select count(*) from public.conversation_messages where id in (select (lpad(to_hex(10000+g),8,'0')||'-1000-4000-8000-000000000001')::uuid from generate_series(0,47) g))::bigint as seeded_legacy_messages,
      (select count(*) from public.reviews where id in (select (lpad(to_hex(6500+g),8,'0')||'-1000-4000-8000-000000000001')::uuid from generate_series(0,18,6) g))::bigint as seeded_legacy_reviews,
      (select count(*) from public.notifications where id in (select (lpad(to_hex(8000+g),8,'0')||'-1000-4000-8000-000000000001')::uuid from generate_series(0,29) g))::bigint as seeded_legacy_notifications
  `);
  const sourceFiles = (
    await Promise.all(
      ["../src", "../scripts", "../../frontend/src"].map((directory) =>
        walkFiles(new URL(`${directory}/`, import.meta.url)),
      ),
    )
  ).flat();
  const source = sourceFiles
    .filter((file) => /\.(?:ts|tsx|js|mjs|mts)$/.test(file.name))
    .map((file) => file.contents)
    .join("\n");
  const runtimeFiles = sourceFiles.filter(
    (file) =>
      /\.(?:ts|tsx|js|mjs|mts)$/.test(file.name) &&
      !file.name.endsWith(".types.ts"),
  );
  const tableReferences = tables.rows.map(({ table }) => ({
    table,
    application_references: source.split(table).length - 1,
    sql_functions: functions.rows
      .filter(({ definition }) => definition.includes(table))
      .map(({ function: name, arguments: args }) => `${name}(${args})`),
    foreign_keys: constraints.rows
      .filter(
        (constraint) =>
          constraint.table_name === table || constraint.foreign_table === table,
      )
      .map(
        (constraint) => `${constraint.table_name}.${constraint.column_name}`,
      ),
    policies: policies.rows
      .filter(({ tablename }) => tablename === table)
      .map(({ policyname }) => policyname),
    rows: counts.find((entry) => entry.table === table).rows,
  }));
  const unusedValueColumns = columnCounts
    .filter(
      ({ table, rows }) =>
        rows === 0 && counts.find((entry) => entry.table === table).rows > 0,
    )
    .map(({ table, column }) => ({
      table,
      column,
      null_rows: counts.find((entry) => entry.table === table).rows,
      application_files: sourceFiles
        .filter(
          ({ contents }) =>
            contents.includes(table) && contents.includes(column),
        )
        .map(({ path }) => path),
      sql_functions: functions.rows
        .filter(
          ({ definition }) =>
            definition.includes(table) && definition.includes(column),
        )
        .map(({ function: name }) => name),
      constraints: constraints.rows
        .filter(
          (constraint) =>
            (constraint.table_name === table &&
              constraint.column_name === column) ||
            (constraint.foreign_table === table &&
              constraint.foreign_column === column),
        )
        .map(({ constraint_name }) => constraint_name),
    }));
  const columnReferences = columns.rows.map(({ table_name, column_name }) => {
    const isView = views.rows.some(({ view }) => view === table_name);
    const appFiles = runtimeFiles.filter(
      ({ contents }) =>
        contents.includes(column_name) &&
        (isView || contents.includes(table_name)),
    );
    const sqlFunctions = functions.rows.filter(
      ({ definition }) =>
        definition.includes(table_name) && definition.includes(column_name),
    );
    const columnTriggers = triggers.rows.filter(
      ({ table, action_statement }) => {
        if (table !== table_name) return false;
        const functionName = action_statement
          .match(/(?:public\.)?([\w"]+)\s*\(/)?.[1]
          ?.replaceAll('"', "");
        return functions.rows.some(
          (functionRow) =>
            functionRow.function === functionName &&
            functionRow.definition.includes(column_name),
        );
      },
    );
    const columnConstraints = constraints.rows.filter(
      (constraint) =>
        (constraint.table_name === table_name &&
          constraint.column_name === column_name) ||
        (constraint.foreign_table === table_name &&
          constraint.foreign_column === column_name) ||
        (constraint.table_name === table_name &&
          constraint.check_clause?.includes(column_name)),
    );
    const columnIndexes = indexes.rows.filter(
      ({ table, indexdef }) =>
        table === table_name && indexdef.includes(column_name),
    );
    const columnPolicies = policies.rows.filter(
      ({ tablename, qual, with_check }) =>
        tablename === table_name &&
        `${qual ?? ""} ${with_check ?? ""}`.includes(column_name),
    );
    const columnViews = viewColumnUses.rows.filter(
      (usage) =>
        usage.table_name === table_name && usage.column_name === column_name,
    );
    const broadReadFiles = runtimeFiles.filter(
      ({ contents }) =>
        contents.includes(table_name) &&
        /\.select\s*\(\s*(?:["']\*["'])?\s*\)/.test(contents),
    );
    return {
      table: table_name,
      column: column_name,
      non_null_rows:
        columnCounts.find(
          (item) => item.table === table_name && item.column === column_name,
        )?.rows ?? null,
      application_files: appFiles.map(({ path }) => path),
      sql_functions: sqlFunctions.map(({ function: name }) => name),
      triggers: columnTriggers.map(
        ({ trigger_name }) => `${table_name}.${trigger_name}`,
      ),
      constraints: columnConstraints.map(
        ({ constraint_name }) => constraint_name,
      ),
      indexes: columnIndexes.map(({ indexname }) => indexname),
      policies: columnPolicies.map(({ policyname }) => policyname),
      views: columnViews.map(({ view_name }) => view_name),
      broad_application_reads: broadReadFiles.map(({ path }) => path),
    };
  });
  const columnsWithoutDetectedReferences = columnReferences.filter(
    (reference) =>
      ![
        "application_files",
        "sql_functions",
        "triggers",
        "constraints",
        "indexes",
        "policies",
        "views",
        "broad_application_reads",
      ].some((key) => reference[key].length),
  );
  const inventory = {
    inspected_at: new Date().toISOString(),
    tables: tables.rows.map((row) => ({
      ...row,
      estimated_rows: Number(row.estimated_rows),
    })),
    columns: columns.rows.map((row) => ({
      ...row,
      ordinal_position: Number(row.ordinal_position),
    })),
    constraints: constraints.rows,
    indexes: indexes.rows.map(({ indexdef, ...summary }) => summary),
    policies: policies.rows,
    triggers: triggers.rows,
    views: views.rows.map(({ view }) => view),
    functions: functions.rows.map(({ definition, ...summary }) => summary),
    counts,
    demo_data: demoData.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === "string" && /^\d+$/.test(value)
            ? Number(value)
            : value,
        ]),
      ),
    ),
    demo_data_guards: Object.fromEntries(
      Object.entries(demoGuards.rows[0]).map(([key, value]) => [
        key,
        Number(value),
      ]),
    ),
    demo_creator_dependencies: demoCreatorDependencies,
    column_counts: columnCounts,
    table_references: tableReferences,
    column_references: columnReferences,
    columns_without_detected_references: columnsWithoutDetectedReferences,
    unused_value_columns: unusedValueColumns,
  };
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(inventory, null, 2));
  } else {
    const emptyTables = inventory.counts.filter(({ rows }) => rows === 0);
    const emptyTableNames = new Set(emptyTables.map(({ table }) => table));
    const emptyTableColumns = inventory.columns.filter(({ table_name }) =>
      emptyTableNames.has(table_name),
    ).length;
    const unreferencedTables = inventory.table_references.filter(
      (entry) =>
        !entry.application_references &&
        !entry.sql_functions.length &&
        !entry.foreign_keys.length &&
        !entry.policies.length,
    );
    const unreferencedEmptyTables = emptyTables.filter((table) =>
      unreferencedTables.some((candidate) => candidate.table === table.table),
    );
    const triggerCount = new Set(
      inventory.triggers.map(
        ({ table, trigger_name }) => `${table}.${trigger_name}`,
      ),
    ).size;
    const demoSummary = inventory.demo_data
      .map(
        ({ table_name, demo_rows, retained_rows }) =>
          `${table_name}: ${demo_rows} classified, ${retained_rows} other`,
      )
      .join("; ");
    const seedRows = inventory.demo_data_guards;
    process.stdout.write(
      [
        `Supabase schema inspected at ${inventory.inspected_at}`,
        `${inventory.tables.length} public tables, ${inventory.columns.length} columns, ${inventory.views.length} views, ${inventory.functions.length} SQL functions, ${triggerCount} triggers and ${inventory.policies.length} RLS policies.`,
        `${emptyTables.length} tables are empty; ${unreferencedEmptyTables.length} empty tables have no application, function, foreign-key or policy references.`,
        `${emptyTableColumns} fields belong to currently empty tables and are retained for referenced workflows.`,
        `${inventory.unused_value_columns.length} nullable fields have no non-null values in currently populated tables; ${inventory.unused_value_columns.filter((column) => column.application_files.length || column.sql_functions.length || column.constraints.length).length} are referenced by app code, SQL functions or constraints.`,
        `${inventory.columns_without_detected_references.length} public table/view columns have no detected source, SQL, trigger, constraint, index, RLS or view reference.`,
        `Demo data counts: ${demoSummary}.`,
        `Legacy demo seed rows: ${seedRows.seeded_legacy_projects} projects, ${seedRows.seeded_legacy_conversations} conversations, ${seedRows.seeded_legacy_messages} messages, ${seedRows.seeded_legacy_reviews} reviews and ${seedRows.seeded_legacy_notifications} notifications.`,
        "Run with --json to print the full schema and dependency inventory.",
      ].join("\n") + "\n",
    );
  }
} finally {
  await client.end();
}

async function walkFiles(directoryUrl) {
  const { readdir, readFile } = await import("node:fs/promises");
  let entries;
  try {
    entries = await readdir(directoryUrl, { withFileTypes: true });
  } catch {
    return [];
  }
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const url = new URL(
          `${entry.name}${entry.isDirectory() ? "/" : ""}`,
          directoryUrl,
        );
        return entry.isDirectory()
          ? walkFiles(url)
          : {
              name: entry.name,
              path: fileURLToPath(url),
              contents: await readFile(url, "utf8"),
            };
      }),
    )
  ).flat();
}
