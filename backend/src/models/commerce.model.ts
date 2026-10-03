export const requestStatuses = ["UNASSIGNED", "ASSIGNED", "CONSULTING", "WAITING_CUSTOMER", "CREATOR_SELECTION", "QUOTE_PREPARING", "QUOTE_SENT", "QUOTE_REVISION", "READY_TO_ORDER", "CONVERTED", "CANCELLED"] as const;
export type RequestStatus = (typeof requestStatuses)[number];
export type ServicePackage = {
  id: string; service_id: string; name: string; description: string;
  starting_price: number | null; estimated_days: number | null; deliverables: string[];
  active: boolean; display_order: number; created_at: string; updated_at: string;
};
export type ServiceRequest = {
  team_confirmation_required?: boolean;
  id: string; request_number: string; customer_id: string; service_id: string;
  package_id: string | null; package_snapshot: Pick<ServicePackage, "name" | "description" | "starting_price" | "estimated_days" | "deliverables"> | null;
  title: string; brief: string; budget_min: number | null; budget_max: number | null;
  deadline: string | null; reference_urls: string[]; creator_preference: "ADVICE" | "PREFERRED";
  preferred_creator_id: string | null; assigned_to: string | null; status: RequestStatus;
  cancellation_reason: string | null; selected_proposal_id: string | null; idempotency_key: string; created_at: string; updated_at: string;
};
export type RequestAssignment = { id: string; request_id: string; staff_id: string; assigned_by: string; reason: string; assigned_at: string; ended_at: string | null; ended_by: string | null; end_reason: string | null };
export type CreatorSelection = { request_id: string; creator_id: string; proposal_id: string; selected_by: string; selected_at: string };
export type CreatorAssignment = {
 id: string; request_id: string; creator_id: string; proposal_id: string; work_scope: string; deadline: string | null;
 status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "RELEASED" | "COMPLETED";
 invited_by: string; invited_at: string; expires_at: string; responded_at: string | null; response_note: string;
};
export type CreatorProgressUpdate = { id: string; assignment_id: string; author_id: string; progress: number; content: string; created_at: string };
export type RequestNote = { id: string; request_id: string; author_id: string; content: string; created_at: string };
export type RequestAttachment = { id: string; request_id: string; uploaded_by: string; file_name: string; storage_path: string; file_type: string; file_size: number; created_at: string };
export type ConversationMessage = { audience: "TEAM" | "CUSTOMER_STAFF"; id: string; conversation_id: string; sender_id: string; content: string; kind: "TEXT" | "SYSTEM" | "CREATOR_PROPOSAL" | "QUOTE" | "ORDER" | "CONTRACT" | "PAYMENT" | "PROJECT"; event_data: import("./database.types.js").Json; attachments: string[]; created_at: string };
export type Conversation = { id: string; request_id: string | null; project_id: string | null; subject: string; last_message_at: string; last_message_preview: string; created_at: string; updated_at: string };
export type ConversationMember = { conversation_id: string; profile_id: string; last_read_at: string | null; archived: boolean; muted: boolean };
// Only the projection used by service requests; the broader marketplace retains its existing models.
export type ManagedCreator = { id: string; display_name: string; slug: string; title: string; avatar_url: string | null; availability: string };
export type CreatorProposal = {
 id: string; request_id: string; creator_id: string; creator_snapshot: ManagedCreator; proposed_by: string; reason: string;
 estimated_price: number | null; estimated_days: number | null; status: "PROPOSED" | "SHORTLISTED" | "SELECTED" | "REJECTED" | "WITHDRAWN";
 response_note: string | null; responded_at: string | null; created_at: string; updated_at: string;
};
export const orderStatuses = ["WAITING_CONTRACT", "WAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "WAITING_ACCEPTANCE", "COMPLETED", "CANCELLED", "REFUNDED"] as const;
export type ServiceOrder = {
 team_snapshot: import("./database.types.js").Json;
 closed_by: string | null;
 id: string; order_number: string; request_id: string; customer_id: string; assigned_to: string; creator_id: string; accepted_quotation_id: string;
 quote_snapshot: import("./database.types.js").Json; creator_snapshot: ManagedCreator;
 total: number; deposit_amount: number; remaining_amount: number; status: (typeof orderStatuses)[number]; accepted_at: string; created_at: string; updated_at: string;
};
export type OrderItem = { id: string; order_id: string; service_id: string | null; description: string; quantity: number; unit_price: number; total: number };
export type OrderContract = {
 id: string; order_id: string; request_id: string; quotation_id: string; version: number; previous_version_id: string | null;
 title: string; content: string; content_hash: string; valid_until: string;
 status: "DRAFT" | "SENT" | "VIEWED" | "ACKNOWLEDGED" | "REJECTED" | "EXPIRED" | "CANCELLED";
 created_by: string; sent_at: string | null; viewed_at: string | null; responded_at: string | null; response_reason: string | null; created_at: string; updated_at: string;
};
export type ContractAcknowledgment = { contract_id: string; order_id: string; profile_id: string; content_hash: string; contract_snapshot: import("./database.types.js").Json; method: "APPLICATION"; acknowledged_at: string };
export type OrderPaymentRequest = {
 id: string; order_id: string; kind: "DEPOSIT" | "FULL" | "MILESTONE" | "REMAINING"; amount: number; percentage: number | null;
 due_date: string; note: string; reference: string; bank_snapshot: { bank_name: string; account_number: string; account_name: string; instructions: string };
 created_by: string; idempotency_key: string; request_input: import("./database.types.js").Json;
 status: "PENDING" | "AWAITING_VERIFICATION" | "PAID" | "EXPIRED" | "CANCELLED";
 transfer_note: string; reported_at: string | null; response_reason: string | null; paid_at: string | null; created_at: string; updated_at: string;
};
export type OrderPaymentReceipt = { id: string; order_id: string; payment_request_id: string; amount: number; receiving_account_key: string; bank_transaction_reference: string; received_at: string; verified_by: string; verification_method: "MANUAL_BANK"; payment_snapshot: import("./database.types.js").Json; created_at: string };
export type CommercialQuoteFields = {
 request_id: string | null; version: number | null; previous_version_id: string | null; created_by: string | null; creator_proposal_id: string | null;
 revision_policy: string | null; deposit_percent: number | null; deposit_amount: number | null; remaining_amount: number | null;
 sent_at: string | null; viewed_at: string | null; responded_at: string | null; response_reason: string | null;
};
