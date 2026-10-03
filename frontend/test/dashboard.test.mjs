import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardSearchDestination, dashboardBreadcrumbs, sidebarPreferenceKey } from "../src/lib/dashboard.ts";

test("header search stays in the authenticated role's existing work list", () => {
  for (const [role, path, scope] of [["CUSTOMER", "/customer/requests", "mine"], ["BUSINESS", "/customer/requests", "mine"], ["STAFF", "/staff/requests", "mine"], ["ADMIN", "/admin/requests", "all"]]) {
    const result = new URL(dashboardSearchDestination(role, "  ảnh & video  "), "https://mediahub.invalid");
    assert.equal(result.pathname, path);
    assert.equal(result.searchParams.get("scope"), scope);
    assert.equal(result.searchParams.get("search"), "ảnh & video");
    assert.equal(result.searchParams.get("page"), null);
  }
  for (const role of ["CREATOR", "STUDENT_CREATOR"]) assert.equal(dashboardSearchDestination(role, "edit"), "/creator/dashboard?search=edit");
  assert.equal(dashboardSearchDestination(null, "/admin/users"), "/messages");
});
test("search text cannot change role paths or add query parameters", () => {
  const result = new URL(dashboardSearchDestination("STAFF", "//evil.invalid?scope=all&search=x"), "https://mediahub.invalid");
  assert.equal(result.pathname, "/staff/requests");
  assert.equal(result.searchParams.get("scope"), "mine");
  assert.equal(result.origin, "https://mediahub.invalid");
});
test("breadcrumbs label detail pages without exposing raw IDs or linking a missing Creator list", () => {
  assert.deepEqual(dashboardBreadcrumbs("CUSTOMER", "/customer/requests/new"), [{label:"Tổng quan",to:"/customer/dashboard"},{label:"Yêu cầu tư vấn",to:"/customer/requests"},{label:"Gửi yêu cầu"}]);
  const creator = dashboardBreadcrumbs("CREATOR", "/creator/assignments/123-secret-id");
  assert.equal(creator.at(-1).label, "Chi tiết");
  assert.equal(creator[1].to, "/creator/dashboard");
  assert.equal(dashboardBreadcrumbs("CREATOR", "/creator/requests/request-id")[1].to, "/creator/dashboard");
  assert.equal(JSON.stringify(creator).includes("123-secret-id"), false);
  assert.deepEqual(dashboardBreadcrumbs("CUSTOMER", "/admin/users"), [{label:"Tổng quan",to:"/customer/dashboard"}]);
});
test("sidebar preferences are separate for different identities and roles", () => {
  assert.notEqual(sidebarPreferenceKey("one", "STAFF"), sidebarPreferenceKey("two", "STAFF"));
  assert.notEqual(sidebarPreferenceKey("one", "STAFF"), sidebarPreferenceKey("one", "ADMIN"));
});
