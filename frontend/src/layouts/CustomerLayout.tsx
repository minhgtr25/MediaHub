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
  Settings,
} from "lucide-react";
import { BrandLogo } from "../components/BrandMark";
import { DashboardShell } from "./DashboardShell";
import { LogoutButton, NavGroup, SideLink } from "./WorkspaceNavigation";

export function CustomerLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  return (
    <DashboardShell title="Customer">
      <aside className="side">
        <Link className="brand side-brand" to="/">
          <BrandLogo />
        </Link>
        <SideLink to="/customer/dashboard" icon={<LayoutDashboard />}>
          Tổng quan
        </SideLink>
        <NavGroup
          label="Dịch vụ & công việc"
          active={[
            "/customer/requests",
            "/customer/orders",
            "/customer/projects",
          ].some((path) => location.pathname.startsWith(path))}
        >
          <SideLink to="/customer/requests" icon={<MessageCircle />}>
            Yêu cầu tư vấn
          </SideLink>
          <SideLink to="/customer/requests/new" icon={<FileText />}>
            Gửi yêu cầu mới
          </SideLink>
          <SideLink to="/customer/orders" icon={<FileText />}>
            Đơn dịch vụ
          </SideLink>
          <SideLink to="/customer/projects" icon={<FolderKanban />}>
            Dự án
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Thanh toán"
          active={[
            "/customer/quotations",
            "/customer/payments",
            "/customer/invoices",
          ].some((path) => location.pathname.startsWith(path))}
        >
          <SideLink to="/customer/quotations" icon={<BriefcaseBusiness />}>
            Báo giá
          </SideLink>
          <SideLink to="/customer/payments" icon={<BarChart3 />}>
            Thanh toán
          </SideLink>
          <SideLink to="/customer/invoices" icon={<FileText />}>
            Hóa đơn
          </SideLink>
        </NavGroup>
        <NavGroup
          label="Tài khoản"
          active={
            location.pathname.includes("notifications") ||
            location.pathname.includes("profile")
          }
        >
          <SideLink to="/customer/notifications" icon={<Bell />}>
            Thông báo
          </SideLink>
          <SideLink to="/customer/profile" icon={<Settings />}>
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
