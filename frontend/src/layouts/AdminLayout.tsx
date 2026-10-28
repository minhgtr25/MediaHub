import type { ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageCircle,
  Palette,
  Settings,
  Users,
} from "lucide-react";
import { BrandLogo } from "../components/BrandMark";
import { DashboardShell } from "./DashboardShell";
import { LogoutButton, NavGroup, SideLink } from "./WorkspaceNavigation";

export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  return (
    <DashboardShell title="Admin">
      <aside className="side">
        <Link className="brand side-brand" to="/">
          <BrandLogo />
        </Link>
        <SideLink to="/admin/dashboard" icon={<LayoutDashboard />}>
          Tổng quan
        </SideLink>
        <SideLink to="/admin/website-projects" icon={<BriefcaseBusiness />}>
          Quản lý hồ sơ dự án
        </SideLink>
        <NavGroup
          label="Vận hành"
          active={["requests", "orders", "projects", "files"].some((item) =>
            location.pathname.startsWith(`/admin/${item}`),
          )}
        >
          <SideLink to="/admin/requests" icon={<MessageCircle />}>
            Yêu cầu dịch vụ
          </SideLink>
          <SideLink to="/admin/orders" icon={<FileText />}>
            Đơn dịch vụ
          </SideLink>
          <SideLink to="/admin/projects" icon={<FolderKanban />}>
            Dự án
          </SideLink>
          <SideLink to="/admin/files" icon={<FolderKanban />}>
            Tệp dự án
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Khách hàng & hỗ trợ"
          active={["customers", "users", "support", "leads"].some((item) =>
            location.pathname.startsWith(`/admin/${item}`),
          )}
        >
          <SideLink to="/admin/customers" icon={<Users />}>
            Khách hàng
          </SideLink>
          <SideLink to="/admin/users" icon={<Users />}>
            Tài khoản
          </SideLink>
          <SideLink to="/admin/support" icon={<MessageCircle />}>
            Hỗ trợ khách hàng
          </SideLink>
          <SideLink to="/admin/leads" icon={<Users />}>
            Liên hệ & ứng tuyển
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Báo giá & tài chính"
          active={[
            "quotations",
            "invoices",
            "payments",
            "payment-settings",
            "revenue",
            "finance",
          ].some((item) => location.pathname.startsWith(`/admin/${item}`))}
        >
          <SideLink to="/admin/quotations" icon={<BriefcaseBusiness />}>
            Báo giá
          </SideLink>
          <SideLink to="/admin/payments" icon={<BarChart3 />}>
            Cọc & thanh toán
          </SideLink>
          <SideLink to="/admin/invoices" icon={<FileText />}>
            Hóa đơn
          </SideLink>
          <SideLink to="/admin/revenue" icon={<BarChart3 />}>
            Doanh số
          </SideLink>
          <SideLink to="/admin/finance" icon={<BarChart3 />}>
            Tài chính &amp; nhân viên
          </SideLink>
          <SideLink to="/admin/payment-settings" icon={<Settings />}>
            Ngân hàng &amp; QR
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Đội ngũ & dịch vụ"
          active={[
            "employees",
            "creators",
            "creator-showcase",
            "partners",
            "services",
            "service-packages",
          ].some((item) => location.pathname.startsWith(`/admin/${item}`))}
        >
          <SideLink to="/admin/employees" icon={<BriefcaseBusiness />}>
            Nhân viên
          </SideLink>
          <SideLink to="/admin/creators" icon={<Users />}>
            Creator &amp; cấp tài khoản
          </SideLink>
          <SideLink to="/admin/creator-showcase" icon={<Users />}>
            Hồ sơ Creator
          </SideLink>
          <SideLink to="/admin/partners" icon={<Users />}>
            Đối tác
          </SideLink>
          <SideLink to="/admin/services" icon={<Palette />}>
            Dịch vụ
          </SideLink>
          <SideLink to="/admin/service-packages" icon={<BriefcaseBusiness />}>
            Gói dịch vụ
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Nội dung website"
          active={["settings", "process", "testimonials", "case-studies"].some(
            (item) => location.pathname.startsWith(`/admin/${item}`),
          )}
        >
          <SideLink to="/admin/settings" icon={<Settings />}>
            Nội dung website
          </SideLink>
          <SideLink to="/admin/process" icon={<FolderKanban />}>
            Quy trình
          </SideLink>
          <SideLink to="/admin/testimonials" icon={<Users />}>
            Đánh giá
          </SideLink>
          <SideLink to="/admin/case-studies" icon={<BriefcaseBusiness />}>
            Duyệt dự án tiêu biểu
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Tài khoản & hệ thống"
          active={["notifications", "activity-logs", "profile"].some((item) =>
            location.pathname.startsWith(`/admin/${item}`),
          )}
        >
          <SideLink to="/admin/notifications" icon={<Bell />}>
            Thông báo
          </SideLink>
          <SideLink to="/admin/activity-logs" icon={<Bell />}>
            Nhật ký hoạt động
          </SideLink>
          <SideLink to="/admin/profile" icon={<Settings />}>
            Hồ sơ &amp; Bảo mật
          </SideLink>
        </NavGroup>
        <div className="side-bottom">
          <LogoutButton />
        </div>
      </aside>
      <main id="main-content" className="dash-main">
        {children ?? <Outlet />}
      </main>
    </DashboardShell>
  );
}
