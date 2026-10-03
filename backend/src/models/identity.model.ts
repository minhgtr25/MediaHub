import type { Role } from "../domain.js";
// Stored marketplace roles are preserved; permissions are defined in domain.ts.
export type Identity = {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  company_name: string | null;
  notification_preferences: { email: boolean; in_app: boolean };
  role: Role;
  customer_id: string | null;
};
