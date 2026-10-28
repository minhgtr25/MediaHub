// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Quotation = {
  id: string;
  project_id: string;
  subtotal: number;
  discount: number;
  total: number;
  valid_until: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export type QuotationInsert = {
  id?: string;
  project_id: string;
  subtotal: number;
  discount?: number;
  total: number;
  valid_until: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type QuotationUpdate = Partial<QuotationInsert>;
