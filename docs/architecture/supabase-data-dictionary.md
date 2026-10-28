# Supabase data dictionary

This map describes the 73 tables in the configured project's `public` schema, inspected on 2026-10-23. It groups tables by the product workflow that owns them. Supabase-managed schemas such as `auth` and `storage` are outside this list.

## How to read the schema

- `profiles` is the account and role record linked to Supabase Auth. `customers` and `creator_profiles` hold role-specific details.
- A public enquiry is a `lead`. An authenticated customer service request is a `request`. A quotation/project is the older project flow; an `order` is the newer production and payment flow. Do not merge these just because they overlap in business language.
- `portfolio` is the company showcase. `creator_portfolio` contains a creator's samples. `testimonials` and `reviews` are separate presentation and review records.
- Tables with `order_` prefixes support a specific order sub-workflow. Empty tables may be reserved for later states in a supported workflow; zero rows alone do not make a table unused.
- `mediahub_schema_migrations` is migration bookkeeping. `audit_logs` is operational history. Neither is product content.

## Accounts, roles and creator profiles

| Table                        | Purpose                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `profiles`                   | Account identity details and application role, linked to Auth.        |
| `customers`                  | Customer organization and contact details.                            |
| `creator_profiles`           | Creator profile, availability and workflow attributes.                |
| `creator_categories`         | Many-to-many links between creators and service categories.           |
| `creator_skills`             | Many-to-many links between creators and skills.                       |
| `skills`                     | Skill catalog used by creator profiles.                               |
| `creator_team_settings`      | Creator/team availability and dispatch settings.                      |
| `creator_assignments`        | Creator assignment records for work.                                  |
| `creator_company_agreements` | Company/creator agreement records.                                    |
| `creator_portfolio`          | Creator-owned sample work.                                            |
| `creator_proposals`          | Creator's proposal and response for a request or project opportunity. |

## Catalog, leads and service requests

| Table                        | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `categories`                 | Service category catalog.                                                             |
| `services`                   | Customer-facing service catalog; inactive demo rows remain for historical references. |
| `service_packages`           | Optional packages attached to catalog services.                                       |
| `leads`                      | Public enquiries and applications before or outside authenticated service work.       |
| `requests`                   | Authenticated customer request lifecycle.                                             |
| `request_assignments`        | Staff/creator assignment history for requests.                                        |
| `request_attachments`        | Files attached to requests.                                                           |
| `request_creator_selections` | Creator choices associated with a request.                                            |
| `request_notes`              | Internal or workflow notes attached to requests.                                      |
| `service_chat_files`         | Files exchanged through service-related chat.                                         |

## Quotations and legacy project workflow

| Table                    | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `quotations`             | Quotation header and customer-facing quotation state. |
| `quotation_items`        | Line items belonging to a quotation.                  |
| `projects`               | Project record in the quotation/legacy project flow.  |
| `project_services`       | Services and agreed scope attached to a project.      |
| `project_milestones`     | Milestones for a project.                             |
| `project_status_history` | Project status transition history.                    |
| `project_files`          | Project file metadata.                                |
| `project_messages`       | Messages attached to a project.                       |
| `project_team_members`   | Team members assigned to a project.                   |

## Orders, contracts, payments and production

| Table                             | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `orders`                          | Current order lifecycle and customer/creator ownership. |
| `order_items`                     | Service line items and snapshots for an order.          |
| `order_contracts`                 | Versioned order contract and approval state.            |
| `contract_acknowledgments`        | A party's acknowledgement of an order contract.         |
| `payment_settings`                | Payment configuration used by the application.          |
| `payment_plans`                   | Payment schedule definition for an order.               |
| `payment_installments`            | Individual scheduled payment amounts and states.        |
| `invoices`                        | Invoice records.                                        |
| `order_payment_requests`          | Requests for a payment under an order.                  |
| `order_payment_receipts`          | Proof/receipt records for order payments.               |
| `order_final_funds_confirmations` | Confirmation of final payment funds.                    |
| `order_variations`                | Change requests to agreed order scope.                  |
| `order_variation_quotes`          | Price/time quotation for an order variation.            |
| `order_variation_acknowledgments` | Party acknowledgement of an order variation.            |
| `production_submissions`          | Creator submissions of order deliverables for review.   |
| `deliverables`                    | Final or accepted files delivered for work.             |
| `revision_requests`               | Requested revisions to submitted work.                  |
| `execution_delays`                | Delay records and related schedule changes.             |
| `creator_progress_updates`        | Creator progress updates for assigned work.             |
| `creator_replacements`            | Replacement workflow for an assigned creator.           |
| `creator_replacement_invites`     | Invitations used during creator replacement.            |
| `order_creator_reviews`           | Customer review of the creator for an order.            |
| `order_result_reviews`            | Customer review of the delivered result.                |
| `order_review_rounds`             | Review-round state and history for an order.            |
| `order_publication_preferences`   | Customer preferences about publishing order work.       |
| `order_case_studies`              | Case-study publication records derived from orders.     |

## Conversations, support and notifications

| Table                   | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `conversations`         | Conversation header and context.         |
| `conversation_members`  | Users participating in a conversation.   |
| `conversation_messages` | Messages in a conversation.              |
| `notifications`         | In-app notifications for users.          |
| `support_tickets`       | Customer support case header and status. |
| `support_messages`      | Messages belonging to a support ticket.  |

## Website content and company operations

| Table               | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `portfolio`         | Company's public case studies and showcase work.              |
| `case_study_assets` | Media assets attached to a company/order case study.          |
| `testimonials`      | Customer quotes used as testimonials.                         |
| `reviews`           | Review records retained by the legacy project/review flow.    |
| `work_processes`    | Public website descriptions of the work process.              |
| `website_settings`  | Public website copy and contact configuration; never secrets. |
| `partners`          | Partner directory or relationship records.                    |
| `employees`         | Internal employee directory records.                          |

## Administration and schema operations

| Table                        | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `audit_logs`                 | Administrative and security-relevant change history. |
| `staff_dispatch_settings`    | Staff-side assignment/dispatch configuration.        |
| `mediahub_schema_migrations` | Applied migration identifiers and checksums.         |

## Source of truth and maintenance

This is an operator-oriented guide; table definitions and constraints remain the precise source of truth. The code and database audit may refine a label as workflows evolve. To refresh the exact inventory, run `npm run db:audit --prefix backend`; for machine-readable table and field references, run `node backend/scripts/schema-inventory.mjs --json` after the backend build. The related removal decisions and data retention notes are in [the schema audit](supabase-schema-audit.md).
