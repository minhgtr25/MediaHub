import { BrandLogo } from "../components/BrandMark";
import { DashboardShell } from "./DashboardShell";
import { useAuth } from "../contexts/AuthContext";
import { workspaceHome } from "../lib/permissions";
import { requestsHome } from "../lib/requests";
import { CompanyContact } from "../contexts/SiteSettings";
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  FileText,
  Menu,
  X,
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  BriefcaseBusiness,
  Settings,
  Palette,
  LogOut,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
const nav = [
  ["Trang chủ", "/"],
  ["Tìm Creator", "/creators"],
  ["Dự án", "/projects"],
  ["Quy trình", "/process"],
  ["Dịch vụ", "/services"],
  ["Về chúng tôi", "/about"],
];
export function PublicLayout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  const location = useLocation();
  const isAuthPage = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(location.pathname);
  const home = workspaceHome(auth.role);
  const workspace = home.endsWith("/dashboard") ? home.slice(0, -10) : "/messages";
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className={`app${isAuthPage ? " auth-layout" : ""}`}>
      <a className="skip-link" href="#main-content">Đi đến nội dung chính</a>
      <header className="topbar">
        <Link className="brand" to="/"><BrandLogo /></Link>
        <nav className={open ? "mobile-nav" : "desktop-nav"}>
          {nav.map(([t, h]) => (
            <NavLink key={t} to={h} end={h === "/"} onClick={() => setOpen(false)}>
              {t}
            </NavLink>
          ))}
        </nav>
        <div className="top-actions">
          {auth.currentUser && <Link className="icon-btn" aria-label="Hội thoại dịch vụ" to={auth.role === "CREATOR" || auth.role === "STUDENT_CREATOR" ? home : requestsHome(auth.role)}><MessageCircle size={18}/></Link>}
          <Link
            className="icon-btn"
            aria-label="Thông báo"
            to={auth.currentUser ? workspace === "/messages" ? home : `${workspace}/notifications` : "/login"}
          >
            <Bell size={18} />
          </Link>
          <Link
            to={auth.currentUser ? home : "/login"}
            className="login-link"
          >
            {auth.currentUser ? "Tài khoản" : "Đăng nhập"}
          </Link>
          <Link to="/request-project" className="btn btn-primary">
            Yêu cầu tư vấn
          </Link>
          <button
            className="menu-btn"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div id="main-content" className="public-content" tabIndex={-1}>
        {children ?? <Outlet />}
      </div>
      <Footer />
    </div>
  );
}
export function CustomerLayout({ children }: { children?: ReactNode }) {
  return (
    <DashboardShell title="Customer">
      <aside className="side">
        <Link className="brand side-brand" to="/"><BrandLogo /></Link>
        <p className="side-label">TỔNG QUAN</p>
        <SideLink to="/customer/dashboard" icon={<LayoutDashboard />}>Tổng quan</SideLink>
        <p className="side-label">DỊCH VỤ</p>
        <SideLink to="/customer/requests/new" icon={<FileText />}>Gửi yêu cầu</SideLink>
        <SideLink to="/customer/requests" icon={<MessageCircle />}>Yêu cầu tư vấn</SideLink>
        <p className="side-label">CÔNG VIỆC</p>
        <SideLink to="/customer/orders" icon={<FileText />}>Đơn dịch vụ</SideLink>
        <SideLink to="/customer/projects" icon={<FolderKanban />}>Dự án</SideLink>
        <p className="side-label">TÀI CHÍNH</p>
        <SideLink to="/customer/quotations" icon={<BriefcaseBusiness />}>Báo giá</SideLink>
        <SideLink to="/customer/payments" icon={<BarChart3 />}>Thanh toán</SideLink>
        <SideLink to="/customer/invoices" icon={<FileText />}>Hóa đơn</SideLink>
        <p className="side-label">TÀI KHOẢN</p>
        <SideLink to="/customer/notifications" icon={<Bell />}>Thông báo</SideLink>
        <SideLink to="/customer/profile" icon={<Settings />}>Hồ sơ &amp; Bảo mật</SideLink>
        <div className="side-bottom">
          <LogoutButton />
        </div>
      </aside>
      <main id="main-content" className="dash-main">{children ?? <Outlet />}</main>
    </DashboardShell>
  );
}
export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <DashboardShell title="Admin">
      <aside className="side">
        <Link className="brand side-brand" to="/"><BrandLogo /></Link>
        <p className="side-label">QUẢN TRỊ HỆ THỐNG</p>
        <SideLink to="/admin/requests" icon={<MessageCircle />}>Yêu cầu dịch vụ</SideLink><SideLink to="/admin/orders" icon={<FileText />}>Đơn dịch vụ</SideLink>
        <SideLink to="/admin/service-packages" icon={<BriefcaseBusiness />}>Gói dịch vụ</SideLink>
        <SideLink to="/admin/support" icon={<Users/>}>Hỗ trợ khách hàng</SideLink><SideLink to="/admin/payments" icon={<BarChart3/>}>Cọc & Thanh toán</SideLink><SideLink to="/admin/payment-settings" icon={<Settings/>}>Ngân hàng & QR</SideLink>
        <SideLink to="/admin/dashboard" icon={<LayoutDashboard />}>
          Tổng quan
        </SideLink>
        <SideLink to="/admin/files" icon={<FolderKanban />}>
          Files
        </SideLink>
        <SideLink to="/admin/users" icon={<Users />}>
          Tài khoản
        </SideLink>
        <SideLink to="/admin/quotations" icon={<BriefcaseBusiness />}>
          Báo giá
        </SideLink>
        <SideLink to="/admin/invoices" icon={<BarChart3 />}>
          Hóa đơn
        </SideLink>
        <SideLink to="/admin/leads" icon={<Users />}>
          Liên hệ & ứng tuyển
        </SideLink>
        <SideLink to="/admin/partners" icon={<Users />}>
          Đối tác
        </SideLink>
        <SideLink to="/admin/process" icon={<FolderKanban />}>
          Xem quy trình
        </SideLink>
        <SideLink to="/admin/creators" icon={<Users />}>Cấp tài khoản Creator</SideLink>
        <SideLink to="/admin/settings" icon={<Settings />}>
          Nội dung website
        </SideLink>
        <SideLink to="/admin/activity-logs" icon={<Bell />}>
          Nhật ký hoạt động
        </SideLink>
        <SideLink to="/admin/projects" icon={<FolderKanban />}>
          Dự án
        </SideLink>
        <SideLink to="/admin/customers" icon={<Users />}>
          Khách hàng
        </SideLink>
        <SideLink to="/admin/revenue" icon={<BarChart3 />}>
          Doanh số
        </SideLink>
        <SideLink to="/admin/employees" icon={<BriefcaseBusiness />}>
          Nhân viên
        </SideLink>
        <SideLink to="/admin/services" icon={<Palette />}>
          Dịch vụ
        </SideLink>
        <SideLink to="/admin/portfolio" icon={<BriefcaseBusiness />}>
          Hồ sơ dự án
        </SideLink>
        <SideLink to="/admin/testimonials" icon={<Users />}>
          Đánh giá
        </SideLink>
        <SideLink to="/admin/case-studies" icon={<BriefcaseBusiness />}>Duyệt dự án tiêu biểu</SideLink>
        <SideLink to="/admin/finance" icon={<BarChart3 />}>Tài chính &amp; nhân viên</SideLink>
        <SideLink to="/admin/notifications" icon={<Bell />}>
          Thông báo
        </SideLink>
        <SideLink to="/admin/profile" icon={<Settings />}>
          Hồ sơ & Bảo mật
        </SideLink>
        <div className="side-bottom">
          <LogoutButton />
        </div>
      </aside>
      <main id="main-content" className="dash-main">{children ?? <Outlet />}</main>
    </DashboardShell>
  );
}
function SideLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const location = useLocation();
  const label = typeof children === "string" ? children : undefined;
  const creating = to.endsWith("/requests") && location.pathname === `${to}/new`;
  return (
    <NavLink
      aria-label={label}
      title={label}
      end={creating}
      className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}
      to={to}
    >
      {icon}
      <span>{children}</span>
    </NavLink>
  );
}
function LogoutButton() {
  const auth = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="side-link logout-button"
        aria-label="Đăng xuất"
        title="Đăng xuất"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try {
            setError("");
            await auth.logout();
          } catch (e) {
            setError((e as Error).message);
          } finally { setBusy(false); }
        }}
      >
        <LogOut size={16} /><span>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</span>
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
function Footer() {
  return <footer id="about" className="site-footer"><div className="footer-main"><div className="footer-brand"><Link className="brand" to="/"><BrandLogo/></Link><p>MediaHub kết nối doanh nghiệp với nguồn nhân lực trẻ sáng tạo, cung cấp giải pháp truyền thông và quản lý dự án từ tư vấn đến bàn giao.</p><Link className="footer-consult" to="/request-project">Trao đổi nhu cầu với MediaHub →</Link></div><div><h2>Dịch vụ</h2><Link to="/services">Dịch vụ &amp; Báo giá</Link><Link to="/creators">Tìm Creator phù hợp</Link><Link to="/projects">Dự án tiêu biểu</Link><Link to="/process">Quy trình thực hiện</Link><Link to="/request-project">Yêu cầu tư vấn</Link></div><div><h2>MediaHub</h2><Link to="/about">Giới thiệu về chúng tôi</Link><Link to="/partners">Đối tác MediaHub</Link><Link to="/creator-application">Ứng tuyển Creator</Link><Link to="/business-contact">Liên hệ doanh nghiệp</Link><Link to="/contact">Hỗ trợ khách hàng</Link></div><div><h2>Liên hệ &amp; hỗ trợ</h2><CompanyContact/><Link to="/contact">Liên hệ MediaHub</Link><Link to="/privacy">Chính sách bảo mật</Link></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} MediaHub Creative Agency.</p><nav aria-label="Quy định và chính sách"><Link to="/operating-rules">Quy chế hoạt động</Link><Link to="/terms">Điều khoản dịch vụ</Link><Link to="/privacy">Bảo mật</Link><Link to="/payment-policy">Thanh toán</Link></nav></div></footer>;
}

