import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function NavGroup({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <details className="side-group" open={active}>
      <summary data-short={label.slice(0, 1)}>
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="side-group-links">{children}</div>
    </details>
  );
}
export function SideLink({
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
  const creating =
    to.endsWith("/requests") && location.pathname === `${to}/new`;
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
export function LogoutButton() {
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
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} />
        <span>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</span>
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
