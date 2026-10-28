import type { Database } from "./database.types.js";
import type { Role } from "../domain.js";
import type {
  CreatorSelection,
  CreatorAssignment,
  CreatorProgressUpdate,
} from "./commerce.model.js";
import type {
  ServicePackage,
  ServiceRequest,
  RequestAssignment,
  RequestNote,
  RequestAttachment,
  ConversationMessage,
  Conversation,
  ConversationMember,
  ManagedCreator,
  CreatorProposal,
  ServiceOrder,
  OrderItem,
  CommercialQuoteFields,
  OrderContract,
  ContractAcknowledgment,
  OrderPaymentRequest,
  OrderPaymentReceipt,
  OrderPublicationPreference,
  OrderResultReview,
  OrderCreatorReview,
  OrderCaseStudy,
  ServiceChatFile,
} from "./commerce.model.js";
import type {
  Audit,
  Category,
  Extended,
  Lead,
  LeadInsert,
  Message,
  Milestone,
  Partner,
  PaymentInstallment,
  PaymentPlan,
  PaymentSettings,
  PortfolioExtra,
  Process,
  ServiceExtra,
  Setting,
  Skill,
  SupportMessage,
  SupportTicket,
  Table,
} from "./platform-shared.types.js";

export type PlatformTables = Omit<
  Database["public"]["Tables"],
  | "profiles"
  | "invoices"
  | "revision_requests"
  | "services"
  | "portfolio"
  | "projects"
  | "quotations"
