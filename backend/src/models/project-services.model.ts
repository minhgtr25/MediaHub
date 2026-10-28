// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type ProjectService = {
  id: string;
  project_id: string;
  service_id: string;
  quantity: number;
  notes: string | null;
  created_at: string | null;
};
export type ProjectServiceInsert = {
  id?: string;
  project_id: string;
  service_id: string;
  quantity?: number;
  notes?: string | null;
  created_at?: string | null;
};
export type ProjectServiceUpdate = Partial<ProjectServiceInsert>;
