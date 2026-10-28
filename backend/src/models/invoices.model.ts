// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Invoice = {
  id: string;
  project_id: string;
  customer_id: string;
  invoice_number: string;
  amount: number;
  status: "PENDING" | "PAID" | "CANCELLED";
  issued_at: string | null;
  paid_at: string | null;
};
export type InvoiceInsert = {
  id?: string;
  project_id: string;
  customer_id: string;
  invoice_number: string;
  amount: number;
  status?: "PENDING" | "PAID" | "CANCELLED";
  issued_at?: string | null;
  paid_at?: string | null;
};
export type InvoiceUpdate = Partial<InvoiceInsert>;
