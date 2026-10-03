import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:59999";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
const { app, apiLimiter } = await import("../dist/app.mjs");
const { db } = await import("../dist/db.js");
const pid = "11111111-1111-4111-8111-111111111111", customer = "22222222-2222-4222-8222-222222222222";
const mine = "33333333-3333-4333-8333-333333333333", other = "44444444-4444-4444-8444-444444444444";
const queued = "55555555-5555-4555-8555-555555555555", service = "66666666-6666-4666-8666-666666666666";
const conversation = "77777777-7777-4777-8777-777777777777", file = "88888888-8888-4888-8888-888888888888";
const key = "99999999-9999-4999-8999-999999999999";
let server, base;
before(async () => { server = app.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => new Promise(resolve => server.close(resolve)));
const headers = { Authorization: "Bearer test-only" };
const post = (path, body = {}) => fetch(base + path, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
// HTTP fixtures honor both predicates and SELECT projection: queue assertions
// catch private-data leaks rather than merely checking which query was issued.
async function identity(role, run) {
  // Isolate HTTP fixture budgets; keep the production limiter enabled.
  apiLimiter.resetKey("127.0.0.1");
  const original = { from: db.from, getUser: db.auth.getUser, rpc: db.rpc, storage: db.storage.from };
  const calls = [], mutations = [], storage = [];
  const request = { id: mine, customer_id: customer, assigned_to: pid, service_id: service, package_id: null, request_number: "MH-R-1", title: "Owned", brief: "Private brief", reference_urls: ["https://example.com/private"], status: "CONSULTING", budget_min: null, budget_max: null, deadline: null, created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" };
  const tables = {
    profiles: [{ id: pid, auth_user_id: pid, role, active: true, full_name: "Test", email: "test@example.invalid" }],
    customers: [{ id: customer, profile_id: pid, company_name: "Test" }],
    requests: [request, { ...request, id: other, customer_id: other, assigned_to: other }, { ...request, id: queued, customer_id: other, assigned_to: null, status: "UNASSIGNED" }],
    creator_profiles: [{id:file,profile_id:pid,display_name:"Owned Creator",slug:"owned",title:"Video",availability:"AVAILABLE"}],
    creator_assignments: [{id:key,creator_id:file,request_id:mine,status:"ACCEPTED",proposal_id:file,work_scope:"Video",expires_at:"2026-10-04T00:00:00Z"},{id:other,creator_id:other,request_id:other,status:"ACCEPTED"}],
    creator_progress_updates: [],request_creator_selections: [],creator_company_agreements: [],
    services: [{ id: service, name: "Service", active: true }],
    service_packages: [{ id: file, service_id: service, name: "Live", active: true }, { id: other, service_id: service, name: "Draft", active: false }],
    conversations: [{ id: conversation, request_id: mine }],
    conversation_members: [{ conversation_id: conversation, profile_id: pid, last_read_at: null }],
    conversation_messages: Array.from({ length: 55 }, (_, i) => ({ id: `${String(i + 1).padStart(8, "0")}-0000-4000-8000-000000000000`, conversation_id: conversation, sender_id: pid, content: `Message ${i + 1}`, kind: "TEXT", event_data: {}, audience: i % 2 ? "TEAM" : "CUSTOMER_STAFF", created_at: "2026-10-03T00:00:00+00:00" })),
    request_notes: [{ id: file, request_id: mine, author_id: pid, content: "Private note" }], request_assignments: [],
    request_attachments: [{ id: file, request_id: other, storage_path: "private-other-file" }],
  };
  db.auth.getUser = async () => ({ data: { user: { id: pid } }, error: null });
  db.from = table => {
    calls.push(table);
    let rows = [...(tables[table] ?? [])], fields = "*", limit = Infinity, head = false;
    const orders = [];
    const project = row => fields === "*" ? row : Object.fromEntries(fields.split(",").filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]));
    const result = () => {
      const sorted = [...rows].sort((a, b) => {
        for (const [field, options] of orders) {
          const cmp = String(a[field] ?? "").localeCompare(String(b[field] ?? ""));
          if (cmp) return options?.ascending === false ? -cmp : cmp;
        }
        return 0;
      });
      return { data: head ? null : sorted.slice(0, limit).map(project), count: rows.length, error: null };
    };
    const q = {
      select(value = "*", options = {}) { fields = value; head = !!options.head; return this; },
      eq(field, value) { rows = rows.filter(r => r[field] === value); return this; },
      neq(field, value) { rows = rows.filter(r => r[field] !== value); return this; },
      is(field, value) { rows = rows.filter(r => r[field] === value); return this; },
      not(field, operator, value) { if (operator === "is" && value === null) rows = rows.filter(r => r[field] != null); return this; },
      in(field, values) { rows = rows.filter(r => values.includes(r[field])); return this; },
      order(field, options) { orders.push([field, options]); return this; },
      limit(value) { limit = value; return this; },
      ilike() { return this; },
      or(value) {
        const match = /id\.lt\.([0-9a-f-]+)/.exec(value);
        if (match) rows = rows.filter(r => r.id < match[1]);
        return this;
      },
      range(start, end) { const value = result(); return Promise.resolve({ ...value, data: value.data.slice(start, end + 1) }); },
      maybeSingle: async () => ({ data: result().data?.[0] ?? null, error: null }),
      single: async () => ({ data: result().data?.[0] ?? null, error: null }),
      insert(value) { mutations.push({ table, value }); return this; },
      update(value) { mutations.push({ table, value }); return this; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return q;
  };
  db.rpc = async (name, args) => { mutations.push({ name, args }); return { data: { id: mine }, error: null }; };
  db.storage.from = bucket => ({
    upload: async path => { storage.push({ bucket, path }); return { data: {}, error: null }; },
    remove: async paths => { storage.push({ removed: paths }); return { data: {}, error: null }; },
    createSignedUrl: async path => { storage.push({ signed: path }); return { data: { signedUrl: "https://example.invalid/signed" }, error: null }; },
  });
  try { await run({ calls, mutations, storage, tables }); }
  finally { db.from = original.from; db.auth.getUser = original.getUser; db.rpc = original.rpc; db.storage.from = original.storage; }
}
test("request APIs require authentication", async () => {
  for (const path of ["/requests", `/requests/${mine}`, "/admin/service-packages"])
    assert.equal((await fetch(base + path)).status, 401);
});
for (const role of ["CUSTOMER", "BUSINESS"]) {
  test(`${role} reads only owned requests and cannot view private notes or assignments`, async () => identity(role, async ({ calls }) => {
    const collection = await (await fetch(base + "/requests", { headers })).json();
    assert.deepEqual(collection.data.items.map(r => r.id), [mine]);
    assert.equal((await fetch(base + "/requests?scope=queue", { headers })).status, 403);
    calls.length = 0;
    assert.equal((await fetch(base + `/requests/${other}`, { headers })).status, 404);
    assert.equal(calls.includes("conversation_messages"), false);
    assert.equal((await fetch(base + `/requests/${mine}/notes`, { headers })).status, 403);
    assert.equal(calls.includes("request_notes"), false);
    assert.equal((await post(`/requests/${mine}/claim`)).status, 403);
    assert.equal((await post(`/requests/${mine}/assign`, { assigned_to: pid })).status, 403);
  }));
  test(`${role} creates via verified actor and rejects forged ownership/snapshot/status`, async () => identity(role, async ({ mutations }) => {
    const input = { title: "Brief", brief: "Scope", service_id: service, idempotency_key: key };
    for (const extra of [{ customer_id: other }, { package_snapshot: { starting_price: 1 } }, { assigned_to: pid }, { status: "CONVERTED" }])
      assert.equal((await post("/requests", { ...input, ...extra })).status, 422);
    assert.equal(mutations.length, 0);
    assert.equal((await post("/requests", input)).status, 201);
    assert.equal(mutations[0].args.actor_id, pid);
    assert.equal(mutations[0].args.rid, null);
  }));
}
test("staff queue omits private data; unassigned/other workspace remains inaccessible", async () => identity("STAFF", async ({ calls }) => {
  const response = await fetch(base + "/requests?scope=queue", { headers });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.data.items.map(r => r.id), [queued]);
  for (const field of ["brief", "reference_urls", "customer_id", "preferred_creator_id", "package_snapshot"])
    assert.equal(Object.hasOwn(body.data.items[0], field), false);
  for (const suffix of ["", "/messages", "/notes", `/attachments/${file}/download`]) {
    calls.length = 0;
    assert.equal((await fetch(base + `/requests/${queued}${suffix}`, { headers })).status, 404);
    assert.equal(calls.includes("conversation_messages"), false);
  }
  assert.equal((await fetch(base + "/requests?scope=all", { headers })).status, 403);
  assert.equal((await post(`/requests/${queued}/claim`)).status, 200);
  assert.equal((await post(`/requests/${mine}/cancel`, { reason: "No" })).status, 403);
}));
test("unsupported roles cannot enter commerce but retain direct messaging", async () => {
  for (const role of ["CREATOR", "STUDENT_CREATOR"])
    await identity(role, async () => {
      assert.equal((await fetch(base + "/requests", { headers })).status, 403);
      assert.equal((await post("/requests", {})).status, 403);
      assert.equal((await fetch(base + "/messages", { headers })).status, 200);
    });
});
test("message pagination pairs timestamp and ID so equal timestamps do not skip messages", async () => identity("CUSTOMER", async () => {
  assert.equal((await fetch(base + `/requests/${mine}/messages?before=2026-10-03T00:00:00Z`, { headers })).status, 422);
  const latest = await (await fetch(base + `/requests/${mine}/messages`, { headers })).json();
  assert.equal(latest.data.messages.length, 50);
  assert.equal(latest.data.next_cursor.before_id, latest.data.messages[0].id);
  const older = await (await fetch(base + `/requests/${mine}/messages?${new URLSearchParams(latest.data.next_cursor)}`, { headers })).json();
  assert.equal(older.data.messages.length, 5);
  assert.equal(older.data.next_cursor, null);
  assert.equal(new Set([...older.data.messages, ...latest.data.messages].map(m => m.id)).size, 55);
  assert.equal((await post(`/requests/${mine}/message`, { content: "Hello", kind: "SYSTEM" })).status, 422);
  assert.equal((await post(`/requests/${mine}/status`, { status: "CONVERTED" })).status, 422);
}));
test("files require request ownership and matching file association before storage access", async () => identity("CUSTOMER", async ({ storage }) => {
  const form = new FormData(); form.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "brief.pdf");
  assert.equal((await fetch(base + `/requests/${other}/attachments`, { method: "POST", headers, body: form })).status, 404);
  assert.equal((await fetch(base + `/requests/${mine}/attachments/${file}/download`, { headers })).status, 404);
  assert.deepEqual(storage, []);
}));
test("legacy Messenger cannot mutate request-linked conversations", async () => identity("ADMIN", async ({ mutations }) => {
  for (const [path, body] of [[`/messages/${conversation}/messages`, { content: "Bypass" }], [`/messages/${conversation}/read`, {}]])
    assert.equal((await post(path, body)).status, 409);
  assert.equal(mutations.length, 0);
}));
test("only admin manages packages; public catalog excludes inactive packages", async () => {
  await identity("CUSTOMER", async () => {
    assert.equal((await post("/admin/service-packages", {})).status, 403);
    const response = await fetch(base + `/public/services/${service}/packages`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.map(p => p.id), [file]);
    assert.equal(Object.hasOwn(body.data[0], "active"), false);
  });
  await identity("ADMIN", async ({ mutations }) => {
    assert.equal((await post("/admin/service-packages", { service_id: service, name: "Test" })).status, 201);
    assert.equal(mutations[0].args.actor_id, pid);
    assert.equal(mutations[0].args.payload.active, false);
  });
});

function commerceData(tables) {
  tables.quotations = [
    { id: mine, request_id: mine, project_id: null, status: "DRAFT", sent_at: null, version: 3, total: 999 },
    { id: other, request_id: mine, project_id: null, status: "CANCELLED", sent_at: null, version: 1, total: 111 },
    { id: queued, request_id: mine, project_id: null, status: "REVISION_REQUESTED", sent_at: "2026-10-03T00:00:00Z", version: 2, total: 1234 },
  ];
  tables.quotation_items = [{ id: file, quotation_id: queued, description: "Published item" }, { id: other, quotation_id: mine, description: "Private item" }];
  tables.creator_proposals = [{ id: file, request_id: mine, status: "SELECTED", reason: "Public reason" }];
  tables.orders = [{ id: mine, request_id: mine, customer_id: customer, assigned_to: pid, order_number: "Own order", total: 1234, status: "WAITING_CONTRACT" }, { id: other, request_id: other, customer_id: other, assigned_to: other, order_number: "Other order", total: 9999, status: "WAITING_CONTRACT" }];
  tables.order_items = [{ id: file, order_id: mine, description: "My order item" }];
}
for (const role of ["CUSTOMER", "BUSINESS"]) {
  test(`${role} commerce hides never-published drafts, including cancelled drafts`, async () => identity(role, async ({ tables, calls }) => {
    commerceData(tables);
    const response = await fetch(base + `/requests/${mine}/commerce`, { headers });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.quotes.map(q => q.id), [queued]);
    assert.deepEqual(body.data.quotes[0].items.map(i => i.id), [file]);
    assert.equal(body.data.selection_locked, true);
    calls.length = 0;
    assert.equal((await fetch(base + `/requests/${other}/commerce`, { headers })).status, 404);
    assert.equal(calls.includes("creator_proposals"), false);
  }));
  test(`${role} cannot author quotes/proposals or overpost quote response`, async () => identity(role, async ({ tables, mutations }) => {
    commerceData(tables);
    assert.equal((await post(`/requests/${mine}/commerce/propose`, { creator_id: file, reason: "Fake" })).status, 403);
    assert.equal((await post(`/requests/${mine}/commerce/quote_save`, {})).status, 403);
    assert.equal((await post(`/requests/${mine}/commerce/quote_accept`, { quote_id: queued, total: 1 })).status, 422);
    assert.equal((await post(`/requests/${mine}/commerce/proposal_reject`, { proposal_id: file, reason: " " })).status, 422);
    assert.equal(mutations.length, 0);
    assert.equal((await post(`/requests/${mine}/commerce/quote_revise`, { quote_id: queued, reason: "Subtitles" })).status, 200);
    assert.equal(mutations[0].args.actor_id, pid);
    assert.equal(mutations[0].name, "request_commerce_action");
  }));
  test(`${role} order scope excludes other customers before item reads`, async () => identity(role, async ({ tables, calls }) => {
    commerceData(tables);
    const collection = await (await fetch(base + "/orders", { headers })).json();
    assert.deepEqual(collection.data.items.map(o => o.id), [mine]);
    calls.length = 0;
    assert.equal((await fetch(base + `/orders/${other}`, { headers })).status, 404);
    assert.equal(calls.includes("order_items"), false);
    assert.equal((await fetch(base + `/orders/${mine}`, { headers })).status, 200);
  }));
}
test("staff commerce shows drafts only after assignment and forbids customer impersonation", async () => identity("STAFF", async ({ tables }) => {
  commerceData(tables);
  const response = await (await fetch(base + `/requests/${mine}/commerce`, { headers })).json();
  assert.equal(response.data.quotes.length, 3);
  assert.equal((await fetch(base + `/requests/${queued}/commerce`, { headers })).status, 404);
  assert.equal((await post(`/requests/${mine}/commerce/quote_accept`, { quote_id: queued })).status, 403);
  assert.equal((await post(`/requests/${mine}/commerce/proposal_select`, { proposal_id: file })).status, 403);
  const orders = await (await fetch(base + "/orders", { headers })).json();
  assert.deepEqual(orders.data.items.map(o => o.id), [mine]);
}));
test("quote authoring rejects forged server totals, versions, deposits and precision", async () => identity("ADMIN", async ({ tables, mutations }) => {
  commerceData(tables);
  const input = { items: [{ service_id: service, description: "Scope", quantity: 2, unit_price: 500 }], valid_until: "2026-12-31", deposit_percent: 30, revision_policy: "Two rounds" };
  for (const extra of [{ total: 1 }, { version: 99 }, { deposit_amount: 1 }, { actor_id: other }, { creator_proposal_id: other }])
    assert.equal((await post(`/requests/${mine}/commerce/quote_save`, { ...input, ...extra })).status, 422);
  assert.equal((await post(`/requests/${mine}/commerce/quote_save`, { ...input, items: [{ ...input.items[0], unit_price: 1.001 }] })).status, 422);
  assert.equal(mutations.length, 0);
  assert.equal((await post(`/requests/${mine}/commerce/quote_save`, input)).status, 200);
  assert.equal(mutations[0].args.actor_id, pid);
}));
test("legacy admin quotation routes do not expose or mutate request quotations", async () => identity("ADMIN", async ({ tables, mutations }) => {
  commerceData(tables);
  assert.equal((await fetch(base + `/admin/quotations/${mine}`, { headers })).status, 404);
  assert.equal((await post(`/admin/quotations/${mine}/cancel`)).status, 404);
  assert.equal(mutations.length, 0);
}));
test("creator identities cannot read orders or commercial proposals", async () => {
  for (const role of ["CREATOR", "STUDENT_CREATOR"])
    await identity(role, async () => {
      assert.equal((await fetch(base + "/orders", { headers })).status, 403);
      assert.equal((await fetch(base + `/requests/${mine}/commerce`, { headers })).status, 403);
    });
});

