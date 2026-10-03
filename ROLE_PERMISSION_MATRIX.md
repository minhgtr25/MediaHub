# Current role permissions

Updated 2026-10-03. Authoritative scope: `IMPLEMENTATION_PLAN.md`; migrations 027–030 applied. Guest is unauthenticated. Four newly issued account roles are CUSTOMER, STAFF, CREATOR, ADMIN. Historical BUSINESS/Student Creator identities remain compatible without deletion or automatic conversion.

| Capability | Guest | Customer | Staff | Creator | Admin |
| --- | --- | --- | --- | --- | --- |
| Public services, profiles, partners, project excerpts | Yes | Yes | Yes | Yes | Yes |
| Create service consultation | No | Own | No | No | Oversight |
| Automatic consultation dispatch | No | Assigned Staff shown | Longest idle | No | Oversight/transfer |
| Choose proposed Creator team | No | Own request | Propose/invite only | No | Propose/invite only |
| Accept Creator assignment | No | No | No impersonation | Own invitation | No impersonation |
| Quote and contract terms | No | Own published versions/respond | Current assigned work | Hidden | Author/oversight |
| Shared service chat | No | Own | Current assigned | Confirmed assignment + acknowledged contract | Oversight |
| Private Customer–Staff commercial messages | No | Own | Current assigned | Hidden | Oversight |
| Payment request / actual receipt verification | No | Report own real transfer | Current assigned order | Hidden | All orders |
| Separate full-funds confirmation | No | No | Current responsible Staff | Read ready/not-ready flag only | Only when assigned responsible operator |
| Production plan/milestones | No | Read own | Operate assigned | Progress own part | Operate/oversight |
| Upload review/final files | No | Read/download own | Review/send round | Own confirmed assignment | Review/send round |
| Accept/revise result | No | Own pending review round | No impersonation | No | No impersonation |
| Final file release/completion | No | Download after gates | Confirm full funds | Upload only after accepted review + full funds | Oversight |
| Monthly/yearly finances | No | Own order payment summary | Own attribution and managed balances | No | Company and per Staff |
| Grant Creator account by CSV | No | No | No | No self-registration | Verified company-contract record required |
| Avatar upload | No | Own | Own | Own, synced to linked profile | Own |
| Result and Creator review | Read public Creator section | Own completed order; edit within seven days | Read assigned order; cannot rate for customer | Read public section | Oversight; cannot rate for customer |
| Name/anonymity choice | No | Own order; can change after review edit expiry | Read only | No | Read only |
| Completed-project excerpt | Read approved | Read approved | No publication | No publication | Prepare/check/approve/withdraw completed project |
| Legacy chat | No | Read history | Internal Staff/Admin write | Read history | Internal Staff/Admin write |

Current Staff scope is checked before reading child records. Transfer revokes previous Staff private order/chat/file access while preserving aggregated original closing credit. Creator never gets blanket request/order/finance access. Backend uses authenticated actor identity; service-only SQL functions enforce the same boundaries transactionally. No client writes receipts, assignments or final-file metadata directly.

Variations/addenda, replacement and delay responsibility are not yet implemented in this new workflow. Commissions are external. Cancellation/refund policy remains deferred.
