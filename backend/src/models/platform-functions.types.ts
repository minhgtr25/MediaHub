import type { Database } from "./database.types.js";
import type { PublicCaseStudyPage } from "./commerce.model.js";

export type PlatformFunctions = Database["public"]["Functions"] & {
  admin_user_directory: {
    Args: { actor_id: string; filters: import("./database.types.js").Json };
    Returns: import("./database.types.js").Json;
  };
  admin_create_creator_profile: {
    Args: { actor_id: string; payload: import("./database.types.js").Json };
    Returns: import("./database.types.js").Json;
  };
  admin_manage_creator_showcase: {
    Args: {
      actor_id: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: import("./database.types.js").Json;
  };
  public_company_portfolio: {
    Args: {
      portfolio_page: number;
      portfolio_limit: number;
      portfolio_search: string;
      portfolio_category: string;
      portfolio_kind: string;
    };
    Returns: import("./commerce.model.js").CompanyPortfolioPage;
  };
  public_company_excerpt: {
    Args: { excerpt_public_id: string };
    Returns: import("./commerce.model.js").CompanyPortfolioItem | null;
  };
  completed_delivery_eligible: {
    Args: { oid: string };
    Returns: boolean;
  };
  order_feedback_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: import("./database.types.js").Json;
  };
  public_completed_case_studies: {
    Args: { case_page: number };
    Returns: PublicCaseStudyPage;
  };
  public_completed_creator_reviews: {
    Args: { creator_slug: string; review_page: number };
    Returns: import("./database.types.js").Json;
  };
  service_chat_scope: {
    Args: { actor_id: string; rid: string };
    Returns: import("./database.types.js").Json;
  };
  service_chat_conversations: {
    Args: { actor_id: string; chat_page: number; chat_search: string };
    Returns: import("./database.types.js").Json;
  };
  service_chat_resources: {
    Args: { actor_id: string; rid: string; resource_page: number };
    Returns: import("./database.types.js").Json;
  };
  service_chat_participants: {
    Args: { actor_id: string; rid: string };
    Returns: import("./database.types.js").Json;
  };
  creator_request_candidates: {
    Args: { actor_id: string; rid: string; search_text: string };
    Returns: import("./database.types.js").Json;
  };
  public_creator_search: {
    Args: { filters: import("./database.types.js").Json };
    Returns: import("./commerce.model.js").PublicCreatorSearch;
  };
  public_creator_detail: {
    Args: { creator_slug: string };
    Returns: import("./database.types.js").Json;
  };
  creator_profile_state: {
    Args: { actor_id: string };
    Returns: import("./database.types.js").Json;
  };
  creator_profile_action: {
    Args: {
      actor_id: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: import("./database.types.js").Json;
  };
  execution_state: {
    Args: { actor_id: string; oid: string; report_page: number };
    Returns: import("./database.types.js").Json;
  };
  execution_candidates: {
    Args: { actor_id: string; oid: string; search_text: string };
    Returns: import("./database.types.js").Json;
  };
  execution_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: import("./database.types.js").Json;
  };
  execution_invitations: {
    Args: { actor_id: string; report_page: number };
    Returns: import("./database.types.js").Json;
  };
  execution_invite_scope: {
    Args: { actor_id: string; iid: string };
    Returns: boolean;
  };
  execution_invite_response: {
    Args: {
      actor_id: string;
      iid: string;
      operation: string;
      reason: string;
    };
    Returns: import("./database.types.js").Json;
  };
  replacement_reserved_creators: {
    Args: { actor_id: string; creator_ids: string[] };
    Returns: import("./database.types.js").Json;
  };
  order_variation_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: import("./database.types.js").Json;
  };
  order_variation_list: {
    Args: {
      actor_id: string;
      oid: string;
      report_page: number;
      focus_id?: string;
    };
    Returns: import("./database.types.js").Json;
  };
  order_variation_scopes: {
    Args: { actor_id: string; oid: string; report_page: number };
    Returns: import("./database.types.js").Json;
  };
  order_delivery_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: {
      order_id: string;
      submission_id?: string;
      round_id?: string;
      reused?: boolean;
    };
  };
  commerce_finance_report: {
    Args: {
      actor_id: string;
      report_year: number;
      report_month: number;
      staff_filter: string | null;
      report_page: number;
    };
    Returns: import("./database.types.js").Json;
  };
  confirm_order_final_funds: {
    Args: {
      actor_id: string;
      oid: string;
      payload: import("./database.types.js").Json;
    };
    Returns: { order_id: string; reused?: boolean };
  };
  creator_team_action: {
    Args: {
      actor_id: string;
      rid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: { id: string; request_id: string; reused?: boolean };
  };
  onboard_creator: {
    Args: {
      actor_id: string;
      cid: string;
      target_profile_id: string;
      payload: import("./database.types.js").Json;
    };
    Returns: { creator_id: string; profile_id: string };
  };
  save_profile_avatar: {
    Args: { actor_id: string; image_url: string };
    Returns: { avatar_url: string };
  };
  order_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: {
      id: string;
      order_id: string;
      version?: number;
      reused?: boolean;
    };
  };
  order_payment_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: { id: string; order_id: string; reused?: boolean };
  };
  order_production_action: {
    Args: {
      actor_id: string;
      oid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: {
      id: string;
      order_id: string;
      milestone_id?: string;
      reused?: boolean;
    };
  };
  request_commerce_action: {
    Args: {
      actor_id: string;
      rid: string;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: {
      id: string;
      request_id: string;
      order_id?: string | null;
      version?: number;
    };
  };
  request_action: {
    Args: {
      actor_id: string;
      rid: string | null;
      operation: string;
      payload: import("./database.types.js").Json;
    };
    Returns: {
      id: string;
      conversation_id?: string;
      reused?: boolean;
      created?: boolean;
    };
  };
  save_service_package: {
    Args: {
      actor_id: string;
      package_id: string | null;
      payload: import("./database.types.js").Json;
    };
    Returns: { id: string };
  };
  support_action: {
    Args: {
      actor_id: string;
      operation: string;
      target_id: string | null;
      payload: import("./database.types.js").Json;
    };
    Returns: { id: string };
  };
  payment_action: {
    Args: {
      actor_id: string;
      operation: string;
      target_id: string;
      payload: import("./database.types.js").Json;
    };
    Returns: { id: string };
  };
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
