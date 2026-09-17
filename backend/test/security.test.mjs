import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:59999";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
const { app } = await import("../dist/app.mjs");
const { db } = await import("../dist/db.js");
const { canAccess, canTransition } = await import("../dist/domain.js");
const { leadSchema } = await import("../dist/lead-routes.js");
const { fileType } = await import("../dist/file-validation.js");
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
test("health is public and protected routes require a token", async () => {
  assert.equal((await fetch(base + "/api/health")).status, 200);
  for (const path of [
    "/api/auth/me",
    "/api/admin/users",
    "/api/customer/invoices",
    "/api/projects",
  ])
    assert.equal((await fetch(base + path)).status, 401);
});
test("lead validation rejects overposting and normalizes email", () => {
  const input = {
    full_name: " Customer ",
    email: "Customer@example.com",
    message: "Brief",
    source: "PROJECT_REQUEST",
  };
  assert.equal(leadSchema.parse(input).email, "customer@example.com");
  assert.equal(
    leadSchema.safeParse({ ...input, status: "CONVERTED" }).success,
    false,
  );
  assert.equal(
    leadSchema.safeParse({ ...input, customer_id: "forged" }).success,
    false,
  );
  assert.equal(leadSchema.safeParse({ ...input, message: " " }).success, false);
});
test("invalid public lead cannot reach persistence", async () => {
  const response = await fetch(base + "/api/public/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bad", status: "CONVERTED" }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal("stack" in body.error, false);
});
test("file uploads reject spoofed content and mismatched extensions", () => {
  assert.throws(() =>
    fileType({
      mimetype: "image/png",
      originalname: "image.png",
      buffer: Buffer.from("<script>bad</script>"),
    }),
  );
  assert.throws(() =>
    fileType({
      mimetype: "application/pdf",
      originalname: "script.html",
      buffer: Buffer.from("%PDF-1.7"),
    }),
  );
  assert.equal(
    fileType({
      mimetype: "application/pdf",
      originalname: "brief.pdf",
      buffer: Buffer.from("%PDF-1.7"),
    }),
    "pdf",
  );
});
test("ownership and workflow transitions reject unrelated and unsupported actors", () => {
  assert.equal(canAccess("CUSTOMER", "a", "b"), false);
  assert.equal(canAccess("CUSTOMER", null, "a"), false);
  assert.equal(canAccess("STAFF", "a", "a"), false);
  assert.equal(canAccess("CUSTOMER", "a", "a"), true);
  assert.equal(canAccess("ADMIN", null, "a"), true);
  assert.equal(canTransition("SUBMITTED", "COMPLETED"), false);
  assert.equal(canTransition("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransition("QUOTATION_ACCEPTED", "IN_PROGRESS"), true);
});
test("customer cannot reach admin APIs or another customer private downloads", async () => {
  const originalFrom = db.from,
    originalGetUser = db.auth.getUser;
  const profileId = "11111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  db.auth.getUser = async () => ({
    data: { user: { id: profileId } },
    error: null,
  });
  db.from = (table) => {
    const value =
      table === "profiles"
        ? {
            id: profileId,
            auth_user_id: profileId,
            full_name: "Test",
            email: "test@example.invalid",
            role: "CUSTOMER",
            active: true,
          }
        : table === "customers"
          ? { id: customerId }
          : {
              id: "33333333-3333-4333-8333-333333333333",
              customer_id: "44444444-4444-4444-8444-444444444444",
            };
    const builder = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: value, error: null }),
    };
    return builder;
  };
  try {
    const headers = { Authorization: "Bearer test-only" };
    assert.equal(
      (await fetch(base + "/api/admin/users", { headers })).status,
      403,
    );
    assert.equal(
      (
        await fetch(
          base + "/api/projects/33333333-3333-4333-8333-333333333333",
          { headers },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(
          base +
            "/api/projects/33333333-3333-4333-8333-333333333333/download/files/55555555-5555-4555-8555-555555555555",
          { headers },
        )
      ).status,
      404,
    );
  } finally {
    db.from = originalFrom;
    db.auth.getUser = originalGetUser;
  }
});
