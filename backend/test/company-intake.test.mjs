import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:59999";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
const { app, apiLimiter } = await import("../dist/app.mjs");
const { db } = await import("../dist/db.js");
const { intakeLimiter } = await import("../dist/lead-routes.js");
const { creatorApplicationSchema, businessContactSchema } = await import("../dist/intake-validators.js");
const pid = "11111111-1111-4111-8111-111111111111", lid = "22222222-2222-4222-8222-222222222222";
let server, base;
before(async () => { server = app.listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => new Promise(resolve => server.close(resolve)));
const person = { full_name: "  Intake fixture  ", email: "Applicant@example.invalid", phone: "" };
const creator = { ...person, specialty: "Video", applicant_type: "STUDENT", portfolio_urls: ["https://example.invalid/work"], message: "" };
const authHeaders = { Authorization: "Bearer test-only" };
const jsonPost = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function applicationForm(payload = creator, content = "%PDF-1.7\nfixture", filename = "cv.pdf", type = "application/pdf") {
  const form = new FormData(); form.set("payload", JSON.stringify(payload));
  form.set("attachment", new Blob([content], { type }), filename); return form;
}
async function fixture(run, { role = "ADMIN", insertError = false } = {}) {
  apiLimiter.resetKey("127.0.0.1"); intakeLimiter.resetKey("127.0.0.1");
  const original = { from: db.from, getUser: db.auth.getUser, rpc: db.rpc, storage: db.storage.from };
  const mutations = [], uploads = [], removals = [], signatures = [], tables = [], rpcs = [];
  let authCalls = 0;
  const records = {
    profiles: [{ id: pid, auth_user_id: pid, role, active: true, full_name: "Fixture", email: "fixture@example.invalid" }],
    customers: [{ id: pid, profile_id: pid }],
    leads: [{ id: lid, source: "CREATOR_APPLICATION", full_name: "Private applicant", email: "private@example.invalid", specialty: "Video", portfolio_urls: ["https://example.invalid/private"], attachment_path: `${lid}/cv.pdf`, attachment_name: "cv.pdf" }, { id: pid, source: "BUSINESS_CONTACT", full_name: "Private business" }],
  };
  db.auth.getUser = async () => { authCalls++; return { data: { user: { id: pid } }, error: null }; };
  db.from = table => {
    tables.push(table); let rows = [...(records[table] || [])];
    const query = {
      select() { return this; }, eq(field, value) { rows = rows.filter(row => row[field] === value); return this; },
      neq(field, value) { rows = rows.filter(row => row[field] !== value); return this; },
      order() { return this; }, ilike() { return this; }, in(field, values) { rows = rows.filter(row => values.includes(row[field])); return this; },
      range() { return Promise.resolve({ data: rows, count: rows.length, error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
      insert(payload) { mutations.push({ table, payload: structuredClone(payload) }); return Promise.resolve({ data: null, error: insertError ? { code: "TEST_INSERT_FAILURE" } : null }); },
      then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
    }; return query;
  };
  db.rpc = async (...args) => { rpcs.push(args); return { data: {}, error: null }; };
  db.storage.from = bucket => ({
    upload: async (path, _content, options) => { uploads.push({ bucket, path, options }); return { data: {}, error: null }; },
    remove: async paths => { removals.push({ bucket, paths }); return { data: {}, error: null }; },
    createSignedUrl: async (path, seconds, options) => { signatures.push({ bucket, path, seconds, options }); return { data: { signedUrl: "https://example.invalid/private-signed-cv" }, error: null }; },
  });
  try { await run({ mutations, uploads, removals, signatures, tables, rpcs, authCalls: () => authCalls }); }
  finally { db.from = original.from; db.auth.getUser = original.getUser; db.rpc = original.rpc; db.storage.from = original.storage; }
}

test("guest business contact records its server-selected source without creating an account or order", async () => fixture(async f => {
  const response = await jsonPost("/public/business-contact", { ...person, company: "Fixture agency", message: "Campaign" });
  assert.equal(response.status, 201);
  assert.equal(f.mutations.length, 1);
  assert.equal(f.mutations[0].table, "leads");
  assert.equal(f.mutations[0].payload.source, "BUSINESS_CONTACT");
  assert.equal(f.mutations[0].payload.email, "applicant@example.invalid");
  assert.equal(f.authCalls(), 0); assert.equal(f.uploads.length, 0); assert.equal(f.rpcs.length, 0);
  assert.deepEqual(f.tables, ["leads"]);
}));
test("guest Creator application stores PDF privately and treats student as profile classification", async () => fixture(async f => {
  const response = await fetch(base + "/public/creator-applications", { method: "POST", body: applicationForm() });
  assert.equal(response.status, 201);
  assert.equal(f.uploads.length, 1); assert.equal(f.uploads[0].bucket, "lead-attachments");
  const row = f.mutations[0].payload;
  assert.equal(row.source, "CREATOR_APPLICATION"); assert.equal(row.applicant_type, "STUDENT");
  assert.equal(row.attachment_path, f.uploads[0].path); assert.ok(row.attachment_path.startsWith(row.id + "/"));
  assert.deepEqual(row.portfolio_urls, creator.portfolio_urls);
  assert.equal(Object.hasOwn(row, "role"), false); assert.equal(Object.hasOwn(row, "customer_id"), false);
  assert.deepEqual(f.tables, ["leads"]); assert.equal(f.authCalls(), 0); assert.equal(f.rpcs.length, 0);
  const body = await response.json(); assert.equal(JSON.stringify(body).includes(row.id), false); assert.equal(JSON.stringify(body).includes("attachment_path"), false);
}));
test("application needs a CV and refuses fake PDF content before storage or persistence", async () => fixture(async f => {
  assert.equal((await jsonPost("/public/creator-applications", creator)).status, 422);
  const fake = await fetch(base + "/public/creator-applications", { method: "POST", body: applicationForm(creator, "<script>fake PDF</script>") });
  assert.equal(fake.status, 422); assert.equal((await fake.json()).error.code, "INVALID_CV");
  assert.equal(f.uploads.length, 0); assert.equal(f.mutations.length, 0);
}));
test("CV size cap and multipart JSON errors cannot reach storage", async () => fixture(async f => {
  const bad = new FormData(); bad.set("payload", "{broken");
  assert.equal((await fetch(base + "/public/creator-applications", { method: "POST", body: bad })).status, 400);
  const large = applicationForm(creator, new Uint8Array(10 * 1024 * 1024 + 1));
  assert.equal((await fetch(base + "/public/creator-applications", { method: "POST", body: large })).status, 422);
  assert.equal(f.uploads.length, 0); assert.equal(f.mutations.length, 0);
}));
test("intake validators reject role, source and status overposting and unsafe portfolio URLs", () => {
  for (const property of [{ role: "ADMIN" }, { source: "CONTACT" }, { status: "QUALIFIED" }, { customer_id: pid }]) assert.equal(creatorApplicationSchema.safeParse({ ...creator, ...property }).success, false);
  for (const url of ["javascript:alert(1)", "http://example.invalid", "https://user:password@example.invalid", "/relative"]) assert.equal(creatorApplicationSchema.safeParse({ ...creator, portfolio_urls: [url] }).success, false);
  assert.equal(creatorApplicationSchema.safeParse({ ...creator, portfolio_urls: [] }).success, false);
  assert.equal(creatorApplicationSchema.safeParse({ ...creator, applicant_type: "ADMIN" }).success, false);
  assert.equal(businessContactSchema.safeParse({ ...person, company: " ", message: "Need" }).success, false);
});
test("failed intake insert removes the uploaded CV instead of leaving an orphaned document", async () => fixture(async f => {
  assert.equal((await fetch(base + "/public/creator-applications", { method: "POST", body: applicationForm() })).status, 500);
  assert.deepEqual(f.removals, [{ bucket: "lead-attachments", paths: [f.uploads[0].path] }]);
}, { insertError: true }));
test("invalid portfolio and forged role in public application return validation errors without persistence", async () => fixture(async f => {
  for (const payload of [{ ...creator, portfolio_urls: ["/relative"] }, { ...creator, role: "ADMIN" }]) {
    const response = await fetch(base + "/public/creator-applications", { method: "POST", body: applicationForm(payload) });
    assert.equal(response.status, 422); assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  }
  assert.equal(f.uploads.length, 0); assert.equal(f.mutations.length, 0);
}));
test("only Admin can list or download intake documents", async () => {
  for (const role of ["CUSTOMER", "BUSINESS", "STAFF", "CREATOR", "STUDENT_CREATOR"]) await fixture(async f => {
    for (const path of ["/admin/leads", `/admin/leads/${lid}`, `/admin/leads/${lid}/attachment`]) assert.equal((await fetch(base + path, { headers: authHeaders })).status, 403);
    assert.equal(f.signatures.length, 0); assert.equal(f.tables.includes("leads"), false);
  }, { role });
  await fixture(async f => {
    assert.equal((await fetch(base + `/admin/leads/${lid}/attachment`)).status, 401); assert.equal(f.signatures.length, 0);
    assert.equal((await fetch(base + `/admin/leads/${lid}/attachment`, { headers: authHeaders })).status, 200);
    assert.deepEqual(f.signatures, [{ bucket: "lead-attachments", path: `${lid}/cv.pdf`, seconds: 300, options: { download: true } }]);
  });
});
test("Admin source filters separate applications from business contacts", async () => fixture(async () => {
  const response = await fetch(base + "/admin/leads?source=CREATOR_APPLICATION", { headers: authHeaders });
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.data.items.length, 1); assert.equal(body.data.items[0].source, "CREATOR_APPLICATION");
  assert.equal((await fetch(base + "/admin/leads?source=ADMIN", { headers: authHeaders })).status, 422);
}));
test("Creator application cannot be converted into a customer even by Admin", async () => fixture(async f => {
  const response = await fetch(base + `/admin/leads/${lid}/convert`, { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: pid }) });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, "APPLICATION_NOT_CUSTOMER");
  assert.equal(f.rpcs.length, 0);
  const matching = await fetch(base + `/admin/leads/${lid}/customer`, { headers: authHeaders });
  assert.equal(matching.status, 200); assert.equal((await matching.json()).data, null);
}));
