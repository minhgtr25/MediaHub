import fs from "node:fs/promises";

const suites = [
  "workflow.sql",
  "authorization.sql",
  "requests.sql",
  "commerce.sql",
  "contracts.sql",
  "order-payments.sql",
  "production.sql",
  "dispatch.sql",
  "profile-avatars.sql",
  "order-feedback.sql",
  "service-chat.sql",
  "creator-team.sql",
  "staff-finance.sql",
  "company-intake.sql",
  "order-variations.sql",
  "execution-coordination.sql",
  "creator-profiles.sql",
  "account-content.sql",
];

export async function runWorkflowSuites(client) {
  // Keep older explicit-assignment fixtures independent of the newer policy.
  await client.query(
    "update public.staff_dispatch_settings set enabled=false where id",
  );
  await client.query(
    "update public.creator_team_settings set enabled=false where id",
  );

  for (const name of suites) {
    const sql = await fs.readFile(
      new URL(`../test/${name}`, import.meta.url),
      "utf8",
    );
    await client.query(sql);
    console.log(`Validated SQL suite ${name}`);
  }
}
