# Approved service workflow

Business decisions last reviewed 2026-10-03. This document is the product-workflow reference, not evidence that a feature is deployed. See the [implementation checkpoint](../planning/refactor-progress.md) and [live Supabase schema audit](../architecture/supabase-schema-audit.md) for dated technical evidence.

## Roles

- **Guest** browses public services, Creator profiles and approved project excerpts.
- **Customer** owns a service request, selects the proposed team, accepts commercial terms, pays, reviews delivery and submits feedback.
- **Staff** consults, proposes the Creator team, prepares quotes, coordinates delivery and confirms actual bank receipts for assigned orders.
- **Creator** works only within an accepted assignment and the scope confirmed for that assignment.
- **Admin** manages accounts, catalog and public content, oversees operations and verifies receipts.

New accounts use `CUSTOMER`, `STAFF`, `CREATOR` or `ADMIN`. Historical `BUSINESS` and `STUDENT_CREATOR` identities remain compatible during migration; do not treat them as new product roles.

## Request to delivery

1. Customer selects a service and submits a consultation request. One request has one persistent conversation and one responsible Staff member. Automatic assignment selects the longest-idle available Staff member.
2. Staff clarifies the brief and proposes currently contracted, eligible Creators. Customer selects the team in the conversation. Each Creator confirms their scope and deadline during an exclusive 5–15 minute reservation.
3. Staff publishes the quote only after the proposed team confirms. Customer acceptance creates the commercial order. Quote, team and contract snapshots preserve the agreed terms.
4. Customer explicitly acknowledges the latest contract version. This is recorded as an application acknowledgment with a content hash; it is not a provider-backed electronic signature.
5. Staff issues an order-specific payment request. Customer can report a transfer, but the report is not proof of receipt. Admin or the responsible Staff member verifies actual bank evidence; only verified receipts count toward the deposit and confirmation gates. New quotes require at least a 30% deposit.
6. Staff creates the production plan and milestones. The confirmed Creator team works through the existing request conversation. Creators can see only their accepted scope; private Customer–Staff commercial messages and financial records are hidden from Creators.
7. Creators submit watermarked review files. After milestones are complete, Staff opens a versioned review round for the whole team. Customer accepts the selected result or requests a scoped revision.
8. Customer pays the remaining balance. Staff separately confirms that verified receipts cover the full order value. Each Creator submits the matching final file with the watermark removed. Partial delivery cannot complete the order or release a Creator assignment.
9. The order completes only after every accepted review file has its corresponding final file and the full team has finished. Customer can review the result and each Creator; edits are allowed for seven days from the first submission.
10. Admin reviews a separate excerpt before public case-study publication. Customer identity follows the recorded named/anonymous choice. Full deliverables, contracts, conversations and payment records remain private.

## Changes after agreement

Customer can request a variation. Staff publishes a versioned quote and updated scope; Customer must acknowledge the exact version before the total and remaining balance change. Existing receipts remain historical cash received.

Customer can request a Creator replacement or report a delay. Staff records the decision and reason. A replacement takes effect only after the new Creator accepts; the old assignment, agreed price, contract and history remain recorded. A delay report alone does not change the schedule, create a refund or impose a penalty.

## Financial and privacy rules

- Staff sees their own attribution and receivables; Admin sees company totals with Staff drill-down. Original closing Staff remains distinct from the current operator.
- Receipt periods use Vietnam business-month and actual received time. Historical attribution is never guessed. Commissions remain outside the system.
- Customer brief and assignment access is owner/current-assignee/Admin scoped. Private storage is served through the authorized API, not public URLs.
- A Customer transfer report, a 100% Creator progress value, or an uploaded file alone never confirms funds or completes the order.

## Integration boundaries

The implemented contract evidence is application acknowledgment. Real provider e-signature, bank/QR payment integration and automatic email require separate configuration and verification. Cancellation/refund policy remains deferred. Check the linked technical records before treating any integration or browser journey as complete.