export function StaffLayout() { return <DashboardShell title="Nhân viên MediaHub"><aside className="side"><Link className="brand side-brand" to="/"><BrandLogo /></Link><p className="side-label">NHÂN VIÊN MEDIAHUB</p><SideLink to="/staff/dashboard" icon={<LayoutDashboard />}>Công việc của tôi</SideLink><SideLink to="/staff/requests" icon={<MessageCircle />}>Yêu cầu dịch vụ</SideLink><SideLink to="/staff/orders" icon={<FileText />}>Đơn dịch vụ</SideLink><SideLink to="/staff/finance" icon={<BarChart3 />}>Thống kê tháng</SideLink><SideLink to="/staff/support" icon={<Users />}>Hàng đợi hỗ trợ</SideLink><SideLink to="/staff/notifications" icon={<Bell />}>Thông báo</SideLink><SideLink to="/staff/profile" icon={<Settings />}>Hồ sơ &amp; Bảo mật</SideLink><div className="side-bottom"><LogoutButton /></div></aside><main id="main-content" className="dash-main"><Outlet /></main></DashboardShell>; }

export function CreatorLayout() { return <DashboardShell title="Creator MediaHub"><aside className="side"><Link className="brand side-brand" to="/"><BrandLogo /></Link><p className="side-label">CREATOR MEDIAHUB</p><SideLink to="/creator/dashboard" icon={<FolderKanban/>}>Công việc của tôi</SideLink><SideLink to="/creator/notifications" icon={<Bell/>}>Thông báo</SideLink><SideLink to="/creator/profile" icon={<Settings/>}>Hồ sơ &amp; Bảo mật</SideLink><div className="side-bottom"><LogoutButton/></div></aside><main id="main-content" className="dash-main"><Outlet/></main></DashboardShell>; }
