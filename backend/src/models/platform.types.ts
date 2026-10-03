import type { Database } from "./database.types.js";
import type { Role } from "../domain.js";
import type { CreatorSelection, CreatorAssignment, CreatorProgressUpdate } from "./commerce.model.js";
import type { ServicePackage, ServiceRequest, RequestAssignment, RequestNote, RequestAttachment, ConversationMessage, Conversation, ConversationMember, ManagedCreator, CreatorProposal, ServiceOrder, OrderItem, CommercialQuoteFields, OrderContract, ContractAcknowledgment, OrderPaymentRequest, OrderPaymentReceipt } from "./commerce.model.js";
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
  source: "CONTACT" | "PROJECT_REQUEST" | "BUSINESS_CONTACT" | "CREATOR_APPLICATION";
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
type LeadInsert = Pick<Lead, "full_name" | "email" | "message" | "source"> &
  Partial<Omit<Lead, "full_name" | "email" | "message" | "source">>;
type Stamped = { id: string; created_at: string; updated_at: string };
type Partner = Stamped & {
  name: string;
  logo: string;
  website: string;
  description: string;
  industry: string;
  display_order: number;
  active: boolean;
};
type Process = Stamped & {
  title: string;
  description: string;
  step: number;
  icon: string;
  image: string;
  active: boolean;
  display_order: number;
};
type Setting = Stamped & {
  key: string;
  title: string;
  content: string;
  image: string;
  published: boolean;
};
type Message = {
  id: string;
  project_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};
type Milestone = Stamped & {
  project_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  display_order: number;
};
type Audit = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
};
export type SupportTicket = {id:string;customer_id:string;subject:string;category:string;status:string;assigned_to:string|null;created_at:string;updated_at:string};
export type SupportMessage = {id:string;ticket_id:string;sender_id:string;message:string;created_at:string};
export type PaymentSettings = {id:string;bank_name:string;account_number:string;account_name:string;qr_image:string;deposit_percent:number;enabled:boolean;instructions:string;updated_at:string};
export type PaymentPlan = {id:string;project_id:string;quotation_id:string;total:number;deposit_percent:number;created_at:string};
export type PaymentInstallment = {id:string;plan_id:string;stage:string;amount:number;status:string;reference:string;transfer_note:string;reported_at:string|null;paid_at:string|null;confirmed_by:string|null};
type Table<T, Required extends keyof T> = {
  Row: T;
  Insert: Pick<T, Required> & Partial<Omit<T, Required>>;
  Update: Partial<T>;
  Relationships: [];
};
type ServiceExtra = {
  featured: boolean;
  display_order: number;
  features: string[];
  deliverables: string[];
  price_max: number | null;
  seo_title: string;
  seo_description: string;
};
type PortfolioExtra = {
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
};
type Extended<
  T extends { Row: object; Insert: object; Update: object },
  Extra extends object,
