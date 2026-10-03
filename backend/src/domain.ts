export const roles = ["CUSTOMER", "STAFF", "CREATOR", "ADMIN"] as const;
// Existing identities keep access until their relationships are explicitly migrated.
export const persistedRoles = [...roles, "BUSINESS", "STUDENT_CREATOR"] as const;
export type Role = (typeof persistedRoles)[number];
export const customerRoles: Role[] = ["CUSTOMER", "BUSINESS"];
export const commerceRoles: Role[] = [...customerRoles, "ADMIN"];
export const supportRoles: Role[] = [...commerceRoles, "STAFF"];
export function isCustomerRole(role: string | null): boolean {
  return role === "CUSTOMER" || role === "BUSINESS";
}

export const transitions: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["REVIEWING", "CANCELLED"],
  REVIEWING: ["QUOTATION_SENT", "CANCELLED"],
  QUOTATION_SENT: ["QUOTATION_ACCEPTED", "CANCELLED"],
  QUOTATION_ACCEPTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_REVIEW"],
  WAITING_REVIEW: ["REVISION", "COMPLETED"],
  REVISION: ["WAITING_REVIEW"],
  COMPLETED: [],
  CANCELLED: [],
};
export function canAccess(
  role: string,
  customerId: string | null,
  owner: string,
) {
  return role === "ADMIN" || (isCustomerRole(role) && customerId !== null && customerId === owner);
}
export function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
