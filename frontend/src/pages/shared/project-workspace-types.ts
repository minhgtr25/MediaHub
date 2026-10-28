export type ProjectFileRow = {
  id: string;
  file_name?: string;
  name?: string;
  version?: number;
  created_at?: string;
  status?: string;
};
export type DeliverableRow = ProjectFileRow & { name: string; status: string };
export type ProjectServiceRow = { service_id: string; name?: string };
export type ProjectQuotation = {
  id: string;
  total: number;
  status: string;
  valid_until: string;
  discount: number;
  subtotal: number;
  tax_rate: number;
  tax: number;
  notes: string | null;
  quotation_items: {
    id: string;
    service_id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
};
export type ProjectWorkspaceData = {
  id: string;
  title: string;
  category: string;
  status: string;
  description: string;
  scope: string;
  progress: number;
  budget: number;
  deadline: string | null;
  created_at: string;
  quotations?: ProjectQuotation[];
  deliverables?: DeliverableRow[];
  project_files?: ProjectFileRow[];
  project_services?: ProjectServiceRow[];
  project_status_history?: {
    id: string;
    status: string;
    note?: string | null;
    created_at: string;
  }[];
  invoices?: {
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
  }[];
  revision_requests?: { id: string; status: string; description: string }[];
  reviews?: { id: string }[];
};
