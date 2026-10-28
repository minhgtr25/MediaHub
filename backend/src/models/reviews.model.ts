// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Review = {
  id: string;
  project_id: string;
  customer_id: string;
  rating: number;
  quality_rating: number;
  communication_rating: number;
  value_rating: number;
  comment: string;
  created_at: string | null;
};
export type ReviewInsert = {
  id?: string;
  project_id: string;
  customer_id: string;
  rating: number;
  quality_rating: number;
  communication_rating: number;
  value_rating: number;
  comment: string;
  created_at?: string | null;
};
export type ReviewUpdate = Partial<ReviewInsert>;