> & {
  categories: Table<Category, "name" | "slug">;
  skills: Table<Skill, "name" | "slug">;
  production_submissions: Table<
    {
      id: string;
      order_id: string;
      assignment_id: string;
      author_id: string;
      kind: "REVIEW" | "FINAL";
      title: string;
      note: string;
      file_name: string;
      storage_path: string;
      file_type: string;
      file_size: number;
      final_of: string | null;
      created_at: string;
    },
    | "order_id"
    | "assignment_id"
    | "author_id"
    | "kind"
    | "title"
    | "file_name"
    | "storage_path"
    | "file_type"
    | "file_size"
  >;
  order_review_rounds: Table<
    {
      id: string;
      order_id: string;
      version: number;
      submitted_by: string;
      submission_ids: string[];
      note: string;
      status: "PENDING" | "ACCEPTED" | "REVISION_REQUESTED";
      submitted_at: string;
      responded_by: string | null;
      responded_at: string | null;
      response_note: string | null;
    },
    "order_id" | "version" | "submitted_by" | "submission_ids" | "note"
  >;
  order_contracts: Table<
    OrderContract,
    | "order_id"
    | "request_id"
    | "quotation_id"
    | "version"
    | "title"
    | "content"
    | "valid_until"
    | "created_by"
  >;
  order_publication_preferences: Table<
    OrderPublicationPreference,
    "order_id" | "customer_profile_id"
  >;
  order_result_reviews: Table<
    OrderResultReview,
    "order_id" | "customer_profile_id" | "rating" | "content"
  >;
  order_creator_reviews: Table<
    OrderCreatorReview,
    "order_id" | "creator_id" | "rating" | "content"
  >;
  order_case_studies: Table<
    OrderCaseStudy,
    "order_id" | "title" | "excerpt" | "image_path" | "approved_by"
  >;
  service_chat_files: Table<
    ServiceChatFile,
    | "message_id"
    | "request_id"
    | "uploaded_by"
    | "file_name"
    | "file_type"
    | "file_size"
    | "storage_path"
    | "sha256"
  >;
  order_final_funds_confirmations: Table<
    {
      order_id: string;
      confirmed_by: string;
      amount: number;
      receipt_snapshot: import("./database.types.js").Json;
      note: string;
      confirmed_at: string;
    },
    "order_id" | "confirmed_by" | "amount" | "receipt_snapshot" | "note"
  >;
  request_creator_selections: Table<
    CreatorSelection,
    "request_id" | "creator_id" | "proposal_id" | "selected_by"
  >;
  creator_assignments: Table<
    CreatorAssignment,
    | "request_id"
    | "creator_id"
    | "proposal_id"
    | "work_scope"
    | "invited_by"
    | "expires_at"
  >;
  creator_progress_updates: Table<
    CreatorProgressUpdate,
    "assignment_id" | "author_id" | "progress" | "content"
  >;
  creator_company_agreements: Table<
    {
      creator_id: string;
      agreement_reference: string;
      signed_at: string;
      verified_by: string;
      created_at: string;
    },
    "creator_id" | "agreement_reference" | "signed_at" | "verified_by"
  >;
  contract_acknowledgments: Table<
    ContractAcknowledgment,
    | "contract_id"
    | "order_id"
    | "profile_id"
    | "content_hash"
    | "contract_snapshot"
  >;
  order_payment_requests: Table<
    OrderPaymentRequest,
    | "order_id"
    | "kind"
    | "amount"
    | "due_date"
    | "bank_snapshot"
    | "created_by"
    | "idempotency_key"
    | "request_input"
  >;
  order_payment_receipts: Table<
    OrderPaymentReceipt,
    | "order_id"
    | "payment_request_id"
    | "amount"
    | "receiving_account_key"
    | "bank_transaction_reference"
    | "received_at"
    | "verified_by"
    | "payment_snapshot"
  >;
  quotations: Omit<Database["public"]["Tables"]["quotations"], "Row"> & {
    Row: Omit<
      Database["public"]["Tables"]["quotations"]["Row"],
      "status" | "project_id"
    > &
      CommercialQuoteFields & {
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
    {
      progress: number;
      scope: string;
      order_id: string | null;
      production_status: string | null;
    }
  >;
  services: Extended<Database["public"]["Tables"]["services"], ServiceExtra>;
  portfolio: Extended<
    Database["public"]["Tables"]["portfolio"],
    PortfolioExtra & { is_demo: boolean }
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
    Insert: Omit<Database["public"]["Tables"]["profiles"]["Insert"], "role"> & {
      role?: Role;
    };
    Update: Omit<Database["public"]["Tables"]["profiles"]["Update"], "role"> & {
      role?: Role;
      active?: boolean;
      notification_preferences?: { email: boolean; in_app: boolean };
    };
  };
  invoices: Omit<Database["public"]["Tables"]["invoices"], "Row"> & {
    Row: Omit<Database["public"]["Tables"]["invoices"]["Row"], "status"> & {
      status: "DRAFT" | "ISSUED" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
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
  requests: Table<
    ServiceRequest,
    "customer_id" | "service_id" | "title" | "brief" | "idempotency_key"
  >;
  creator_proposals: Table<
    CreatorProposal,
    "request_id" | "creator_id" | "creator_snapshot" | "proposed_by" | "reason"
  >;
  orders: Table<
    ServiceOrder,
    | "request_id"
    | "customer_id"
    | "assigned_to"
    | "creator_id"
    | "accepted_quotation_id"
    | "quote_snapshot"
    | "creator_snapshot"
    | "total"
    | "deposit_amount"
    | "remaining_amount"
  >;
  order_items: Table<
    OrderItem,
    "order_id" | "description" | "quantity" | "unit_price" | "total"
  >;
  service_packages: Table<ServicePackage, "service_id" | "name">;
  request_assignments: Table<
    RequestAssignment,
    "request_id" | "staff_id" | "assigned_by"
  >;
  request_notes: Table<RequestNote, "request_id" | "author_id" | "content">;
  request_attachments: Table<
    RequestAttachment,
    | "request_id"
    | "uploaded_by"
    | "file_name"
    | "storage_path"
    | "file_type"
    | "file_size"
  >;
  conversations: Table<Conversation, "subject">;
  conversation_members: Table<
    ConversationMember,
    "conversation_id" | "profile_id"
  >;
  conversation_messages: Table<
    ConversationMessage,
    "conversation_id" | "sender_id" | "content"
  >;
  creator_profiles: Table<
    ManagedCreator & { profile_id: string | null; is_demo: boolean },
    "display_name" | "slug" | "title"
  >;
  support_tickets: Table<SupportTicket, "customer_id" | "subject">;
  support_messages: Table<
    SupportMessage,
    "ticket_id" | "sender_id" | "message"
  >;
  payment_settings: Table<PaymentSettings, "id">;
  payment_plans: Table<
    PaymentPlan,
    "project_id" | "quotation_id" | "total" | "deposit_percent"
  >;
  payment_installments: Table<
    PaymentInstallment,
    "plan_id" | "stage" | "amount"
  >;
  partners: Table<Partner, "name">;
  work_processes: Table<Process, "title" | "description" | "step">;
  website_settings: Table<Setting, "key" | "title">;
  project_messages: Table<Message, "project_id" | "sender_id" | "message">;
  project_milestones: Table<Milestone, "project_id" | "title">;
  audit_logs: Table<Audit, "action" | "entity" | "entity_id">;
};
