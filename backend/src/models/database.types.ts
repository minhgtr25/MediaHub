// Base database types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
import type {
  Profile,
  ProfileInsert,
  ProfileUpdate,
} from "./profiles.model.js";
import type {
  Customer,
  CustomerInsert,
  CustomerUpdate,
} from "./customers.model.js";
import type {
  Employee,
  EmployeeInsert,
  EmployeeUpdate,
} from "./employees.model.js";
import type {
  Service,
  ServiceInsert,
  ServiceUpdate,
} from "./services.model.js";
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
} from "./projects.model.js";
import type {
  ProjectService,
  ProjectServiceInsert,
  ProjectServiceUpdate,
} from "./project-services.model.js";
import type {
  Quotation,
  QuotationInsert,
  QuotationUpdate,
} from "./quotations.model.js";
import type {
  QuotationItem,
  QuotationItemInsert,
  QuotationItemUpdate,
} from "./quotation-items.model.js";
import type {
  ProjectFile,
  ProjectFileInsert,
  ProjectFileUpdate,
} from "./project-files.model.js";
import type {
  ProjectStatusHistory,
  ProjectStatusHistoryInsert,
  ProjectStatusHistoryUpdate,
} from "./project-status-history.model.js";
import type {
  Deliverable,
  DeliverableInsert,
  DeliverableUpdate,
} from "./deliverables.model.js";
import type {
  RevisionRequest,
  RevisionRequestInsert,
  RevisionRequestUpdate,
} from "./revision-requests.model.js";
import type { Review, ReviewInsert, ReviewUpdate } from "./reviews.model.js";
import type {
  Testimonial,
  TestimonialInsert,
  TestimonialUpdate,
} from "./testimonials.model.js";
import type {
  Invoice,
  InvoiceInsert,
  InvoiceUpdate,
} from "./invoices.model.js";
import type {
  Notification,
  NotificationInsert,
  NotificationUpdate,
} from "./notifications.model.js";
import type {
  Portfolio,
  PortfolioInsert,
  PortfolioUpdate,
} from "./portfolio.model.js";
import type { DashboardReport } from "./report.model.js";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: CustomerInsert;
        Update: CustomerUpdate;
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: Employee;
        Insert: EmployeeInsert;
        Update: EmployeeUpdate;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: ServiceInsert;
        Update: ServiceUpdate;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      project_services: {
        Row: ProjectService;
        Insert: ProjectServiceInsert;
        Update: ProjectServiceUpdate;
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      quotations: {
        Row: Quotation;
        Insert: QuotationInsert;
        Update: QuotationUpdate;
        Relationships: [
          {
            foreignKeyName: "quotations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      quotation_items: {
        Row: QuotationItem;
        Insert: QuotationItemInsert;
        Update: QuotationItemUpdate;
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotation_items_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      project_files: {
        Row: ProjectFile;
        Insert: ProjectFileInsert;
        Update: ProjectFileUpdate;
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      project_status_history: {
        Row: ProjectStatusHistory;
        Insert: ProjectStatusHistoryInsert;
        Update: ProjectStatusHistoryUpdate;
        Relationships: [
          {
            foreignKeyName: "project_status_history_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_status_history_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deliverables: {
        Row: Deliverable;
        Insert: DeliverableInsert;
        Update: DeliverableUpdate;
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      revision_requests: {
        Row: RevisionRequest;
        Insert: RevisionRequestInsert;
        Update: RevisionRequestUpdate;
        Relationships: [
          {
            foreignKeyName: "revision_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revision_requests_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: Review;
        Insert: ReviewInsert;
        Update: ReviewUpdate;
        Relationships: [
          {
            foreignKeyName: "reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      testimonials: {
        Row: Testimonial;
        Insert: TestimonialInsert;
        Update: TestimonialUpdate;
        Relationships: [
          {
            foreignKeyName: "testimonials_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: true;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: Invoice;
        Insert: InvoiceInsert;
        Update: InvoiceUpdate;
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolio: {
        Row: Portfolio;
        Insert: PortfolioInsert;
        Update: PortfolioUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      project_action: {
        Args: {
          actor_id: string;
          pid: string | null;
          action: string;
          payload?: Json;
        };
        Returns: { id: string };
      };
      dashboard_report: {
        Args: { actor_id: string };
        Returns: DashboardReport;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      owns_project: { Args: { pid: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> =
  Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> =
  Database["public"]["Tables"][T]["Update"];
