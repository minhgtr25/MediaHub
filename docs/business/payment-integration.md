# Current Staff payment authority and reporting

Updated 2026-10-03; migration 028 applied. The **current assigned Staff or Admin** can verify/reject actual order-origin bank receipts using their own authenticated identity and explicit exact bank evidence. A separate immutable full-funds confirmation is available only to the responsible assigned operator after verified receipts equal the order total. This does not itself complete a project; accepted review and every final file are required by migration 029.

Staff own monthly/yearly and Admin company/Staff reports distinguish consultation counts, orders closed, booked value, actual cash received and receivables. New orders freeze `closed_by` on creation. Transfers change current management without reallocating closing credit or restoring old private access. Old orders remain unattributed. Reports count cash by actual received time in Vietnam business months; a prior-month order's new receipt is current-month cash, not a new current-month sale. Amounts are gross verified receipts; profit/expenses/commission/refunds are not inferred.

No actual bank transaction, live verification receipt or invitation was generated while implementing/testing. All synthetic evidence/settings/storage rows are rolled back. Real amount-bound QR/gateway configuration, provider signatures, cross-ledger reconciliation and browser release checks remain as described below. Older references to Admin-only order reconciliation are superseded; legacy project payments still retain their previous separate authority.

# Order payment requests and reconciliation

Updated 2026-10-03. Migration 023 adds order_payment_requests/order_payment_receipts without changing project-only legacy plans/installments or historical invoices. No actual bank transaction is performed by the application or migration tests.

An acknowledged active order is required. Current staff/Admin issues DEPOSIT, FULL, MILESTONE or REMAINING with due date and public note. Deposit/full/remaining derive from immutable order terms and verified receipts. A milestone accepts exactly one amount or percentage of order total, bounded by the amount not already collected or reserved by pending/reported requests. Two decimal places are enforced. Zero-value orders require a future explicit non-payment confirmation path; no fictional receipt is created.

Issuance freezes amount, reference and receiving bank snapshot. Required bank/account details come from enabled payment_settings; the migration does not populate or change real bank configuration. The owner reports an actual transfer with a note: PENDING → AWAITING_VERIFICATION. A report creates no receipt and cannot confirm the order. Admin checks the actual bank record, explicitly verifies it and submits exact amount, bank transaction reference, actual received timestamp and an internal audit reason. The API rejects forged actor/status/receipt metadata; the database enforces current actor/ownership/assignment and locks request then order. A verified immutable MANUAL_BANK receipt moves the request to PAID and can move WAITING_PAYMENT → CONFIRMED after receipts reach the accepted deposit (or total if deposit is zero). No project/invoice is created in this module.

Receipt amount must exactly match the request; partial or excess transfers need reconciliation before confirmation. Retry requires the same bank reference/amount/timestamp and reuses the receipt. Normalized bank transaction references are globally unique within the new ledger, conservatively preventing reuse even if bank settings change. A bank that reuses references requires a future reviewed bank-source namespace; never invent a new reference to bypass the check. Existing legacy receipts lack this evidence and are not silently merged into the new ledger. Cross-ledger reconciliation remains a release requirement.

Admin rejection records a public reason and returns to PENDING, or EXPIRED if overdue. Operators cancel only PENDING requests; reported transfers must first be reconciled. Expiry only applies to overdue PENDING requests. Bank/amount/receipt history is immutable. Refunds, partial receipts, adjustments and zero-value confirmation need separate audited operations; do not edit PAID evidence. PROCESSING/FAILED/REFUNDED provider states are not simulated.

## Remaining integrations and release checks

- Amount-specific QR: obtain verified bank identifier/provider configuration, generate from persisted payment/order/amount/reference on the backend and validate those fields. The existing generic uploaded QR is deliberately omitted from new-order payments because it is not bound to an amount/reference.
- Gateway: keep credentials server-side; verify signed webhooks, amount/currency/order/reference, persist provider event IDs idempotently, reconcile missed/duplicate events and refunds.
- Unified legacy receipt/invoice reconciliation and concurrent multi-session bank confirmation acceptance before financial release. Rollback tests cover sequential retries/duplicates, constraints, scope and gates; they do not claim live multi-session bank integration.
- Browser customer/staff/Admin payment, network recovery and keyboard/mobile verification; current browser tooling cannot reacquire connection-error tabs.

All synthetic payment requests and receipts in db:check/db:migrate run under rollback/savepoint. No payment request, actual receipt, signature or production project has been created for the persisted browser QA brief.
