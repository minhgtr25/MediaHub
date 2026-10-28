import { test as base, expect, type Page } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const empty = { items: [], total: 0, page: 1, limit: 20 };
export const service = {
  id: serviceId,
  name: "Sản xuất video",
  slug: "video-production",
  description: "Dịch vụ kiểm thử",
  category: "Video",
  starting_price: 1000000,
  estimated_days: 7,
  features: [],
  deliverables: [],
};
export type Scenario = {
  role: string;
  loginError: string;
  meStatus: number;
  signUpSession: boolean;
  recoveryStatus: number;
  apiFailures: Set<string>;
  calls: { path: string; method: string; body: any }[];
  pageErrors: string[];
};
export const test = base.extend<{ scenario: Scenario }>({
  scenario: async ({ page, context }, use) => {
    const state: Scenario = {
      role: "CUSTOMER",
      loginError: "",
      meStatus: 200,
      signUpSession: false,
      recoveryStatus: 200,
      apiFailures: new Set(),
      calls: [],
      pageErrors: [],
    };
    const user = () => ({
      id,
      aud: "authenticated",
      role: "authenticated",
      email: "qa@example.invalid",
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "QA MediaHub" },
      identities: [],
      created_at: new Date().toISOString(),
    });
    const session = () => ({
      access_token: `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).toString("base64url")}.local-signature`,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "local-refresh-token",
      user: user(),
    });
    page.on("pageerror", (error) => state.pageErrors.push(error.message));
    await context.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname))
        return route.abort();
      if (url.port !== "54321" && !url.pathname.startsWith("/api/"))
        return route.continue();
      let body: any;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      const path = url.pathname;
      state.calls.push({ path, method: req.method(), body });
      const json = (data: unknown, status = 200) =>
        route.fulfill({ status, json: data });
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
      if (url.port === "54321") {
        if (path.endsWith("/token"))
          return state.loginError
            ? json(
                {
                  error_code: state.loginError,
                  msg: "Invalid login credentials",
                },
                400,
              )
            : json(session());
        if (path.endsWith("/signup"))
          return json(
            state.signUpSession
              ? session()
              : { ...user(), identities: [{ id }] },
          );
        if (path.endsWith("/recover"))
          return json(
            state.recoveryStatus === 200
              ? {}
              : {
                  error_code: "over_email_send_rate_limit",
                  msg: "Too many requests",
                },
            state.recoveryStatus,
          );
        if (path.endsWith("/user")) return json(user());
        if (path.endsWith("/logout")) return route.fulfill({ status: 204 });
        return json({ error_code: "unexpected_fixture_request" }, 400);
      }
      const success = (data: unknown) => json({ success: true, data });
      if (state.apiFailures.has(path))
        return json(
          {
            success: false,
            error: {
              code: "UNAVAILABLE",
              message: "Không thể tải dữ liệu. Vui lòng thử lại.",
            },
          },
          503,
        );
      if (path === "/api/auth/me") {
        if (state.meStatus !== 200)
          return json(
            {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "Tài khoản không có quyền truy cập.",
              },
            },
            state.meStatus,
          );
        return success({
          id,
          role: state.role,
          full_name: "QA MediaHub",
          email: "qa@example.invalid",
          company_name: "QA Company",
          phone: "",
          avatar_url: null,
          notification_preferences: { email: true, in_app: true },
        });
      }
      if (path === "/api/public/home")
        return success({
          hero: null,
          services: [service],
          projects: [],
          creators: [],
          testimonials: [],
          partners: [],
          stats: { creators: 0, projects: 0 },
        });
      if (path === "/api/public/creators/filters")
        return success({ categories: [], skills: [] });
      if (path === "/api/public/services")
        return success({ ...empty, items: [service], total: 1 });
      if (path === `/api/public/services/${serviceId}/packages`)
        return success([]);
      if (path === "/api/public/services/video-production")
        return success(service);
      if (path.startsWith("/api/public/pages/")) return success(null);
      if (
        path.startsWith("/api/public/creators/") &&
        path != "/api/public/creators/options"
      )
        return json(
          { success: false, error: { message: "Không tìm thấy Creator." } },
          404,
        );
      if (path.startsWith("/api/public/portfolio/"))
        return json(
          { success: false, error: { message: "Không tìm thấy dự án." } },
          404,
        );
      if (path === "/api/requests/summary")
        return success({
          total: 0,
          unassigned: 0,
          assigned: 0,
          by_status: [],
          recent: [],
        });
      if (path.endsWith("/dashboard"))
        return success({
          total_projects: 0,
          active_projects: 0,
          completed_projects: 0,
          total_revenue: 0,
          pending_payment: 0,
          by_status: [],
          recent_notifications: [],
        });
      if (path === "/api/creator/profile")
        return json(
          {
            success: false,
            error: {
              code: "CREATOR_PROFILE_REQUIRED",
              message: "Admin cần liên kết hồ sơ và xác nhận hợp đồng hợp tác.",
            },
          },
          409,
        );
      if (path === "/api/admin/users")
        return success({
          ...empty,
          summary: { total: 0, active: 0, inactive: 0, by_role: [] },
        });
      if (path === "/api/admin/creators") return success(empty);
      if (path === "/api/public/leads" && req.method() === "POST")
        return success({ id });
      return success(empty);
    });
    await use(state);
    expect(state.pageErrors, "uncaught browser errors").toEqual([]);
  },
});
export { expect };
export async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByLabel("Email doanh nghiệp / cá nhân")
    .fill("qa@example.invalid");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Example-password-123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}
