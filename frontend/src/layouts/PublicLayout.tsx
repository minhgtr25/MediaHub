import { BrandLogo } from "../components/BrandMark";
import { useAuth } from "../contexts/AuthContext";
import { workspaceHome } from "../lib/permissions";
import { requestsHome } from "../lib/requests";
import { CompanyContact } from "../contexts/SiteSettings";
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, Menu, MessageCircle, X } from "lucide-react";

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
  const workspace = home.endsWith("/dashboard")
    ? home.slice(0, -10)
    : "/messages";
  useEffect(() => setOpen(false), [location.pathname]);
  return (
    <div className={`app${isAuthPage ? " auth-layout" : ""}`}>
      <a className="skip-link" href="#main-content">
        Đi đến nội dung chính
      </a>
      <header className="topbar">
        <Link className="brand" to="/">
          <BrandLogo />
        </Link>
        <nav className={open ? "mobile-nav" : "desktop-nav"}>
          {nav.map(([t, h]) => (
            <NavLink
              key={t}
              to={h}
              end={h === "/"}
              onClick={() => setOpen(false)}
            >
              {t}
            </NavLink>
          ))}
        </nav>
        <div className="top-actions">
          {auth.currentUser && (
            <Link
              className="icon-btn"
              aria-label="Hội thoại dịch vụ"
              to={
                auth.role === "CREATOR" || auth.role === "STUDENT_CREATOR"
                  ? home
                  : requestsHome(auth.role)
              }
            >
              <MessageCircle size={18} />
            </Link>
          )}
          <Link
            className="icon-btn"
            aria-label="Thông báo"
            to={
              auth.currentUser
                ? workspace === "/messages"
                  ? home
                  : `${workspace}/notifications`
                : "/login"
            }
          >
            <Bell size={18} />
          </Link>
          <Link to={auth.currentUser ? home : "/login"} className="login-link">
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
function Footer() {
  return (
    <footer id="about" className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand" to="/">
            <BrandLogo />
          </Link>
          <p>
            MediaHub kết nối doanh nghiệp với nguồn nhân lực trẻ sáng tạo, cung
            cấp giải pháp truyền thông và quản lý dự án từ tư vấn đến bàn giao.
          </p>
          <Link className="footer-consult" to="/request-project">
            Trao đổi nhu cầu với MediaHub →
          </Link>
        </div>
        <div>
          <h2>Dịch vụ</h2>
          <Link to="/services">Dịch vụ &amp; Báo giá</Link>
          <Link to="/creators">Tìm Creator phù hợp</Link>
          <Link to="/projects">Dự án tiêu biểu</Link>
          <Link to="/process">Quy trình thực hiện</Link>
          <Link to="/request-project">Yêu cầu tư vấn</Link>
        </div>
        <div>
          <h2>MediaHub</h2>
          <Link to="/about">Giới thiệu về chúng tôi</Link>
          <Link to="/partners">Đối tác MediaHub</Link>
          <Link to="/creator-application">Ứng tuyển Creator</Link>
          <Link to="/business-contact">Liên hệ doanh nghiệp</Link>
          <Link to="/contact">Hỗ trợ khách hàng</Link>
        </div>
        <div>
          <h2>Liên hệ &amp; hỗ trợ</h2>
          <CompanyContact />
          <Link to="/contact">Liên hệ MediaHub</Link>
          <Link to="/privacy">Chính sách bảo mật</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} MediaHub Creative Agency.</p>
        <nav aria-label="Quy định và chính sách">
          <Link to="/operating-rules">Quy chế hoạt động</Link>
          <Link to="/terms">Điều khoản dịch vụ</Link>
          <Link to="/privacy">Bảo mật</Link>
          <Link to="/payment-policy">Thanh toán</Link>
        </nav>
      </div>
    </footer>
  );
}
