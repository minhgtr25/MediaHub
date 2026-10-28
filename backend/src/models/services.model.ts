// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  starting_price: number | null;
  estimated_days: number | null;
  thumbnail_url: string | null;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};
export type ServiceInsert = {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  starting_price?: number | null;
  estimated_days?: number | null;
  thumbnail_url?: string | null;
  active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};
export type ServiceUpdate = Partial<ServiceInsert>;
