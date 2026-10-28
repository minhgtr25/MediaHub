// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type ProjectStatusHistory = {
  id: string;
  project_id: string;
  status: string;
  note: string | null;
  created_by: string | null;
  created_at: string | null;
};
export type ProjectStatusHistoryInsert = {
  id?: string;
  project_id: string;
  status: string;
  note?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};
export type ProjectStatusHistoryUpdate = Partial<ProjectStatusHistoryInsert>;
