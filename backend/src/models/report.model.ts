import type { Project } from "./projects.model.js";
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export type DashboardReport = {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  pending_quotations: number;
  total_customers: number;
  total_revenue: number;
  monthly_revenue: number;
  yearly_revenue: number;
  average_project_value: number;
  pending_payment: number;
  paid_invoices: number;
  by_status: { status: Project["status"]; count: number }[];
  by_month: { label: string; value: number }[];
  by_service: { label: string; value: number }[];
};
