// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Profile = {
  id: string;
  auth_user_id: string;
  role: "CUSTOMER" | "ADMIN" | "STAFF";
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};
export type ProfileInsert = {
  id?: string;
  auth_user_id: string;
  role?: "CUSTOMER" | "ADMIN" | "STAFF";
  full_name: string;
  email: string;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type ProfileUpdate = Partial<ProfileInsert>;
