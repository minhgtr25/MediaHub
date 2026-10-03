import { isCustomerRole } from "./domain.js";
import type { Identity } from "./models/identity.model.js";
import type { ServiceRequest } from "./models/commerce.model.js";
export function canReadRequest(identity: Identity, request: Pick<ServiceRequest, "customer_id" | "assigned_to">) {
  return identity.role === "ADMIN" || (isCustomerRole(identity.role) && !!identity.customer_id && request.customer_id === identity.customer_id) || (identity.role === "STAFF" && request.assigned_to === identity.id);
}
