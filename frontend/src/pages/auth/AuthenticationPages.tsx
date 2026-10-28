import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  LockKeyhole,
  Mail,
  Palette,
  School,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../services";
import { ActionForm } from "../../components/ui";
import { loginDestination, workspaceHome } from "../../lib/permissions";
import { authErrorMessage, readAuthCallback } from "../../lib/auth";

export function Login() {
  return <AuthScreen mode="login" />;
}
export function Register() {
  return <AuthScreen mode="register" />;
}
export function ForgotPassword() {
  return <AuthScreen mode="forgot" />;
}
export function ResetPassword() {
  return <AuthScreen mode="reset" />;
}

function AuthScreen({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const auth = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const callbackError = readAuthCallback(window.location.href).error;
  const role = "client";
  const title = {
    login: "Chào mừng trở lại!",
    register: "Bắt đầu cùng MediaHub",
    forgot: "Quên mật khẩu?",
    reset: "Tạo mật khẩu mới",
  }[mode];
  const destination = (location.state as { from?: string } | null)?.from;
  if (auth.passwordSetup && auth.currentUser && mode !== "reset")
    return <Navigate to="/reset-password" replace />;
  if (auth.role && !callbackError && (mode === "login" || mode === "register"))
    return <Navigate to={loginDestination(auth.role, destination)} replace />;
  return (
    <div className="auth-page">
      <section className="auth-art">
        <div className="auth-network-tag">
          <span /> Mạng lưới sáng tạo toàn quốc
        </div>
        <h1>
          Kết nối sáng tạo — <span>Bứt phá</span> nội dung truyền thông
        </h1>
        <p>
          MediaHub đồng hành cùng doanh nghiệp tối ưu chi phí sản xuất và trao
          cơ hội dự án thực chiến chuẩn agency cho thế hệ tài năng trẻ.
        </p>
        <div className="auth-audience-grid">
          <article>
            <span className="auth-audience-icon orange">
              <Building2 />
            </span>
            <h3>Dành cho Doanh nghiệp</h3>
            <p>Làm rõ ngân sách và phạm vi sản xuất truyền thông.</p>
            <small>
              <BadgeCheck /> Kiểm soát chất lượng trước bàn giao
            </small>
          </article>
          <article>
            <span className="auth-audience-icon violet">
              <Palette />
            </span>
            <h3>Dành cho Creator &amp; SV</h3>
            <p>Thực chiến với nhãn hàng lớn &amp; nhận thù lao minh bạch.</p>
            <small>
              <CreditCard /> Trao đổi tiến độ và bàn giao tập trung
            </small>
          </article>
        </div>
        <img
          className="auth-preview"
          src="/assets/brand/mediahub-hero.png"
          alt="Minh họa thương hiệu MediaHub và các lĩnh vực sáng tạo"
        />
        <div className="auth-trust-row">
          <div>
            <strong>Quản lý từ yêu cầu đến nghiệm thu</strong>
            <span>Báo giá và tiến độ minh bạch</span>
          </div>
          <span>
            <ShieldCheck /> Theo dõi phạm vi và bàn giao
          </span>
        </div>
      </section>
      <section className="auth-card" key={mode}>
        {(mode === "login" || mode === "register") && (
          <div className="auth-tabs">
            <Link
              className={mode === "login" ? "active" : ""}
              to="/login"
              state={location.state}
            >
              <LockKeyhole /> Đăng nhập
            </Link>
            <Link
              className={mode === "register" ? "active" : ""}
              to="/register"
              state={location.state}
            >
              <UserRound /> Đăng ký
            </Link>
          </div>
        )}
        <h2>{title}</h2>
        <p>
          {mode === "forgot"
            ? "Nhập email tài khoản để nhận liên kết khôi phục mật khẩu."
            : "Không gian dành cho những ý tưởng lớn tiếp theo của bạn."}
        </p>
        {mode === "register" && (
          <p>
            Tài khoản đăng ký tại đây dành cho khách hàng. Muốn hợp tác với vai
            trò Creator, hãy{" "}
            <Link to="/creator-application">gửi hồ sơ ứng tuyển</Link>; Admin
            cấp tài khoản sau hợp đồng hợp tác.
          </p>
        )}
        {callbackError && (
          <p className="error" role="alert">
            {callbackError}
          </p>
        )}
        {mode === "reset" && auth.loading ? (
          <p role="status">Đang kiểm tra liên kết khôi phục…</p>
        ) : mode === "reset" && (!auth.currentUser || callbackError) ? (
          <div className="notice">
            <p>
              Liên kết khôi phục không hợp lệ hoặc phiên xác thực đã hết hạn.
            </p>
            <Link to="/forgot-password">Gửi lại liên kết khôi phục</Link>
          </div>
        ) : (
          !completed && (
            <ActionForm
              showSuccess={false}
              label={
                {
                  login: "Đăng nhập",
                  register: "Tạo tài khoản",
                  forgot: "Gửi liên kết khôi phục",
                  reset: "Cập nhật mật khẩu",
                }[mode]
              }
              onSubmit={async (data) => {
                setMessage("");
                const email = String(data.get("email") ?? ""),
                  password = String(data.get("password") ?? "");
                if (
                  (mode === "register" || mode === "reset") &&
                  password !== data.get("confirm")
                )
                  throw new Error("Mật khẩu xác nhận chưa khớp.");
                const result =
                  mode === "login"
                    ? await authService.login(email, password)
                    : mode === "register"
                      ? await authService.register(
                          email,
                          password,
                          String(data.get("full_name")),
                          {
                            audience: role,
                            organization: String(
                              data.get("organization") ?? "",
                            ),
                          },
                        )
                      : mode === "forgot"
                        ? await authService.forgot(email)
                        : await authService.reset(password);
                if (result.error)
                  throw new Error(authErrorMessage(result.error));
                if (mode === "login") return; // AuthProvider verifies the profile before entering a workspace.
                if (mode === "reset") {
                  auth.completePasswordSetup();
                  setCompleted(true);
                }
                setMessage(
                  mode === "forgot"
                    ? "Nếu email đã được đăng ký, bạn sẽ nhận được liên kết khôi phục. Vui lòng kiểm tra cả thư rác."
                    : mode === "register"
                      ? "Vui lòng kiểm tra email để xác nhận đăng ký. Nếu email đã có tài khoản, hãy đăng nhập hoặc dùng chức năng quên mật khẩu."
                      : mode === "reset"
                        ? "Đã cập nhật mật khẩu. Bạn có thể tiếp tục vào tài khoản."
                        : "Đăng nhập thành công. Đang tải tài khoản…",
                );
              }}
            >
              {mode === "register" && (
                <>
                  <AuthField
                    name="full_name"
                    label="Họ và tên"
                    icon={<UserRound />}
                    placeholder="Nguyễn Văn A"
                    maxLength={150}
                  />
                  <AuthField
                    name="organization"
                    label={
                      role === "client"
                        ? "Tên thương hiệu / Công ty"
                        : "Trường ĐH / Chuyên ngành sáng tạo"
                    }
                    icon={role === "client" ? <Building2 /> : <School />}
                    placeholder={
                      role === "client"
                        ? "VD: The Coffee House, Glowy Cosmetics..."
                        : "VD: ĐH FPT (Truyền thông số)..."
                    }
                    required={false}
                    maxLength={200}
                  />
                </>
              )}
              {mode !== "reset" && (
                <AuthField
                  name="email"
                  label="Email doanh nghiệp / cá nhân"
                  type="email"
                  icon={<Mail />}
                  placeholder="name@company.com"
                  maxLength={254}
                />
              )}
              {mode !== "forgot" && (
                <AuthField
                  name="password"
                  label="Mật khẩu"
                  type="password"
                  icon={<Lock />}
                  placeholder={
                    mode === "login" ? "Nhập mật khẩu" : "Ít nhất 8 ký tự"
                  }
                  minLength={mode === "login" ? undefined : 8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  maxLength={128}
                />
              )}
              {(mode === "register" || mode === "reset") && (
                <AuthField
                  name="confirm"
                  label="Xác nhận mật khẩu"
                  type="password"
                  icon={<Lock />}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  maxLength={128}
                />
              )}
              {mode === "login" && (
                <p className="auth-foot">
                  <Link to="/forgot-password">Quên mật khẩu?</Link>
                </p>
              )}
            </ActionForm>
          )
        )}
        {completed && (
          <Link className="btn btn-primary" to={workspaceHome(auth.role)}>
            Tiếp tục vào tài khoản
          </Link>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {auth.error && mode !== "reset" && (
          <p className="error" role="alert">
            {auth.error}
            <button className="btn btn-ghost" onClick={auth.refresh}>
              Thử tải lại tài khoản
            </button>
            {auth.currentUser && (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  auth
                    .logout()
                    .catch((e) => setLogoutError(authErrorMessage(e)))
                }
              >
                Đăng xuất
              </button>
            )}
          </p>
        )}
        {logoutError && (
          <p className="error" role="alert">
            {logoutError}
          </p>
        )}
        <p className="auth-foot">
          <Link
            to={mode === "login" ? "/register" : "/login"}
            state={location.state}
          >
            {mode === "login"
              ? "Chưa có tài khoản? Đăng ký ngay"
              : "Trở về đăng nhập"}{" "}
            <ArrowRight size={13} />
          </Link>
        </p>
        <div className="auth-security">
          <Shield /> Đăng nhập bằng tài khoản MediaHub của bạn
        </div>
      </section>
    </div>
  );
}
function AuthField({
  name,
  label,
  icon,
  type = "text",
  placeholder,
  required = true,
  minLength,
  maxLength,
  autoComplete,
}: {
  name: string;
  label: string;
  icon: ReactNode;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <div className="auth-field field">
      <label htmlFor={name}>{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">{icon}</span>
        <input
          id={name}
          name={name}
          type={password && visible ? "text" : type}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={
            autoComplete ??
            (name === "email"
              ? "email"
              : password
                ? "current-password"
                : name === "full_name"
                  ? "name"
                  : name === "organization"
                    ? "organization"
                    : undefined)
          }
        />
        {password && (
          <button
            type="button"
            className="auth-password-toggle"
            aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>
    </div>
  );
}
