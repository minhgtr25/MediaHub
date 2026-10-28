export type Lead = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  service_id: string | null;
  project_type: string;
  message: string;
  budget_range: string;
  deadline: string | null;
  source:
    "CONTACT" | "PROJECT_REQUEST" | "BUSINESS_CONTACT" | "CREATOR_APPLICATION";
  applicant_type: "CREATOR" | "STUDENT" | null;
  specialty: string;
  portfolio_urls: string[];
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  notes: string;
  customer_id: string | null;
  assigned_to: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
};
export type LeadInsert = Pick<
  Lead,
  "full_name" | "email" | "message" | "source"
> &
  Partial<Omit<Lead, "full_name" | "email" | "message" | "source">>;
export type Stamped = { id: string; created_at: string; updated_at: string };
export type Partner = Stamped & {
  name: string;
  logo: string;
  website: string;
  description: string;
  industry: string;
  display_order: number;
  active: boolean;
};
export type Process = Stamped & {
  title: string;
  description: string;
  step: number;
  icon: string;
  image: string;
  active: boolean;
  display_order: number;
};
export type Setting = Stamped & {
  key: string;
  title: string;
  content: string;
  image: string;
  published: boolean;
};
export type Message = {
  id: string;
  project_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};
export type Milestone = Stamped & {
  project_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  display_order: number;
};
export type Audit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
};
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  display_order: number;
  active: boolean;
  created_at: string;
};
export type Skill = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  active: boolean;
  created_at: string;
};
export type SupportTicket = {
  id: string;
  customer_id: string;
  subject: string;
  category: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};
export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};
export type PaymentSettings = {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  qr_image: string;
  deposit_percent: number;
  enabled: boolean;
  instructions: string;
  updated_at: string;
};
export type PaymentPlan = {
  id: string;
  project_id: string;
  quotation_id: string;
  total: number;
  deposit_percent: number;
  created_at: string;
};
export type PaymentInstallment = {
  id: string;
  plan_id: string;
  stage: string;
  amount: number;
  status: string;
  reference: string;
  transfer_note: string;
  reported_at: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
};
export type Table<T, Required extends keyof T> = {
  Row: T;
  Insert: Pick<T, Required> & Partial<Omit<T, Required>>;
  Update: Partial<T>;
  Relationships: [];
};
export type ServiceExtra = {
  featured: boolean;
  display_order: number;
  features: string[];
  deliverables: string[];
  price_max: number | null;
  seo_title: string;
  seo_description: string;
};
export type PortfolioExtra = {
  slug: string;
  industry: string;
  year: number | null;
  duration: string;
  challenge: string;
  solution: string;
  result: string;
  gallery: string[];
  deliverables: string[];
  seo_title: string;
  seo_description: string;
  video_url: string;
};
export type Extended<
  T extends { Row: object; Insert: object; Update: object },
  Extra extends object,
> = Omit<T, "Row" | "Insert" | "Update"> & {
  Row: T["Row"] & Extra;
  Insert: T["Insert"] & Partial<Extra>;
  Update: T["Update"] & Partial<Extra>;
};
// Additive migrations extend the generated baseline without overwriting it.
