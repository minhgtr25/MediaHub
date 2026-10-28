// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type ProjectFile = {
  id: string;
  project_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string | null;
};
export type ProjectFileInsert = {
  id?: string;
  project_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at?: string | null;
};
export type ProjectFileUpdate = Partial<ProjectFileInsert>;
