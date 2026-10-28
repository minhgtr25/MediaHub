// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Project = {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  category: string | null;
  budget: number | null;
  deadline: string | null;
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "REVIEWING"
    | "QUOTATION_SENT"
    | "QUOTATION_ACCEPTED"
    | "IN_PROGRESS"
    | "WAITING_REVIEW"
    | "REVISION"
    | "COMPLETED"
    | "CANCELLED";
  created_at: string | null;
  updated_at: string | null;
};
export type ProjectInsert = {
  id?: string;
  customer_id: string;
  title: string;
  description: string;
  category?: string | null;
  budget?: number | null;
  deadline?: string | null;
  status?:
    | "DRAFT"
    | "SUBMITTED"
    | "REVIEWING"
    | "QUOTATION_SENT"
    | "QUOTATION_ACCEPTED"
    | "IN_PROGRESS"
    | "WAITING_REVIEW"
    | "REVISION"
    | "COMPLETED"
    | "CANCELLED";
  created_at?: string | null;
  updated_at?: string | null;
};
export type ProjectUpdate = Partial<ProjectInsert>;