function contractData(tables) {
  commerceData(tables);
  tables.order_contracts = [
    { id: file, order_id: mine, status: "DRAFT", sent_at: null, version: 4, content: "Private draft" },
    { id: other, order_id: mine, status: "CANCELLED", sent_at: null, version: 1, content: "Never published" },
    { id: queued, order_id: mine, status: "SENT", sent_at: "2026-10-03T00:00:00Z", version: 3, content: "Published terms", content_hash: "a".repeat(64) },
  ];
  tables.contract_acknowledgments = [];
}
for (const role of ["CUSTOMER", "BUSINESS"]) {
  test(`${role} sees published contract history only after order ownership`, async () => identity(role, async ({ tables, calls }) => {
    contractData(tables);
    const response = await (await fetch(base + `/orders/${mine}/contracts`, { headers })).json();
    assert.deepEqual(response.data.contracts.map(c => c.id), [queued]);
    assert.equal(response.data.payment_eligible, false);
    calls.length = 0;
    assert.equal((await fetch(base + `/orders/${other}/contracts`, { headers })).status, 404);
    assert.equal(calls.includes("order_contracts"), false);
    assert.equal(calls.includes("contract_acknowledgments"), false);
  }));
  test(`${role} must explicitly acknowledge exact contract content without authoring/overposting`, async () => identity(role, async ({ tables, mutations }) => {
    contractData(tables);
    const input = { contract_id: queued, content_hash: "a".repeat(64), acknowledge: true };
    assert.equal((await post(`/orders/${mine}/contract_save`, {})).status, 403);
    assert.equal((await post(`/orders/${mine}/assign`, { assigned_to: pid, reason: "Fake" })).status, 403);
    for (const extra of [{ actor_id: other }, { status: "SIGNED" }, { acknowledged_at: "2026-01-01" }, { acknowledge: false }, { content_hash: "bad" }, { signature: "forged" }])
      assert.equal((await post(`/orders/${mine}/contract_acknowledge`, { ...input, ...extra })).status, 422);
    assert.equal(mutations.length, 0);
    assert.equal((await post(`/orders/${mine}/contract_acknowledge`, input)).status, 200);
    assert.equal(mutations[0].name, "order_action"); assert.equal(mutations[0].args.actor_id, pid);
  }));
}
test("staff contract operations remain assigned and cannot impersonate acknowledgment", async () => identity("STAFF", async ({ tables, calls, mutations }) => {
  contractData(tables);
  const response = await (await fetch(base + `/orders/${mine}/contracts`, { headers })).json();
  assert.equal(response.data.contracts.length, 3);
  calls.length = 0;
  assert.equal((await fetch(base + `/orders/${other}/contracts`, { headers })).status, 404);
  assert.equal(calls.includes("order_contracts"), false);
  assert.equal((await post(`/orders/${mine}/contract_acknowledge`, { contract_id: queued, content_hash: "a".repeat(64), acknowledge: true })).status, 403);
  assert.equal((await post(`/orders/${mine}/contract_save`, { title: "Terms", content: "Exact terms", valid_until: "2026-12-31" })).status, 200);
  assert.equal(mutations[0].args.actor_id, pid);
}));
test("admin contracts reject forged commercial links and require transfer reasons", async () => identity("ADMIN", async ({ tables, mutations }) => {
  contractData(tables);
  const input = { title: "Terms", content: "Exact terms", valid_until: "2026-12-31" };
  for (const extra of [{ quotation_id: other }, { request_id: other }, { content_hash: "a".repeat(64) }, { status: "SIGNED" }, { version: 99 }])
    assert.equal((await post(`/orders/${mine}/contract_save`, { ...input, ...extra })).status, 422);
  assert.equal((await post(`/orders/${mine}/assign`, { assigned_to: other, reason: " " })).status, 422);
  assert.equal((await post(`/orders/${mine}/contract_reject`, { contract_id: queued, reason: "Impersonation" })).status, 403);
  assert.equal(mutations.length, 0);
  assert.equal((await post(`/orders/${mine}/assign`, { assigned_to: other, reason: "Transfer" })).status, 200);
  assert.equal(mutations[0].args.actor_id, pid);
}));
test("creator accounts cannot read contracts/evidence or use order actions", async () => {
  for (const role of ["CREATOR", "STUDENT_CREATOR"])
    await identity(role, async () => {
      assert.equal((await fetch(base + `/orders/${mine}/contracts`, { headers })).status, 403);
      assert.equal((await post(`/orders/${mine}/contract_save`, {})).status, 403);
    });
});

