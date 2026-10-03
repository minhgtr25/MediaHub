export const roles = ["CUSTOMER", "STAFF", "CREATOR", "ADMIN"] as const;
export const persistedRoles = [...roles, "BUSINESS", "STUDENT_CREATOR"] as const;
export type Role = (typeof persistedRoles)[number];
export function isCustomerRole(role: string | null): boolean {
  return role === "CUSTOMER" || role === "BUSINESS";
}
export function workspaceHome(role: string | null): string {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "STAFF") return "/staff/dashboard";
  if (role === "CREATOR" || role === "STUDENT_CREATOR") return "/creator/dashboard";
  if (isCustomerRole(role)) return "/customer/dashboard";
  return "/messages";
}
export function loginDestination(role: string, destination?: string): string {
  const home = workspaceHome(role);
  if (!destination || !destination.startsWith("/") || destination.startsWith("//") || /[\\\r\n]/.test(destination)) return home;
  const parsed = new URL(destination, "https://mediahub.invalid");
  if (parsed.origin !== "https://mediahub.invalid") return home;
  const path = parsed.pathname;
  const result = path + parsed.search + parsed.hash;
  if (path === "/messages" || path.startsWith("/messages/")) return result;
  if (/^\/creators\/[a-z0-9-]+$/.test(path)) return result;
  if (isCustomerRole(role) && path === "/request-project") return result;
  const prefix = home.slice(0, home.lastIndexOf("/"));
  if (prefix && (path === prefix || path.startsWith(prefix + "/"))) return result;
  return home;
}
