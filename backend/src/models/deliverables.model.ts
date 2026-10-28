// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Deliverable = {
  id: string;
  project_id: string;
  name: string;
  file_url: string;
  version: number;
  status: "UPLOADED" | "PENDING_APPROVAL" | "APPROVED" | "REVISION_REQUIRED";
  created_at: string | null;
  updated_at: string | null;
};
export type DeliverableInsert = {
  id?: string;
  project_id: string;
  name: string;
  file_url: string;
  version?: number;
  status?: "UPLOADED" | "PENDING_APPROVAL" | "APPROVED" | "REVISION_REQUIRED";
  created_at?: string | null;
  updated_at?: string | null;
};
export type DeliverableUpdate = Partial<DeliverableInsert>;
