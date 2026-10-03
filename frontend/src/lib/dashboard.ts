import { workspaceHome } from "./permissions.ts";

export function dashboardRoleLabel(role: string | null) {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "STAFF") return "Nhân viên";
  if (role === "CREATOR" || role === "STUDENT_CREATOR") return "Creator";
  return "Khách hàng";
}

export function dashboardSearchDestination(role: string | null, value: string) {
  const home = workspaceHome(role);
  if (!home.endsWith("/dashboard")) return home;
  const prefix = home.slice(0, -10);
  const creator = prefix === "/creator";
  const params = new URLSearchParams();
  if (value.trim()) params.set("search", value.trim().slice(0, 150));
  if (!creator) params.set("scope", role === "ADMIN" ? "all" : "mine");
  return `${prefix}/${creator ? "dashboard" : "requests"}${params.size ? `?${params}` : ""}`;
}

const pageLabels: Record<string, string> = {
  dashboard: "Tổng quan", requests: "Yêu cầu tư vấn", orders: "Đơn dịch vụ",
  projects: "Dự án", quotations: "Báo giá", payments: "Thanh toán", invoices: "Hóa đơn",
  notifications: "Thông báo", profile: "Hồ sơ & Bảo mật", finance: "Thống kê tài chính",
  support: "Hỗ trợ khách hàng", users: "Tài khoản", employees: "Nhân viên",
  creators: "Cấp tài khoản Creator", "case-studies": "Duyệt dự án tiêu biểu",
  "payment-settings": "Ngân hàng & QR", "service-packages": "Gói dịch vụ",
  files: "Tệp dự án", leads: "Liên hệ & ứng tuyển", partners: "Đối tác", process: "Quy trình",
  settings: "Nội dung website", "activity-logs": "Nhật ký hoạt động", customers: "Khách hàng",
  revenue: "Doanh số", services: "Dịch vụ", portfolio: "Hồ sơ dự án", testimonials: "Đánh giá",
  assignments: "Công việc của tôi",
};

export function dashboardBreadcrumbs(role: string | null, pathname: string) {
  const home = workspaceHome(role), prefix = home.slice(0, home.lastIndexOf("/"));
  const crumbs: { label: string; to?: string }[] = [{ label: "Tổng quan", to: home }];
  if (pathname === home) return [{ label: "Tổng quan" }];
  if (!home.endsWith("/dashboard") || !pathname.startsWith(`${prefix}/`)) return crumbs;
  const [page, detail] = pathname.slice(prefix.length + 1).split("/");
  const creatorDetail = prefix === "/creator" && ["assignments", "requests"].includes(page);
  const label = creatorDetail ? "Công việc của tôi" : pageLabels[page] || "Công việc";
  crumbs.push({ label, ...(detail ? { to: creatorDetail ? home : `${prefix}/${page}` } : {}) });
  if (detail) crumbs.push({ label: detail === "new" ? "Gửi yêu cầu" : "Chi tiết" });
  return crumbs;
}

export function sidebarPreferenceKey(id: string, role: string) {
  return `mediahub.sidebar.collapsed:${role}:${id}`;
}
