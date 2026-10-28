// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type QuotationItem = {
  id: string;
  quotation_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};
export type QuotationItemInsert = {
  id?: string;
  quotation_id: string;
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};
export type QuotationItemUpdate = Partial<QuotationItemInsert>;
