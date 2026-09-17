import { useAuth } from "../contexts/AuthContext";
import { CompanyContact } from "../contexts/SiteSettings";
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
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
  const workspace = auth.role === "ADMIN" ? "/admin" : auth.role === "STAFF" ? "/staff" : "/customer";
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className={`app${isAuthPage ? " auth-layout" : ""}`}>
      <a className="skip-link" href="#main-content">Đi đến nội dung chính</a>
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">▶</span>
          <span>
            <b>Media</b>
            <em>Hub</em>
            <small>CREATIVE MEDIA AGENCY</small>
          </span>
        </Link>
        <nav className={open ? "mobile-nav" : "desktop-nav"}>
          {nav.map(([t, h]) => (
            <NavLink key={t} to={h} end={h === "/"} onClick={() => setOpen(false)}>
              {t}
            </NavLink>
          ))}
        </nav>
        <div className="top-actions">
          {auth.currentUser && <Link className="icon-btn" aria-label="Tin nhắn" to="/messages"><MessageCircle size={18}/></Link>}
          <Link
            className="icon-btn"
            aria-label="Thông báo"
            to={auth.currentUser ? `${workspace}/notifications` : "/login"}
          >
            <Bell size={18} />
          </Link>
          <Link
            to={auth.currentUser ? `${workspace}/dashboard` : "/login"}
            className="login-link"
          >
            {auth.currentUser ? "Tài khoản" : "Đăng nhập"}
          </Link>
          <Link to="/request-project" className="btn btn-primary">
            Đăng dự án
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
        <Link className="brand side-brand" to="/">
          <span className="brand-mark">▶</span>
          <span>
            <b>Media</b>
            <em>Hub</em>
          </span>
        </Link>
        <p className="side-label">KHÁCH HÀNG</p>
        <SideLink to="/customer/support" icon={<Users/>}>Trung tâm hỗ trợ</SideLink>
        <SideLink to="/customer/payments" icon={<BarChart3/>}>Cọc & Thanh toán</SideLink>
        <SideLink to="/customer/dashboard" icon={<LayoutDashboard />}>
          Tổng quan
        </SideLink>
        <SideLink to="/request-project" icon={<FolderKanban />}>
          Đăng dự án
        </SideLink>
        <SideLink to="/customer/projects" icon={<FolderKanban />}>
          Dự án
        </SideLink>
        <SideLink to="/customer/quotations" icon={<BriefcaseBusiness />}>
          Báo giá
        </SideLink>
        <SideLink to="/customer/invoices" icon={<BarChart3 />}>
          Hóa đơn
        </SideLink>
        <SideLink to="/customer/notifications" icon={<Bell />}>
          Thông báo
        </SideLink>
        <SideLink to="/customer/profile" icon={<Settings />}>
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
export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <DashboardShell title="Admin">
      <aside className="side">
        <Link className="brand side-brand" to="/">
          <span className="brand-mark">▶</span>
          <span>
            <b>Media</b>
            <em>Hub</em>
          </span>
        </Link>
        <p className="side-label">QUẢN TRỊ HỆ THỐNG</p>
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
          Yêu cầu khách hàng
        </SideLink>
        <SideLink to="/admin/partners" icon={<Users />}>
          Đối tác
        </SideLink>
        <SideLink to="/admin/process" icon={<FolderKanban />}>
          Quy trình
        </SideLink>
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
  return (
    <NavLink
      className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}
      to={to}
    >
      {icon}
      <span>{children}</span>
    </NavLink>
  );
}
function DashboardShell({ children }: { children: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`dashboard-shell ${open ? "drawer-open" : ""}`}>
      <button
        aria-label="Đóng menu"
        className="drawer-backdrop"
        onClick={() => setOpen(false)}
      />
      <div className="mobile-dashbar">
        <Link className="brand" to="/">
          <span className="brand-mark">▶</span>
          <span>
            <b>Media</b>
            <em>Hub</em>
          </span>
        </Link>
        <button
          className="icon-btn"
          aria-label="Mở menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="shell-content"
      >
        {children}
      </div>
    </div>
  );
}
function LogoutButton() {
  const auth = useAuth();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="side-link logout-button"
        onClick={async () => {
          try {
            setError("");
            await auth.logout();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <LogOut size={16} /> Đăng xuất
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
  return (
    <footer id="about">
      <div>
        <Link className="brand" to="/">
          <span className="brand-mark">▶</span>
          <span>
            <b>Media</b>
            <em>Hub</em>
            <small>CREATIVE MEDIA AGENCY</small>
          </span>
        </Link>
        <p>Kết nối sáng tạo – Bứt phá nội dung.</p>
      </div>
      <div>
        <b>MediaHub</b>
        <Link to="/about">Về chúng tôi</Link>
        <Link to="/projects">Dự án</Link>
        <Link to="/services">Dịch vụ</Link>
      </div>
      <div>
        <b>Dành cho khách hàng</b>
        <Link to="/request-project">Đăng dự án</Link>
        <a href="/services">Dịch vụ & Báo giá</a>
        <a href="mailto:hello@mediahub.vn">Hỗ trợ</a>
      </div>
      <div>
        <b>Liên hệ</b>
        <CompanyContact />
        <Link to="/contact">Liên hệ MediaHub</Link>
        <Link to="/privacy">Chính sách bảo mật</Link>
        <Link to="/terms">Điều khoản sử dụng</Link>
      </div>
    </footer>
  );
}

export function StaffLayout(){return <DashboardShell title="Nhân viên hỗ trợ"><aside className="side"><Link className="brand side-brand" to="/"><span className="brand-mark">▶</span><b>MediaHub</b></Link><p className="side-label">NHÂN VIÊN HỖ TRỢ</p><SideLink to="/staff/dashboard" icon={<LayoutDashboard/>}>Hàng đợi hỗ trợ</SideLink><SideLink to="/staff/notifications" icon={<Bell/>}>Thông báo</SideLink><SideLink to="/staff/profile" icon={<Settings/>}>Hồ sơ & Bảo mật</SideLink><div className="side-bottom"><LogoutButton/></div></aside><main id="main-content" className="dash-main"><Outlet/></main></DashboardShell>}
