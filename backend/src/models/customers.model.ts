// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Customer = {
  id: string;
  profile_id: string;
  company_name: string | null;
  industry: string | null;
  address: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export type CustomerInsert = {
  id?: string;
  profile_id: string;
  company_name?: string | null;
  industry?: string | null;
  address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type CustomerUpdate = Partial<CustomerInsert>;