function paymentData(tables) {
  contractData(tables);
  tables.orders[0].status = "WAITING_PAYMENT";
  tables.orders[0].total = 1000; tables.orders[0].deposit_amount = 300;
  tables.contract_acknowledgments = [{ order_id: mine, contract_id: queued }];
  tables.order_payment_requests = [
    { id: file, order_id: mine, amount: 100, status: "PENDING", created_at: "2026-10-03T00:00:00Z", request_input: { private: "intent" }, idempotency_key: key },
    { id: queued, order_id: mine, amount: 50, status: "AWAITING_VERIFICATION", created_at: "2026-10-03T01:00:00Z" },
    { id: other, order_id: other, amount: 500, status: "PAID" },
  ];
  tables.order_payment_receipts = [
    { id: file, payment_request_id: file, order_id: mine, amount: 1.1, received_at: "2026-10-03T00:00:00Z", verification_method: "MANUAL_BANK", bank_transaction_reference: "Private bank transaction" },
    { id: queued, payment_request_id: queued, order_id: mine, amount: 2.2, received_at: "2026-10-03T01:00:00Z", verification_method: "MANUAL_BANK" },
    { id: other, order_id: other, amount: 500 },
  ];
  tables.payment_settings = [{ id: "default", enabled: true, bank_name: "QA bank", account_name: "QA only", account_number: "QA-NOT-REAL", qr_image: "unbound-bank-QR" }];
}
for (const role of ["CUSTOMER", "BUSINESS"]) {
  test(`${role} payment summary reads only own receipts with exact cent arithmetic`, async () => identity(role, async ({ tables, calls }) => {
    paymentData(tables);
    const body = await (await fetch(base + `/orders/${mine}/payments`, { headers })).json();
    assert.equal(body.data.collected, 3.3); assert.equal(body.data.pending, 150);
    assert.equal(body.data.remaining, 996.7); assert.equal(body.data.available, 846.7);
    assert.equal(body.data.payments.length, 2); assert.equal(body.data.receipts.length, 2);
    assert.equal(body.data.receipts[0].bank_transaction_reference, undefined);
    assert.equal(body.data.payments.find(p => p.id === file).idempotency_key, undefined);
    assert.equal(body.data.bank_configured, true); assert.equal(body.data.qr_image, undefined);
    calls.length = 0;
    assert.equal((await fetch(base + `/orders/${other}/payments`, { headers })).status, 404);
    assert.equal(calls.includes("order_payment_requests"), false); assert.equal(calls.includes("order_payment_receipts"), false);
  }));
  test(`${role} can report an owned transfer without authoring or forging paid evidence`, async () => identity(role, async ({ tables, mutations }) => {
    paymentData(tables);
    assert.equal((await post(`/orders/${mine}/payments/create`, {})).status, 403);
    assert.equal((await post(`/orders/${mine}/payments/confirm`, {})).status, 403);
    for (const extra of [{ amount: 1 }, { status: "PAID" }, { paid_at: "2026-10-03" }, { actor_id: other }])
      assert.equal((await post(`/orders/${mine}/payments/report`, { payment_id: file, transfer_note: "Report", ...extra })).status, 422);
    assert.equal(mutations.length, 0);
    assert.equal((await post(`/orders/${mine}/payments/report`, { payment_id: file, transfer_note: "Report" })).status, 200);
    assert.equal(mutations[0].name, "order_payment_action"); assert.equal(mutations[0].args.actor_id, pid);
  }));
}
test("staff payment authoring requires exact scope and server-derived kinds or bounded milestone input", async () => identity("STAFF", async ({ tables, calls, mutations }) => {
  paymentData(tables);
  assert.equal((await fetch(base + `/orders/${mine}/payments`, { headers })).status, 200);
  calls.length = 0;
  assert.equal((await fetch(base + `/orders/${other}/payments`, { headers })).status, 404);
  assert.equal(calls.includes("order_payment_receipts"), false);
  assert.equal((await post(`/orders/${mine}/payments/report`, {})).status, 403);
  assert.equal((await post(`/orders/${mine}/payments/confirm`, {})).status, 422);
  const input = { kind: "DEPOSIT", due_date: "2026-12-31", idempotency_key: key };
  for (const extra of [{ amount: 1 }, { percentage: 30 }, { bank_snapshot: {} }, { reference: "Fake" }, { order_id: other }])
    assert.equal((await post(`/orders/${mine}/payments/create`, { ...input, ...extra })).status, 422);
  for (const extra of [{}, { amount: 1, percentage: 30 }, { amount: 1.001 }, { percentage: 101 }])
    assert.equal((await post(`/orders/${mine}/payments/create`, { ...input, kind: "MILESTONE", ...extra })).status, 422);
  assert.equal(mutations.length, 0);
  assert.equal((await post(`/orders/${mine}/payments/create`, { ...input, kind: "MILESTONE", percentage: 20 })).status, 200);
  assert.equal(mutations[0].args.actor_id, pid); assert.equal(mutations[0].args.payload.amount, null);
}));
test("admin verification requires explicit actual bank evidence and rejects overposted receipt metadata", async () => identity("ADMIN", async ({ tables, mutations }) => {
  paymentData(tables);
  const input = { payment_id: file, verified: true, received_amount: 300, bank_transaction_reference: "BANK-QA", received_at: "2026-10-03T00:00:00Z", reason: "Bank checked" };
  for (const extra of [{ verified: false }, { received_amount: 1.001 }, { bank_transaction_reference: " " }, { received_at: "2026-10-03" }, { verified_by: other }, { receipt_id: other }, { status: "PAID" }])
    assert.equal((await post(`/orders/${mine}/payments/confirm`, { ...input, ...extra })).status, 422);
  assert.equal((await post(`/orders/${mine}/payments/reject`, { payment_id: file, reason: " " })).status, 422);
  assert.equal((await post(`/orders/${mine}/payments/report`, {})).status, 403);
  assert.equal(mutations.length, 0);
  assert.equal((await post(`/orders/${mine}/payments/confirm`, input)).status, 200);
  assert.equal(mutations[0].args.actor_id, pid);
}));
test("creator accounts have no order payment or receipt surfaces", async () => {
  for (const role of ["CREATOR", "STUDENT_CREATOR"])
    await identity(role, async () => {
      assert.equal((await fetch(base + `/orders/${mine}/payments`, { headers })).status, 403);
      assert.equal((await post(`/orders/${mine}/payments/confirm`, {})).status, 403);
    });
});

