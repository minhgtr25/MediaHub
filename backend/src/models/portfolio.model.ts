// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Portfolio = {
  id: string;
  title: string;
  client: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  published: boolean;
  featured: boolean;
  created_at: string | null;
  updated_at: string | null;
};
export type PortfolioInsert = {
  id?: string;
  title: string;
  client: string;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  published?: boolean;
  featured?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};
export type PortfolioUpdate = Partial<PortfolioInsert>;
