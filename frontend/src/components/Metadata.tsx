import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function Metadata({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    document.title = `${title} | MediaHub`;
    const values: Record<string, string> = {
      description: description ?? "MediaHub quản lý dịch vụ truyền thông từ brief đến bàn giao.",
      "og:title": `${title} | MediaHub`,
      "og:description": description ?? "Dịch vụ truyền thông MediaHub",
      "og:url": window.location.origin + window.location.pathname,
      robots: window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/customer") || window.location.pathname.startsWith("/staff") ? "noindex,nofollow" : "index,follow",
    };
    for (const [key, content] of Object.entries(values)) {
      const attribute = key.startsWith("og:") ? "property" : "name";
      let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(attribute, key);
        document.head.append(node);
      }
      node.content = content;
    }
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = window.location.origin + window.location.pathname;
  }, [title, description]);
  return null;
}

export function RouteMetadata() {
  const { pathname } = useLocation();
  const titles: Record<string, string> = {
    "/": "Dịch vụ truyền thông",
    "/about": "Về MediaHub",
    "/services": "Dịch vụ",
    "/portfolio": "Portfolio",
    "/projects": "Portfolio",
    "/creators": "Mạng lưới Creator",
    "/partners": "Đối tác",
    "/process": "Quy trình",
    "/contact": "Liên hệ",
    "/request-project": "Bắt đầu dự án",
    "/login": "Đăng nhập",
    "/register": "Đăng ký",
    "/forgot-password": "Quên mật khẩu",
    "/reset-password": "Đặt lại mật khẩu",
    "/privacy": "Chính sách bảo mật",
    "/terms": "Điều khoản sử dụng",
  };
  const title = titles[pathname] ?? (pathname.startsWith("/admin") ? "Quản trị" : pathname.startsWith("/customer") ? "Không gian khách hàng" : pathname.startsWith("/staff") ? "Không gian nhân viên" : pathname.startsWith("/creators/") ? "Hồ sơ Creator" : "MediaHub");
  return <Metadata key={pathname} title={title} />;
}
