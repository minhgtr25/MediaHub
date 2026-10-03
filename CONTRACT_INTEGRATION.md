# Contract acknowledgment and provider integration

Updated 2026-10-03. Migration 022 implements application acknowledgment, not a provider-backed electronic signature. UI labels use “xác nhận trong ứng dụng”; persisted status is ACKNOWLEDGED and method is APPLICATION. No SIGNED state, signature image, certificate or provider receipt is fabricated.

Staff/Admin supplies actual approved contract text; there is no generated legal template. Each version references the order, request and accepted quotation. The server computes SHA-256 over exact UTF-8 content. Sending freezes content/title/validity/version links. Opening published terms records VIEWED; only the owning customer/BUSINESS can acknowledge the latest unexpired version with a literal true checkbox and matching hash. The transaction stores an immutable complete contract snapshot, actor and server timestamp, then moves the order to WAITING_PAYMENT. It creates no payment, receipt, invoice or production project. Repeated acknowledgment reuses the existing evidence.

Rejected, cancelled or expired terms remain in history; a new version references its predecessor. Never-sent drafts remain private. Changes after acknowledgment require a future explicit amendment process rather than editing evidence. Active-order transfers synchronize request/order assignment and conversation membership; internal transfer reasons stay out of customer messages.

## Remaining provider work

- Choose the business-approved provider and required identity/consent process; obtain credentials and approved contract documents.
- Add provider envelope/document identifiers, signer verification, exact document digest and provider evidence separately from APPLICATION records.
- Submit documents from the backend, keep credentials out of VITE variables, verify webhook signatures and persist each provider event idempotently.
- Reconcile provider status through verified events; handle retry, expiry, rejection, cancellation and amendments without rewriting published history.
- Define the production gate when provider-backed signing is required. Existing application acknowledgments must not be relabelled as provider signatures.

No e-sign provider is configured or called. Legal validity is not asserted by this implementation. Manual bank payment eligibility will consume the immutable acknowledgment; a payment gateway is a separate integration.