function productionData(tables) {
  paymentData(tables);
  tables.projects = [{ id: service, order_id: mine, customer_id: customer, title: "Production", production_status: "PLANNING", status: "DRAFT" }, { id: other, order_id: other, customer_id: other, title: "Private other" }];
  tables.project_milestones = [{ id: file, project_id: service, title: "First cut", status: "PENDING", display_order: 1 }, { id: other, project_id: other, title: "Other private" }];
  tables.project_status_history = [{ id: queued, project_id: service, status: "PLANNING", note: "Planned" }];
}
for (const role of ["CUSTOMER", "BUSINESS"]) {
  test(`${role} production reads remain scoped and cannot change operational milestones`, async () => identity(role, async ({ tables, calls, mutations }) => {
    productionData(tables);
    const body = await (await fetch(base + `/orders/${mine}/production`, { headers })).json();
    assert.equal(body.data.project.id, service); assert.deepEqual(body.data.milestones.map(m => m.id), [file]);
    assert.equal(body.data.history.length, 1);
    calls.length = 0;
    assert.equal((await fetch(base + `/orders/${other}/production`, { headers })).status, 404);
    assert.equal(calls.includes("project_milestones"), false);
    for (const operation of ["create", "status", "milestone_save", "milestone_status"])
      assert.equal((await post(`/orders/${mine}/production/${operation}`, {})).status, 403);
    assert.equal(mutations.length, 0);
  }));
}
test("staff production creation eligibility uses verified receipts instead of reported amount", async () => identity("STAFF", async ({ tables, calls, mutations }) => {
  productionData(tables); tables.projects = []; tables.orders[0].status = "CONFIRMED";
  let body = await (await fetch(base + `/orders/${mine}/production`, { headers })).json();
  assert.equal(body.data.can_create, false); // Only 3.30 verified, despite a report.
  assert.equal(calls.includes("project_milestones"), false);
  tables.order_payment_receipts = [{ order_id: mine, amount: 300 }];
  body = await (await fetch(base + `/orders/${mine}/production`, { headers })).json(); assert.equal(body.data.can_create, true);
  assert.equal((await post(`/orders/${mine}/production/create`, {})).status, 200);
  assert.equal(mutations[0].name, "order_production_action"); assert.equal(mutations[0].args.actor_id, pid);
  assert.equal((await post(`/orders/${other}/production/create`, {})).status, 404);
}));
test("production operations reject forged origin, progress and skipped completion", async () => identity("ADMIN", async ({ tables, mutations }) => {
  productionData(tables);
  for (const body of [{ order_id: other }, { customer_id: other }, { status: "COMPLETED" }, { progress: 100 }, { creator_id: other }])
    assert.equal((await post(`/orders/${mine}/production/create`, body)).status, 422);
  assert.equal((await post(`/orders/${mine}/production/status`, { status: "COMPLETED", reason: "Skip acceptance" })).status, 422);
  assert.equal((await post(`/orders/${mine}/production/status`, { status: "READY", reason: " " })).status, 422);
  const milestone = { title: "First cut", due_date: "2026-12-31", idempotency_key: key };
  for (const extra of [{ status: "COMPLETED" }, { project_id: other }, { display_order: 1.1 }])
    assert.equal((await post(`/orders/${mine}/production/milestone_save`, { ...milestone, ...extra })).status, 422);
  assert.equal(mutations.length, 0);
  assert.equal((await post(`/orders/${mine}/production/milestone_save`, milestone)).status, 200);
}));
test("new production cannot enter legacy project or quotation mutation paths", async () => identity("ADMIN", async ({ tables, calls, mutations }) => {
  productionData(tables);
  assert.equal((await fetch(base + `/projects/${service}`, { headers })).status, 404);
  assert.equal(calls.includes("deliverables"), false);
  assert.equal((await post(`/projects/${service}/messages`, { message: "Bypass" })).status, 404);
  assert.equal((await post(`/admin/projects/${service}/quotation-draft`, {})).status, 404);
  assert.equal((await post(`/admin/projects/${service}/quotation`, {})).status, 404);
  const response = await (await fetch(base + "/projects", { headers })).json(); assert.equal(response.data.items.length, 0);
  assert.equal(mutations.length, 0);
}));
test("creators cannot access unrelated order production", async () => {
  for (const role of ["CREATOR", "STUDENT_CREATOR"])
    await identity(role, async () => {
      assert.equal((await fetch(base + `/orders/${mine}/production`, { headers })).status, 403);
      assert.equal((await post(`/orders/${mine}/production/create`, {})).status, 403);
    });
});


