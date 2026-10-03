import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:59999";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
const { app } = await import("../dist/app.mjs");
const { db } = await import("../dist/db.js");
const profileId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const ticketId = "55555555-5555-4555-8555-555555555555";
const planId = "66666666-6666-4666-8666-666666666666";
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const headers = { Authorization: "Bearer test-only" };

// Behavior-oriented HTTP fixture: query predicates determine returned records.
// No network calls or live business records are used by these tests.
async function withIdentity(role, run, { active = true, hasCustomer = true } = {}) {
  const original = { from: db.from, getUser: db.auth.getUser, rpc: db.rpc };
  const calls = [], mutations = [];
  const data = {
    profiles: [{ id: profileId, auth_user_id: profileId, role, active, full_name: "Owner", email: "owner@example.invalid" }],
    customers: hasCustomer ? [{ id: customerId, profile_id: profileId }] : [],
    projects: [
      { id: projectId, customer_id: customerId, title: "Mine", order_id: null },
      { id: otherId, customer_id: otherId, title: "Private other", order_id: null },
    ],
    support_tickets: [
      { id: ticketId, customer_id: customerId, assigned_to: profileId, subject: "Mine" },
      { id: otherId, customer_id: otherId, assigned_to: otherId, subject: "Private other" },
    ],
    support_messages: [],
    payment_plans: [
      { id: planId, project_id: projectId },
      { id: otherId, project_id: otherId },
    ],
    payment_installments: [{ id: planId, plan_id: planId }, { id: otherId, plan_id: otherId }],
    quotations: [{ id: planId, project_id: projectId, status: "DRAFT" }, { id: projectId, project_id: projectId, status: "SENT" }],
    invoices: [{ id: planId, project_id: projectId, status: "DRAFT" }, { id: projectId, project_id: projectId, status: "PENDING" }],
    project_services: [], project_files: [], project_status_history: [], deliverables: [], revision_requests: [], reviews: [],
  };
  db.auth.getUser = async () => ({ data: { user: { id: profileId } }, error: null });
  db.from = table => {
    calls.push(table);
    let rows = [...(data[table] ?? [])];
    const builder = {
      select() { return this; },
      insert(value) { mutations.push({ name: table, args: value }); return this; },
      eq(field, value) { if (!field.includes(".")) rows = rows.filter(r => r[field] === value); return this; },
      neq(field, value) { rows = rows.filter(r => r[field] !== value); return this; },
      is(field, value) { rows = rows.filter(r => r[field] === value); return this; },
      in(field, values) { rows = rows.filter(r => values.includes(r[field])); return this; },
      order() { return this; }, ilike() { return this; }, or() { return this; },
      range(start, end) { const count = rows.length; return Promise.resolve({ data: rows.slice(start, end + 1), error: null, count }); },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
    };
    return builder;
  };
  db.rpc = async (name, args) => { mutations.push({ name, args }); return { data: { id: ticketId }, error: null }; };
  try { await run({ calls, mutations }); }
  finally { db.from = original.from; db.auth.getUser = original.getUser; db.rpc = original.rpc; }
}

