# MediaHub Design Rules

Updated 2026-10-03. Incrementally reuse `frontend/src/styles.css` and `components/ui.tsx`; no second UI framework.

- **Hierarchy:** page title, short context/next action, primary content, secondary information. Customer workspaces must expose request ID/service/status/assigned staff and next step. Financial totals distinguish quoted, verified paid and remaining.
- **Tokens:** use existing `--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--orange` and the existing strong border token. Orange is the primary action; text/shape must distinguish status without relying only on color. Dashboard surfaces should remain calm; don't add gradients to operational cards.
- **Typography:** use existing font stack. One h1 per page; h2 per major section; labels are explicit. Customer-facing text uses Vietnamese status labels; technical enum values stay in requests/database.
- **Spacing:** 8/12/16/24/32 px scale. Reuse `.panel`, `.toolbar`, `.resource-grid`, `.table-wrap`, `.field` and `.btn`. Avoid page-specific overrides when fixing a shared component.
- **Forms:** visible labels, matching IDs, native validation plus backend Zod/RPC checks. Numeric limits and constraints explain business rules. Disable submission while pending; preserve values on failure. Auth icons reserve input padding and password manager autocomplete is provided.
- **States:** `State` handles loading/error/retry; lists show a meaningful empty state and next action. A zero metric comes from an actual count, not an invented business claim. Unavailable rating/satisfaction/presence data is omitted.
- **Actions:** one primary action per stage; secondary actions use ghost styling. No inert buttons. A quote acceptance, bank report, receipt confirmation and contract acknowledgment must describe their different effects.
- **Responsive:** customer/public mobile first; staff/admin desktop first with usable drawer/navigation on smaller widths. Tables scroll within their container. Check 375/390/768/1024/1440 widths and actual element bounds, not only document overflow (hidden overflow can mask clipping).
- **Accessibility:** keyboard focus visible; labels on icon buttons/search; aria-live for success/failure; pending controls disabled; no fabricated online/read indicators. A drawer/modal needs escape/close and sensible focus behavior. Respect reduced motion in later shared CSS cleanup.
- **Truthful content:** only published database records/counts. No multiplied counts, generated review scores, hardcoded client logos, savings percentages or legal/security assertions without an implemented/verified basis. Existing labelled demo database records require business-owner publication review; source refactor must not delete them.

Browser evidence for this tranche: public homepage and login reviewed at mobile/tablet widths, guest service-detail CTA redirects to login. Complete customer/staff/admin journeys and full accessibility audit remain unchecked.