test("Creator workspace scopes invitations to the linked account and hides financial messages", async()=>identity("CREATOR",async({tables,calls})=>{
 tables.orders=[{id:service,request_id:mine,status:"WAITING_PAYMENT"}];
 tables.contract_acknowledgments=[{order_id:service}];
 assert.equal((await fetch(base+`/creator/assignments/${other}`,{headers})).status,404);
 const response=await fetch(base+`/creator/requests/${mine}/messages`,{headers});assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.data.messages.length,27);assert.ok(body.data.messages.every(m=>m.audience==="TEAM"));
 assert.equal(body.data.next_cursor,null);assert.equal(calls.includes("quotations"),false);
 assert.equal((await post(`/creator/requests/${mine}/accept`,{assignment_id:other})).status,404);
 assert.equal((await post(`/creator/requests/${mine}/message`,{content:"Private attempt",audience:"CUSTOMER_STAFF"})).status,422);
}));
test("Creator cannot open chat before customer contract acknowledgment", async()=>identity("CREATOR",async({tables,calls})=>{
 tables.orders=[{id:service,request_id:mine,status:"WAITING_CONTRACT"}];
 assert.equal((await fetch(base+`/creator/requests/${mine}/messages`,{headers})).status,403);
 assert.equal(calls.includes("conversation_messages"),false);
 assert.equal((await post("/messages",{creator_id:file})).status,403);
}));
test("Customer cannot invite Creator and Staff cannot choose the customer team", async()=>{
 await identity("CUSTOMER",async({mutations})=>{assert.equal((await post(`/requests/${mine}/team/invite`,{proposal_id:file,work_scope:"Video",deadline:"2026-10-04"})).status,403);assert.equal(mutations.length,0)});
 await identity("STAFF",async({mutations})=>{assert.equal((await post(`/requests/${mine}/team/select`,{proposal_id:file})).status,403);assert.equal(mutations.length,0)});
});
test("Creator import requires Admin and rejects duplicate identities before sending invitations",async()=>{
 await identity("STAFF",async()=>assert.equal((await post("/admin/creators/import",{})).status,403));
 await identity("ADMIN",async({mutations})=>{const row={creator_id:file,email:"creator@example.invalid",full_name:"Test Creator",agreement_reference:"TEST",signed_at:"2026-01-01T00:00:00Z"};assert.equal((await post("/admin/creators/import",{mode:"apply",confirm_signed:true,items:[row,row]})).status,422);assert.equal(mutations.length,0)});
});

