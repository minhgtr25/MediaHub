import { test, expect, login, service } from "./fixtures";

for (const role of [
  "CUSTOMER",
  "BUSINESS",
  "STAFF",
  "CREATOR",
  "STUDENT_CREATOR",
  "ADMIN",
]) {
  test(`login, reload, authorization and logout: ${role}`, async ({
    page,
    scenario,
  }) => {
    scenario.role = role;
    await login(page);
    const prefix =
      role === "ADMIN"
        ? "admin"
        : role === "STAFF"
          ? "staff"
          : ["CREATOR", "STUDENT_CREATOR"].includes(role)
            ? "creator"
            : "customer";
    await expect(page).toHaveURL(new RegExp(`/${prefix}/dashboard$`));
    await page.reload();
    await expect(page.getByRole("main")).toBeVisible();
    await page.goto(role === "ADMIN" ? "/customer/profile" : "/admin/profile");
    await expect(page).toHaveURL(new RegExp(`/${prefix}/dashboard$`));
    await page.goto(`/${prefix}/profile`);
    await expect(
      page.getByRole("heading", { name: "Hồ sơ người dùng & Bảo mật" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Mở menu tài khoản", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Đăng xuất", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
  });
}
test("guest returns to selected service after login", async ({
  page,
  scenario,
}) => {
  await page.goto(`/request-project?service=${service.id}`);
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("Email doanh nghiệp / cá nhân")
    .fill("qa@example.invalid");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Example-password-123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/customer/requests/new\\?service=${service.id}`),
  );
  await expect(page.getByLabel("Dịch vụ", { exact: true })).toHaveValue(
    service.id,
  );
});
test("invalid credentials are explained in Vietnamese and password visibility is accessible", async ({
  page,
  scenario,
}) => {
  scenario.loginError = "invalid_credentials";
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Email hoặc mật khẩu chưa đúng",
  );
  await page
    .getByRole("button", { name: "Hiện mật khẩu", exact: true })
    .click();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).click();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
});
test("inactive account cannot enter workspace or falsely report login success", async ({
  page,
  scenario,
}) => {
  scenario.meStatus = 403;
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Tài khoản không có quyền truy cập",
  );
  await expect(
    page.getByText("Đăng nhập thành công. Đang tải tài khoản…"),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeVisible();
});
test("register validates names, matching passwords, metadata and confirmation state", async ({
  page,
  scenario,
}) => {
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("   ");
  await page
    .getByLabel("Email doanh nghiệp / cá nhân")
    .fill("qa@example.invalid");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Example-password-123");
  await page.getByLabel("Xác nhận mật khẩu").fill("Example-password-123");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  expect(scenario.calls.filter((c) => c.path.endsWith("/signup"))).toHaveLength(
    0,
  );
  await page.getByLabel("Họ và tên").fill("  QA Creator  ");
  await page.getByLabel("Tên thương hiệu / Công ty").fill("QA Studio");
  await page.getByLabel("Xác nhận mật khẩu").fill("different-password");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Mật khẩu xác nhận chưa khớp",
  );
  await page.getByLabel("Xác nhận mật khẩu").fill("Example-password-123");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("kiểm tra email");
  const request = scenario.calls.find((c) => c.path.endsWith("/signup"));
  expect(request?.body.data.full_name).toBe("QA Creator");
  expect(request?.body.data.organization).toBe("QA Studio");
  expect(request?.body.data.role).toBeUndefined();
});
test("signup without email confirmation opens the customer workspace", async ({
  page,
  scenario,
}) => {
  scenario.signUpSession = true;
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("QA Customer");
  await page
    .getByLabel("Email doanh nghiệp / cá nhân")
    .fill("qa@example.invalid");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Example-password-123");
  await page.getByLabel("Xác nhận mật khẩu").fill("Example-password-123");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/customer\/dashboard$/);
});
test("forgot-password acknowledgement does not persist on the login screen", async ({
  page,
  scenario,
}) => {
  await page.goto("/forgot-password");
  await page
    .getByLabel("Email doanh nghiệp / cá nhân")
    .fill("qa@example.invalid");
  await page.getByRole("button", { name: "Gửi liên kết khôi phục" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Nếu email đã được đăng ký",
  );
  await page.getByRole("link", { name: "Trở về đăng nhập" }).click();
  await expect(
    page.getByText("Nếu email đã được đăng ký", { exact: false }),
  ).not.toBeVisible();
});
test("reset-password without a valid session offers a new recovery link", async ({
  page,
  scenario,
}) => {
  await page.goto("/reset-password");
  await expect(
    page.getByRole("link", { name: "Gửi lại liên kết khôi phục" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cập nhật mật khẩu" }),
  ).not.toBeVisible();
});
test("expired email link gives clear recovery guidance", async ({
  page,
  scenario,
}) => {
  await page.goto(
    "/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  );
  await expect(page.getByRole("alert")).toContainText("hết hạn");
  await expect(
    page.getByRole("link", { name: "Gửi lại liên kết khôi phục" }),
  ).toBeVisible();
});
test("request list errors can be retried without showing false empty success", async ({
  page,
  scenario,
}) => {
  scenario.apiFailures.add("/api/requests");
  await login(page);
  await page.goto("/customer/requests");
  await expect(page.getByRole("alert")).toContainText("Không thể tải dữ liệu");
  scenario.apiFailures.clear();
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
});
test("public pages: no crashes, missing local images or horizontal overflow", async ({
  page,
  scenario,
}) => {
  for (const path of [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/services",
    "/services/video-production",
    "/creators",
    "/projects",
    "/about",
    "/partners",
    "/process",
    "/contact",
    "/business-contact",
    "/creator-application",
    "/privacy",
    "/terms",
    "/operating-rules",
    "/payment-policy",
    "/missing-page",
  ]) {
    await page.goto(path);
    await expect(
      page.locator("h1:visible,h2:visible").first(),
      `visible heading on ${path}`,
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow on ${path}`,
    ).toBe(true);
    const broken = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((image) => image.complete && !image.naturalWidth)
          .map((image) => image.getAttribute("src")),
      );
    expect(broken, `broken images on ${path}`).toEqual([]);
    expect(scenario.pageErrors, `runtime on ${path}`).toEqual([]);
  }
  await page.screenshot({
    path: `../.qa/public-${test.info().project.name}.png`,
    fullPage: true,
  });
});
