import { Link, Outlet } from "react-router-dom";
import {
  Bell,
  BarChart3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { BrandLogo } from "../components/BrandMark";
import { DashboardShell } from "./DashboardShell";
import { LogoutButton, SideLink } from "./WorkspaceNavigation";

export function StaffLayout() {
  return (
    <DashboardShell title="Nhân viên MediaHub">
      <aside className="side">
        <Link className="brand side-brand" to="/">
          <BrandLogo />
        </Link>
        <p className="side-label">NHÂN VIÊN MEDIAHUB</p>
        <SideLink to="/staff/dashboard" icon={<LayoutDashboard />}>
          Công việc của tôi
        </SideLink>
        <SideLink to="/staff/requests" icon={<MessageCircle />}>
          Yêu cầu dịch vụ
        </SideLink>
        <SideLink to="/staff/orders" icon={<FileText />}>
          Đơn dịch vụ
        </SideLink>
        <SideLink to="/staff/finance" icon={<BarChart3 />}>
          Thống kê tháng
        </SideLink>
        <SideLink to="/staff/support" icon={<Users />}>
          Hàng đợi hỗ trợ
        </SideLink>
        <SideLink to="/staff/notifications" icon={<Bell />}>
          Thông báo
        </SideLink>
        <SideLink to="/staff/profile" icon={<Settings />}>
          Hồ sơ &amp; Bảo mật
        </SideLink>
        <div className="side-bottom">
          <LogoutButton />
        </div>
      </aside>
      <main id="main-content" className="dash-main">
        <Outlet />
      </main>
    </DashboardShell>
  );
}

export function CreatorLayout() {
  return (
    <DashboardShell title="Creator MediaHub">
      <aside className="side">
        <Link className="brand side-brand" to="/">
          <BrandLogo />
        </Link>
        <p className="side-label">CREATOR MEDIAHUB</p>
        <SideLink to="/creator/dashboard" icon={<FolderKanban />}>
          Công việc của tôi
        </SideLink>
        <SideLink to="/creator/notifications" icon={<Bell />}>
          Thông báo
        </SideLink>
        <SideLink to="/creator/profile" icon={<Settings />}>
          Hồ sơ &amp; Bảo mật
        </SideLink>
        <div className="side-bottom">
          <LogoutButton />
        </div>
      </aside>
      <main id="main-content" className="dash-main">
        <Outlet />
      </main>
    </DashboardShell>
  );
}