test("financial reports reject Customer/Creator and force Staff identity", async()=>{
 for (const role of ["CUSTOMER","BUSINESS","CREATOR","STUDENT_CREATOR"])
  await identity(role,async()=>assert.equal((await fetch(base+"/finance/report",{headers})).status,403));
 await identity("STAFF",async({mutations})=>{
  assert.equal((await fetch(base+`/finance/report?staff_id=${other}`,{headers})).status,403);
  assert.equal((await fetch(base+"/finance/staff",{headers})).status,403);
  assert.equal((await fetch(base+"/finance/report?month=13",{headers})).status,422);
  assert.equal((await fetch(base+`/finance/report?actor_id=${other}`,{headers})).status,422);
  assert.equal(mutations.length,0);
  assert.equal((await fetch(base+"/finance/report?year=2026&month=0",{headers})).status,200);
  assert.equal(mutations[0].name,"commerce_finance_report");assert.equal(mutations[0].args.actor_id,pid);
 });
});
test("responsible Staff receipt verification keeps real identity and final funds requires explicit confirmation",async()=>identity("STAFF",async({tables,mutations})=>{
 paymentData(tables);
 const input={payment_id:file,verified:true,received_amount:300,bank_transaction_reference:"STAFF-REAL",received_at:"2026-10-03T00:00:00Z",reason:"Bank checked"};
 assert.equal((await post(`/orders/${other}/payments/confirm`,input)).status,404);
 assert.equal((await post(`/orders/${mine}/payments/confirm`,input)).status,200);
 assert.equal(mutations[0].args.actor_id,pid);
 mutations.length=0;
 for(const body of [{verified:false,note:"No"},{verified:true,note:" "},{verified:true,note:"Yes",confirmed_by:other}])
  assert.equal((await post(`/orders/${mine}/final-funds`,body)).status,422);
 assert.equal(mutations.length,0);
 assert.equal((await post(`/orders/${mine}/final-funds`,{verified:true,note:"Actual funds checked"})).status,200);
 assert.equal(mutations[0].name,"confirm_order_final_funds");assert.equal(mutations[0].args.actor_id,pid);
}));