> = Omit<T, "Row" | "Insert" | "Update"> & {
  Row: T["Row"] & Extra;
  Insert: T["Insert"] & Partial<Extra>;
  Update: T["Update"] & Partial<Extra>;
};
// Additive migrations extend the generated baseline without overwriting it.
export type PlatformDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      creator_request_candidates: {Args:{actor_id:string;rid:string;search_text:string};Returns:import('./database.types.js').Json};
      public_creator_search: {Args:{filters:import('./database.types.js').Json};Returns:import('./database.types.js').Json};
      public_creator_detail: {Args:{creator_slug:string};Returns:import('./database.types.js').Json};
      creator_profile_state: {Args:{actor_id:string};Returns:import('./database.types.js').Json};
      creator_profile_action: {Args:{actor_id:string;operation:string;payload:import('./database.types.js').Json};Returns:import('./database.types.js').Json};
      execution_state: {Args:{actor_id:string;oid:string;report_page:number};Returns:import('./database.types.js').Json};
      execution_candidates: {Args:{actor_id:string;oid:string;search_text:string};Returns:import('./database.types.js').Json};
      execution_action: {Args:{actor_id:string;oid:string;operation:string;payload:import('./database.types.js').Json};Returns:import('./database.types.js').Json};
      execution_invitations: {Args:{actor_id:string;report_page:number};Returns:import('./database.types.js').Json};
      execution_invite_scope: {Args:{actor_id:string;iid:string};Returns:boolean};
      execution_invite_response: {Args:{actor_id:string;iid:string;operation:string;reason:string};Returns:import('./database.types.js').Json};
      replacement_reserved_creators: {Args:{actor_id:string;creator_ids:string[]};Returns:import('./database.types.js').Json};
      order_variation_action: {Args:{actor_id:string;oid:string;operation:string;payload:import('./database.types.js').Json};Returns:import('./database.types.js').Json};
      order_variation_list: {Args:{actor_id:string;oid:string;report_page:number;focus_id?:string};Returns:import('./database.types.js').Json};
      order_variation_scopes: {Args:{actor_id:string;oid:string;report_page:number};Returns:import('./database.types.js').Json};
      order_delivery_action: { Args: { actor_id: string; oid: string; operation: string; payload: import('./database.types.js').Json }; Returns: { order_id: string; submission_id?: string; round_id?: string; reused?: boolean } };
      commerce_finance_report: { Args: { actor_id: string; report_year: number; report_month: number; staff_filter: string | null; report_page: number }; Returns: import('./database.types.js').Json };
      confirm_order_final_funds: { Args: { actor_id: string; oid: string; payload: import('./database.types.js').Json }; Returns: { order_id: string; reused?: boolean } };
      creator_team_action: { Args: { actor_id: string; rid: string; operation: string; payload: import('./database.types.js').Json }; Returns: { id: string; request_id: string; reused?: boolean } };
      onboard_creator: { Args: { actor_id: string; cid: string; target_profile_id: string; payload: import('./database.types.js').Json }; Returns: { creator_id: string; profile_id: string } };
      save_profile_avatar: { Args: { actor_id: string; image_url: string }; Returns: { avatar_url: string } };
      order_action: { Args: { actor_id: string; oid: string; operation: string; payload: import('./database.types.js').Json }; Returns: { id: string; order_id: string; version?: number; reused?: boolean } };
      order_payment_action: { Args: { actor_id: string; oid: string; operation: string; payload: import('./database.types.js').Json }; Returns: { id: string; order_id: string; reused?: boolean } };
      order_production_action: { Args: { actor_id: string; oid: string; operation: string; payload: import('./database.types.js').Json }; Returns: { id: string; order_id: string; milestone_id?: string; reused?: boolean } };
      request_commerce_action: { Args: { actor_id: string; rid: string; operation: string; payload: import('./database.types.js').Json }; Returns: { id: string; request_id: string; order_id?: string | null; version?: number } };
      request_action: { Args: { actor_id: string; rid: string | null; operation: string; payload: import('./database.types.js').Json }; Returns: { id: string; conversation_id?: string; reused?: boolean } };
      save_service_package: { Args: { actor_id: string; package_id: string | null; payload: import('./database.types.js').Json }; Returns: { id: string } };
      support_action: {Args:{actor_id:string;operation:string;target_id:string|null;payload:import('./database.types.js').Json};Returns:{id:string}};
      payment_action: {Args:{actor_id:string;operation:string;target_id:string;payload:import('./database.types.js').Json};Returns:{id:string}};
      save_quotation: {
        Args: {
          actor_id: string;
          pid: string;
          payload: import("./database.types.js").Json;
          send_now: boolean;
        };
        Returns: { id: string; project_id: string };
      };
      manage_quotation: {
        Args: { actor_id: string; qid: string; operation: string };
        Returns: { id: string; project_id: string };
      };
      edit_project: {
        Args: {
          actor_id: string;
          pid: string;
          payload: import("./database.types.js").Json;
        };
        Returns: { id: string };
      };
      convert_lead: {
        Args: { actor_id: string; lid: string; cid: string };
        Returns: { customer_id: string };
      };
      manage_user: {
        Args: {
          actor_id: string;
          target_id: string;
          new_role: string;
          new_active: boolean;
        };
        Returns: { id: string };
      };
      update_profile: {
        Args: { actor_id: string; payload: import("./database.types.js").Json };
        Returns: { id: string };
      };
    };
    Tables: Omit<
      Database["public"]["Tables"],
      | "profiles"
      | "invoices"
      | "revision_requests"
      | "services"
      | "portfolio"
      | "projects"
      | "quotations"
    > & {
      production_submissions: Table<{id:string;order_id:string;assignment_id:string;author_id:string;kind:'REVIEW'|'FINAL';title:string;note:string;file_name:string;storage_path:string;file_type:string;file_size:number;final_of:string|null;created_at:string},'order_id'|'assignment_id'|'author_id'|'kind'|'title'|'file_name'|'storage_path'|'file_type'|'file_size'>;
      order_review_rounds: Table<{id:string;order_id:string;version:number;submitted_by:string;submission_ids:string[];note:string;status:'PENDING'|'ACCEPTED'|'REVISION_REQUESTED';submitted_at:string;responded_by:string|null;responded_at:string|null;response_note:string|null},'order_id'|'version'|'submitted_by'|'submission_ids'|'note'>;
      order_contracts: Table<OrderContract, "order_id" | "request_id" | "quotation_id" | "version" | "title" | "content" | "valid_until" | "created_by">;
      order_final_funds_confirmations: Table<{order_id:string;confirmed_by:string;amount:number;receipt_snapshot:import('./database.types.js').Json;note:string;confirmed_at:string},'order_id'|'confirmed_by'|'amount'|'receipt_snapshot'|'note'>;
      request_creator_selections: Table<CreatorSelection, "request_id" | "creator_id" | "proposal_id" | "selected_by">;
      creator_assignments: Table<CreatorAssignment, "request_id" | "creator_id" | "proposal_id" | "work_scope" | "invited_by" | "expires_at">;
      creator_progress_updates: Table<CreatorProgressUpdate, "assignment_id" | "author_id" | "progress" | "content">;
      creator_company_agreements: Table<{ creator_id: string; agreement_reference: string; signed_at: string; verified_by: string; created_at: string }, "creator_id" | "agreement_reference" | "signed_at" | "verified_by">;
      contract_acknowledgments: Table<ContractAcknowledgment, "contract_id" | "order_id" | "profile_id" | "content_hash" | "contract_snapshot">;
      order_payment_requests: Table<OrderPaymentRequest, "order_id" | "kind" | "amount" | "due_date" | "bank_snapshot" | "created_by" | "idempotency_key" | "request_input">;
      order_payment_receipts: Table<OrderPaymentReceipt, "order_id" | "payment_request_id" | "amount" | "receiving_account_key" | "bank_transaction_reference" | "received_at" | "verified_by" | "payment_snapshot">;
      quotations: Omit<Database["public"]["Tables"]["quotations"], "Row"> & {
        Row: Omit<
          Database["public"]["Tables"]["quotations"]["Row"],
          "status" | "project_id"
        > & CommercialQuoteFields & {
          project_id: string | null;
          status:
            | "DRAFT"
            | "SENT"
            | "VIEWED"
            | "REVISION_REQUESTED"
            | "ACCEPTED"
            | "REJECTED"
            | "EXPIRED"
            | "CANCELLED";
          quotation_number: string;
          tax_rate: number;
          tax: number;
        };
      };
      projects: Extended<
        Database["public"]["Tables"]["projects"],
        { progress: number; scope: string; order_id: string | null; production_status: string | null }
      >;
      services: Extended<
        Database["public"]["Tables"]["services"],
        ServiceExtra
      >;
      portfolio: Extended<
        Database["public"]["Tables"]["portfolio"],
        PortfolioExtra
      >;
      profiles: Omit<
        Database["public"]["Tables"]["profiles"],
        "Row" | "Update" | "Insert"
      > & {
        Row: Omit<Database["public"]["Tables"]["profiles"]["Row"], "role"> & {
          role: Role;
          active: boolean;
          notification_preferences: { email: boolean; in_app: boolean };
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Insert"], "role"> & { role?: Role };
        Update: Omit<Database["public"]["Tables"]["profiles"]["Update"], "role"> & {
          role?: Role;
          active?: boolean;
          notification_preferences?: { email: boolean; in_app: boolean };
        };
      };
      invoices: Omit<Database["public"]["Tables"]["invoices"], "Row"> & {
        Row: Omit<Database["public"]["Tables"]["invoices"]["Row"], "status"> & {
          status:
            "DRAFT" | "ISSUED" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
          due_date: string | null;
          quotation_id: string | null;
        };
      };
      revision_requests: Omit<
        Database["public"]["Tables"]["revision_requests"],
        "Row"
      > & {
        Row: Omit<
          Database["public"]["Tables"]["revision_requests"]["Row"],
          "status"
        > & {
          status:
            | "PENDING"
            | "REQUESTED"
            | "IN_PROGRESS"
            | "RESOLVED"
            | "REJECTED"
            | "CANCELLED";
          deliverable_id: string | null;
        };
      };
      leads: {
        Row: Lead;
        Insert: LeadInsert;
        Update: Partial<LeadInsert>;
        Relationships: [];
      };
      requests: Table<ServiceRequest, 'customer_id' | 'service_id' | 'title' | 'brief' | 'idempotency_key'>;
      creator_proposals: Table<CreatorProposal, 'request_id' | 'creator_id' | 'creator_snapshot' | 'proposed_by' | 'reason'>;
      orders: Table<ServiceOrder, 'request_id' | 'customer_id' | 'assigned_to' | 'creator_id' | 'accepted_quotation_id' | 'quote_snapshot' | 'creator_snapshot' | 'total' | 'deposit_amount' | 'remaining_amount'>;
      order_items: Table<OrderItem, 'order_id' | 'description' | 'quantity' | 'unit_price' | 'total'>;
      service_packages: Table<ServicePackage, 'service_id' | 'name'>;
      request_assignments: Table<RequestAssignment, 'request_id' | 'staff_id' | 'assigned_by'>;
      request_notes: Table<RequestNote, 'request_id' | 'author_id' | 'content'>;
      request_attachments: Table<RequestAttachment, 'request_id' | 'uploaded_by' | 'file_name' | 'storage_path' | 'file_type' | 'file_size'>;
      conversations: Table<Conversation, 'subject'>;
      conversation_members: Table<ConversationMember, 'conversation_id' | 'profile_id'>;
      conversation_messages: Table<ConversationMessage, 'conversation_id' | 'sender_id' | 'content'>;
      creator_profiles: Table<ManagedCreator & { profile_id: string | null }, 'display_name' | 'slug' | 'title'>;
      support_tickets: Table<SupportTicket, 'customer_id'|'subject'>;
      support_messages: Table<SupportMessage,'ticket_id'|'sender_id'|'message'>;
      payment_settings: Table<PaymentSettings,'id'>;
      payment_plans: Table<PaymentPlan,'project_id'|'quotation_id'|'total'|'deposit_percent'>;
      payment_installments: Table<PaymentInstallment,'plan_id'|'stage'|'amount'>;
      partners: Table<Partner, "name">;
      work_processes: Table<Process, "title" | "description" | "step">;
      website_settings: Table<Setting, "key" | "title">;
      project_messages: Table<Message, "project_id" | "sender_id" | "message">;
      project_milestones: Table<Milestone, "project_id" | "title">;
      audit_logs: Table<Audit, "action" | "entity" | "entity_id">;
    };
  };
};
