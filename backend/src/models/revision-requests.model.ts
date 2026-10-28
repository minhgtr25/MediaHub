// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type RevisionRequest = {
  id: string;
  project_id: string;
  customer_id: string;
  description: string;
  attachment_url: string | null;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  created_at: string | null;
  updated_at: string | null;
};
export type RevisionRequestInsert = {
  id?: string;
  project_id: string;
  customer_id: string;
  description: string;
  attachment_url?: string | null;
  status?: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  created_at?: string | null;
  updated_at?: string | null;
};
export type RevisionRequestUpdate = Partial<RevisionRequestInsert>;
