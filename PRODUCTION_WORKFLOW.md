# Current production and delivery

Updated 2026-10-03. Migrations 027–029 extend the foundation below. Production contains the full confirmed Creator team, and existing request conversation is retained throughout. Each Creator self-confirms an exclusive assignment and updates their own progress; 100% is not completion.

Production → watermarked REVIEW file versions → Staff sends full-team review round after all milestones finish → Customer accepts or requests revision → remaining payment verified → responsible Staff confirms full funds → matching FINAL uploads → complete every accepted review file → order/project completed and all assignments completed. Current production states include WAITING_REVIEW, REVISION, READY_TO_DELIVER and COMPLETED through these guarded actions, not arbitrary status shortcuts.

Creator uploads private files up to 50 MB (valid PDF/JPEG/PNG/WebP/MP4/MOV), with explicit watermarked/final declaration. The system stores immutable versions; it does not inspect or remove watermark automatically. Staff chooses the exact files in each review round. Customer acceptance records that immutable selection. Each final must correspond to that Creator's accepted review file; partial final delivery cannot close the project or free anyone. No second Customer acceptance is required for the same accepted content minus watermark.

Files use private `order-deliverables` storage with no anonymous/authenticated direct-read policy. Scoped API returns expiring 180-second download URLs and rejects final access without acceptance/full-funds evidence. Upload failure removes the newly uploaded orphan object. Financial evidence/notes never enter Creator payloads. New files/rounds are service-only writes guarded by the workflow.

Two-Creator rollback checks verify actor ownership, full-team/milestone gates, versioned revisions, Customer-only acceptance, missing funds confirmation, partial versus full final completion, whole-team release, immutable history, RLS and private storage. HTTP checks cover private-path omission, cross-order reads, final signed-URL gate, overposting and orphan cleanup. Browser checks remain pending.

The original foundation notes below are historical; their later-work statements are superseded above.

# Order production foundation

Updated 2026-10-03. Migration 024 reuses projects, project_services, project_team_members, project_milestones and project_status_history. Legacy rows retain NULL order_id/production_status and their complete existing workflow. New rows have a unique order_id and production_status; legacy status stays DRAFT as an unused compatibility field. API/UI must use production_status for order-origin production and must not infer execution from legacy status.

Current Staff/Admin creates a project atomically and idempotently from a CONFIRMED order. The RPC checks actual immutable contract acknowledgment, verified receipt sum meeting accepted deposit (full total for zero-deposit terms), active assignee and current request/order assignment. A customer transfer report or forged status cannot qualify. It copies customer/brief/deadline/accepted policy and service quantities from the order/request and links the selected creator as the production team member. It makes no creator booking claim and creates no invoice.

Implemented transitions: PLANNING → READY → IN_PROGRESS ↔ ON_HOLD. Starting requires at least one milestone and moves the order to IN_PROGRESS. Milestones have title, description, due date, display order and PENDING → IN_PROGRESS → COMPLETED with public reasons. Only PENDING milestones can be edited. Creation retry reuses the same intent key; changed content with that key is rejected. Completing milestones does not complete the order or bypass deliverable approval/final payment.

All reads/writes use current order scope; production derives staff assignment from the order so transfer cannot leave stale duplicated staff links. Current Staff/Admin and the owner can read production; only operators mutate. Legacy creator accounts receive no broad order access. Private files, versioned deliverables, review/revision, delivery, final payment, acceptance/review and explicit creator participant access are subsequent work.

Legacy project APIs exclude new-origin rows and reject their detail/edit/message/quote paths. Project/child guards also reject writes outside production workflow, including authenticated Admin table writes. Legacy project_action/edit_project wrappers reject order-origin targets; renamed bases remain revoked. Quotes, legacy payment plans and invoices cannot be created against new-origin projects through the old flow. Historical projects/triggers keep their behavior; new production events use the scoped request conversation and order links.

Verified with seven rollback SQL suites, HTTP scope/overposting/legacy-path tests and frontend/backend checks. No actual production project or financial evidence was created for browser QA accounts. Browser acceptance remains pending; reserved later production statuses are not exposed as shortcuts to completion.