function deliveryData(tables) {
 paymentData(tables);
 tables.production_submissions=[{id:file,order_id:mine,assignment_id:key,author_id:pid,kind:'REVIEW',title:'Review',storage_path:'private-review.pdf',file_name:'review.pdf',file_type:'application/pdf',file_size:100},{id:queued,order_id:mine,assignment_id:key,author_id:pid,kind:'FINAL',final_of:file,title:'Final',storage_path:'private-final.pdf',file_name:'final.pdf',file_type:'application/pdf',file_size:100},{id:other,order_id:other,kind:'FINAL',storage_path:'other-private.pdf'}];
 tables.order_review_rounds=[{id:key,order_id:mine,status:'ACCEPTED',submission_ids:[file],version:1}];
 tables.order_final_funds_confirmations=[];
}
test("delivery scopes files, hides private paths and blocks final signed downloads until full funds",async()=>identity("CUSTOMER",async({tables,storage,calls})=>{
 deliveryData(tables);
 const response=await fetch(base+`/delivery/${mine}`,{headers});assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.data.files.length,2);assert.ok(body.data.files.every(f=>!Object.hasOwn(f,'storage_path')));
 calls.length=0;
 assert.equal((await fetch(base+`/delivery/${other}`,{headers})).status,404);assert.equal(calls.includes('production_submissions'),false);
 assert.equal((await fetch(base+`/delivery/${mine}/files/${other}/download`,{headers})).status,404);
 assert.equal((await fetch(base+`/delivery/${mine}/files/${queued}/download`,{headers})).status,403);assert.equal(storage.length,0);
 assert.equal((await fetch(base+`/delivery/${mine}/files/${file}/download`,{headers})).status,200);
 tables.order_final_funds_confirmations=[{order_id:mine}];
 assert.equal((await fetch(base+`/delivery/${mine}/files/${queued}/download`,{headers})).status,200);
 assert.equal((await post(`/delivery/${mine}/send_review`,{submission_ids:[file],note:'Customer sends'})).status,403);
 assert.equal((await post(`/delivery/${mine}/files`,{})).status,403);
}));
test("Creator delivery stays separate from finance and cleans uploaded files on workflow rejection",async()=>identity("CREATOR",async({tables,storage,mutations})=>{
 deliveryData(tables);
 const response=await fetch(base+`/delivery/${mine}`,{headers});assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.data.assignment_id,key);assert.equal(Object.hasOwn(body.data,'total'),false);
 assert.equal((await post(`/delivery/${mine}/accept_review`,{round_id:key,confirmed:true})).status,403);
 const form=()=>{const f=new FormData();f.set('kind','REVIEW');f.set('title','Watermarked review');f.set('confirmed','true');f.set('file',new Blob(['%PDF-1.7 test'],{type:'application/pdf'}),'review.pdf');return f;};
 const overposted=form();overposted.set('assignment_id',other);
 assert.equal((await fetch(base+`/delivery/${mine}/files`,{method:'POST',headers,body:overposted})).status,422);assert.equal(storage.length,0);
 db.rpc=async()=>({data:null,error:{code:'P0001',message:'Review is not ready'}});
 assert.equal((await fetch(base+`/delivery/${mine}/files`,{method:'POST',headers,body:form()})).status,409);
 assert.equal(storage[0].bucket,'order-deliverables');assert.ok(storage[0].path.startsWith(mine+'/'));assert.deepEqual(storage[1].removed,[storage[0].path]);assert.equal(mutations.length,0);
}));