for (const role of ["CUSTOMER", "BUSINESS"]) {
  test(`${role} collections contain only owned projects/support/payment and hide drafts`, async () => {
    await withIdentity(role, async () => {
      for (const [path, id] of [["/projects", projectId], ["/support", ticketId], ["/payments", planId]]) {
        const response = await fetch(base + "/api" + path, { headers });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.data.items.map(row => row.id), [id]);
      }
      const response = await fetch(base + "/api/projects/" + projectId, { headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.data.quotations.map(q => q.status), ["SENT"]);
      assert.deepEqual(body.data.invoices.map(i => i.status), ["PENDING"]);
      for (const path of ["/projects/", "/support/"])
        assert.equal((await fetch(base + "/api" + path + otherId, { headers })).status, 404);
    });
  });
  test(`${role} cannot claim/assign/change support status or access admin/payment management`, async () => {
    await withIdentity(role, async ({ mutations }) => {
      for (const operation of ["claim", "assign", "status"]) {
        const body = operation === "assign" ? { assigned_to: profileId } : operation === "status" ? { status: "CLOSED" } : {};
        assert.equal((await fetch(`${base}/api/support/${ticketId}/${operation}`, {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
        })).status, 403);
      }
      assert.equal((await fetch(base + "/api/payments/eligible-projects", { headers })).status, 403);
      assert.equal((await fetch(base + "/api/admin/users", { headers })).status, 403);
      assert.equal(mutations.length, 0);
    });
  });
}
for (const role of ["CREATOR", "STUDENT_CREATOR"]) {
  test(`${role} cannot query private commerce/support/payment surfaces`, async () => {
    await withIdentity(role, async ({ calls }) => {
      for (const path of ["/projects", "/projects/" + projectId, "/support", "/support/" + ticketId, "/payments", "/payments/settings", "/customer/invoices", "/admin/users"])
        assert.equal((await fetch(base + "/api" + path, { headers })).status, 403);
      assert.equal(calls.includes("projects"), false);
      assert.equal(calls.includes("support_tickets"), false);
      assert.equal(calls.includes("payment_plans"), false);
    });
  });
}
test("staff may open only assigned support, not another assignment or legacy commerce", async () => {
  await withIdentity("STAFF", async () => {
    assert.equal((await fetch(`${base}/api/support/${ticketId}`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/api/support/${otherId}`, { headers })).status, 404);
    for (const path of ["/projects", "/payments", "/admin/users"])
      assert.equal((await fetch(base + "/api" + path, { headers })).status, 403);
  });
});
test("admin retains collection access and draft visibility", async () => {
  await withIdentity("ADMIN", async () => {
    const response = await fetch(base + "/api/projects", { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.items.length, 2);
    const detail = await (await fetch(`${base}/api/projects/${projectId}`, { headers })).json();
    assert.equal(detail.data.quotations.length, 2);
    assert.equal(detail.data.invoices.length, 2);
  });
});
test("inactive and incomplete business accounts cannot read private data", async () => {
  for (const options of [{ active: false }, { hasCustomer: false }])
    await withIdentity("BUSINESS", async ({ calls }) => {
      assert.equal((await fetch(base + "/api/projects", { headers })).status, 403);
      assert.equal(calls.includes("projects"), false);
    }, options);
});
test("guest project-request submission requires login before persistence", async () => {
  await withIdentity("CUSTOMER", async ({ calls }) => {
    const response = await fetch(base + "/api/public/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: "Guest", email: "guest@example.invalid", message: "Brief", source: "PROJECT_REQUEST" }),
    });
    assert.equal(response.status, 401);
    assert.equal(calls.includes("leads"), false);
  });
});
test("payment amount overposting never reaches the transactional RPC", async () => {
  await withIdentity("ADMIN", async ({ mutations }) => {
    const response = await fetch(`${base}/api/payments/${projectId}/create-plan`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ deposit_percent: 30, amount: 1, total: 1 }),
    });
    assert.equal(response.status, 422);
    assert.equal(mutations.length, 0);
  });
});

test("public contact enquiries remain available without authentication", async () => {
  await withIdentity("CUSTOMER", async ({ calls, mutations }) => {
    const response = await fetch(base + "/api/public/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: "Visitor", email: "visitor@example.invalid", message: "Contact", source: "CONTACT" }),
    });
    assert.equal(response.status, 201);
    assert.equal(calls.includes("profiles"), false);
    assert.equal(mutations[0].name, "leads");
    assert.equal(mutations[0].args.email, "visitor@example.invalid");
  });
});

test("business project enquiries use the verified identity rather than submitted contact fields", async () => {
  await withIdentity("BUSINESS", async ({ mutations }) => {
    const response = await fetch(base + "/api/public/leads", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: "Another person", email: "another@example.invalid", message: "Brief", source: "PROJECT_REQUEST" }),
    });
    assert.equal(response.status, 201);
    assert.equal(mutations[0].args.email, "owner@example.invalid");
    assert.equal(mutations[0].args.full_name, "Owner");
  });
});

test("support detail identifies assigned staff before any message is sent", async () => {
  await withIdentity("CUSTOMER", async () => {
    const response = await fetch(`${base}/api/support/${ticketId}`, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.messages, []);
    assert.equal(body.data.assigned_staff.id, profileId);
    assert.equal(body.data.assigned_staff.full_name, "Owner");
  });
});
