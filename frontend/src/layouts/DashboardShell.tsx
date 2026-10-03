import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { dashboardBreadcrumbs, dashboardRoleLabel, dashboardSearchDestination, sidebarPreferenceKey } from "../lib/dashboard";
import { workspaceHome } from "../lib/permissions";

export function DashboardShell({ children }: { children: ReactNode; title: string }) {
  const auth = useAuth(), location = useLocation(), navigate = useNavigate();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const [open, setOpen] = useState(false), [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false), [logoutBusy, setLogoutBusy] = useState(false), [error, setError] = useState("");
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("search") || "");
  const navigation = useRef<HTMLDivElement>(null), toggle = useRef<HTMLButtonElement>(null), account = useRef<HTMLDivElement>(null);
  const home = workspaceHome(auth.role), prefix = home.slice(0, home.lastIndexOf("/"));
  const roleLabel = dashboardRoleLabel(auth.role), creator = prefix === "/creator";
  const key = auth.profile && auth.role ? sidebarPreferenceKey(auth.profile.id, auth.role) : null;
  const [sidebar, ...content] = Children.toArray(children);

  useEffect(() => {
    try { setCollapsed(key ? localStorage.getItem(key) === "true" : false); }
    catch { setCollapsed(false); }
  }, [key]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const change = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => { setOpen(false); setAccountOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get("search") || ""); }, [location.search]);
  useEffect(() => {
    if (!mobile || !open) return;
    const panel = navigation.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab" || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      toggle.current?.focus();
    };
  }, [mobile, open]);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: PointerEvent) => { if (!account.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAccountOpen(false); account.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [accountOpen]);

  function toggleSidebar() {
    if (mobile) { setOpen(value => !value); return; }
    const next = !collapsed;
    setCollapsed(next);
    try { if (key) localStorage.setItem(key, String(next)); } catch { /* Geometry stays usable when storage is denied. */ }
  }
  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true); setError("");
    try { await auth.logout(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setLogoutBusy(false); }
  }
  const name = auth.profile?.full_name || "Tài khoản MediaHub";
  const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
  return <div className={`dashboard-shell dashboard-frame${!mobile && collapsed ? " sidebar-collapsed" : ""}${mobile && open ? " drawer-open" : ""}`}>
    <a className="skip-link" href="#main-content">Đi đến nội dung chính</a>
    {mobile && open && <button className="drawer-backdrop" aria-label="Đóng menu điều hướng" onClick={() => setOpen(false)} tabIndex={-1}/>}
    <div id="dashboard-navigation" className="dashboard-navigation" ref={navigation} role={mobile && open ? "dialog" : "navigation"} aria-modal={mobile && open ? true : undefined} aria-label={`Điều hướng ${roleLabel}`} inert={mobile && !open} onClick={event => {
      const target = event.target as HTMLElement;
      if (target.closest("a")) setOpen(false);
      // Only unused container space toggles: controls, links and their labels keep their action.
      if (!mobile && target.matches("div, aside") && !target.closest('a, button, input, select, textarea, label, [role="button"]')) toggleSidebar();
    }}>
      {mobile && <button className="icon-btn dashboard-drawer-close" aria-label="Đóng menu" onClick={() => setOpen(false)}><X size={20}/></button>}
      {sidebar}
      {!mobile && <button className="sidebar-bottom-toggle" type="button" onClick={toggleSidebar} aria-controls="dashboard-navigation" aria-expanded={!collapsed} aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"} title={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}>{collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}<span>{collapsed ? "Mở rộng" : "Thu gọn thanh điều hướng"}</span></button>}
    </div>
    <div className="dashboard-body" inert={mobile && open}>
      <header className="workspace-header">
        {mobile && <button ref={toggle} className="icon-btn workspace-nav-toggle" type="button" onClick={toggleSidebar} aria-controls="dashboard-navigation" aria-expanded={mobile ? open : !collapsed} aria-label={mobile ? "Mở menu" : collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"} title={mobile ? "Mở menu" : collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}>
          {mobile ? <Menu size={20}/> : collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}
        </button>}
        <nav className="workspace-breadcrumbs" aria-label="Đường dẫn">
          <ol>{dashboardBreadcrumbs(auth.role, location.pathname).map((crumb, index) => <li key={index}>{index > 0 && <ChevronRight size={14} aria-hidden="true"/>}{crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}</li>)}</ol>
        </nav>
        <form className="workspace-search" role="search" onSubmit={event => { event.preventDefault(); navigate(dashboardSearchDestination(auth.role, search)); }}>
          <label className="sr-only" htmlFor="workspace-search">{creator ? "Tìm công việc của tôi" : "Tìm yêu cầu tư vấn"}</label>
          <input id="workspace-search" type="search" maxLength={150} value={search} onChange={event => setSearch(event.target.value)} placeholder={creator ? "Tìm công việc của tôi…" : "Tìm yêu cầu tư vấn…"}/>
          <button type="submit" className="icon-btn" aria-label="Tìm kiếm"><Search size={18}/></button>
        </form>
        <Link to={`${prefix}/notifications`} className="icon-btn workspace-notifications" title="Thông báo" aria-label="Thông báo"><Bell size={20}/></Link>
        <div className="workspace-account" ref={account} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}>
          <button type="button" className="workspace-account-trigger" aria-expanded={accountOpen} aria-controls="workspace-account-actions" onClick={() => setAccountOpen(value => !value)}>
            <span className="workspace-avatar">{auth.profile?.avatar_url ? <img src={auth.profile.avatar_url} alt=""/> : initials}</span>
            <span className="workspace-account-name"><b>{name}</b><small>{roleLabel}</small></span><ChevronDown size={16}/>
          </button>
          {accountOpen && <div className="workspace-account-actions" id="workspace-account-actions"><Link to={`${prefix}/profile`}><Settings size={16}/> Hồ sơ &amp; Bảo mật</Link><button type="button" disabled={logoutBusy} onClick={logout}><LogOut size={16}/>{logoutBusy ? "Đang đăng xuất…" : "Đăng xuất"}</button>{error && <p className="error" role="alert">{error}</p>}</div>}
        </div>
      </header>
      {content}
    </div>
  </div>;
}
