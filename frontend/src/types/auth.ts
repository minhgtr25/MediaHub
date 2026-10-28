import type { Role } from "../lib/permissions";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone: string | null;
  avatar_url: string | null;
  company_name: string | null;
  notification_preferences: { email: boolean; in_app: boolean };
};