test("completed-order feedback scopes reads and keeps Staff/Creator from impersonating the customer",async()=>{
 for(const role of ["CUSTOMER","BUSINESS","STAFF","ADMIN","CREATOR"]){
  await identity(role,async({tables,mutations,calls})=>{
   tables.orders=[{id:mine,request_id:mine,customer_id:customer,assigned_to:pid,status:"COMPLETED"},{id:other,request_id:other,customer_id:other,assigned_to:other,status:"COMPLETED"}];
   const input={rating:4,content:"Good",show_name:false,notice_version:"EXCERPT_V1",creators:[{creator_id:file,rating:5,content:"Good work"}]};
   if(role!=="ADMIN"){
    calls.length=0;
    assert.equal((await fetch(base+`/order-feedback/${other}`,{headers})).status,role==="CREATOR"?403:404);
    assert.equal(calls.includes("order_result_reviews"),false);
   }
   const response=await post(`/order-feedback/${mine}/review`,input);
   assert.equal(response.status,["CUSTOMER","BUSINESS"].includes(role)?200:403);
   if(response.status===200){assert.equal(mutations.at(-1).args.actor_id,pid);assert.equal(mutations.at(-1).args.oid,mine);}
   else assert.equal(mutations.length,0);
   assert.equal((await post(`/admin/case-studies/${mine}/withdraw`,{})).status,role==="ADMIN"?200:403);
  });
 }
});
test("public case studies strip private image paths and IDs and sign only the curated excerpt bucket",async()=>identity("CUSTOMER",async({storage})=>{
 db.rpc=async name=>({error:null,data:name==="public_completed_case_studies"?{items:[{title:"Excerpt",excerpt:"Small part",image_path:"private-excerpt.png",customer_name:"Khách hàng ẩn danh",updated_at:"2026-10-03",order_id:other,customer_profile_id:pid}],total:1}:{items:[],total:0,rating:null,page:1,limit:10}});
 const response=await fetch(base+"/public/case-studies");assert.equal(response.status,200);
 const item=(await response.json()).data.items[0];
 assert.deepEqual(Object.keys(item).sort(),["title","excerpt","updated_at","customer_name","image_url"].sort());
 assert.equal(item.customer_name,"Khách hàng ẩn danh");assert.equal(item.image_url,"https://example.invalid/signed");
 assert.equal(storage[0].signed,"private-excerpt.png");
 assert.equal((await fetch(base+"/public/creator-reviews/owned?page=0")).status,422);
}));
