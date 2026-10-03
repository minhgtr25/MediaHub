import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceHome, loginDestination, isCustomerRole } from "../src/lib/permissions.ts";
test("legacy business accounts have customer navigation; creator accounts enter their assigned workspace", () => {
  assert.equal(isCustomerRole("BUSINESS"), true);
  assert.equal(workspaceHome("BUSINESS"), "/customer/dashboard");
  for (const role of ["CREATOR", "STUDENT_CREATOR"]) assert.equal(workspaceHome(role), "/creator/dashboard");
  assert.equal(workspaceHome("STAFF"), "/staff/dashboard");
});
test("login resumes selected customer service and rejects unrelated or unsafe returns", () => {
  const request = "/request-project?service=chosen";
  assert.equal(loginDestination("CUSTOMER", request), request);
  assert.equal(loginDestination("BUSINESS", request), request);
  assert.equal(loginDestination("STAFF", request), "/staff/dashboard");
  assert.equal(loginDestination("CUSTOMER", "/messages/abc"), "/messages/abc");
  assert.equal(loginDestination("CUSTOMER", "/creators/photographer"), "/creators/photographer");
  for (const destination of ["https://example.invalid", "//example.invalid", "/\\example.invalid", "/admin/users", "/customer-fake", "/messages-fake", "/customer/../admin/users"]) {
    assert.equal(loginDestination("CUSTOMER", destination), "/customer/dashboard");
  }
});
