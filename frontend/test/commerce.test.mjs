import { test } from "node:test";
import assert from "node:assert/strict";
import { businessToday, quoteExpired, ordersHome } from "../src/lib/commerce.ts";
test("quote validity follows the Vietnamese business date across UTC midnight", () => {
  const localNextDay = new Date("2026-10-02T18:30:00Z");
  assert.equal(businessToday(localNextDay), "2026-10-03");
  assert.equal(quoteExpired("2026-10-02", localNextDay), true);
  assert.equal(quoteExpired("2026-10-03", localNextDay), false);
});
test("order links stay within each role workspace", () => {
  assert.equal(ordersHome("BUSINESS"), "/customer/orders");
  assert.equal(ordersHome("STAFF"), "/staff/orders");
  assert.equal(ordersHome("ADMIN"), "/admin/orders");
});
