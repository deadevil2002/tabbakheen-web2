---
name: Suspension appeals (mobile + Worker)
description: How the provider/driver suspension-appeal system is wired and the two non-obvious invariants that keep it correct.
---

# Suspension appeals

Suspended providers/drivers appeal account suspension. Appeals live in Firestore collection `suspension_appeals`; admin reviews them in the "اعتراضات الإيقاف" admin section. Lifecycle events (submit / accept / reject) are **in-app Firestore notifications only** (`users/{uid}/notifications` subcollection) — never push. Optional appeal image goes to Cloudinary folder `tabbakheen/appeals`.

## Invariant 1 — public appeal routes must precede the API-key gate
`GET /appeal` (the branded RTL form page) and `POST /appeal/submit` are PUBLIC (no `x-api-key`). In the Worker they MUST be placed textually before the `const apiKey = request.headers.get("x-api-key")` gate, otherwise the gate rejects them.
**Why:** suspended users have no admin key and the page is opened via a plain external link from the mobile AccountGateScreen.

## Invariant 2 — accept must reactivate-first, then mark accepted
In `/admin/api/appeals/:id/accept`: update `users/{uid}` (accountStatus=active + clear suspendedReason/At/By) FIRST and hard-fail (return 500) if that write throws; only AFTER a successful reactivation mark the appeal `appealStatus:"accepted"`. Reject keeps the user suspended and sets `appealStatus:"rejected"`.
**Why:** the original order (mark accepted, then swallow a failed unsuspend) could leave an appeal "accepted" while the account stayed suspended.
**How to apply:** preserve this ordering on any future edit to the accept handler.

## Mobile entry point
`components/AccountGateScreen.tsx` shows the Arabic "تقديم اعتراض" button ONLY when `gateResult.reason === 'suspended'`. It opens `https://tabbakheen-api.tabbakheen.workers.dev/appeal?uid=&email=&role=&reason=` (reason omitted when `user.suspendedReason` is empty — the page hides that field gracefully).
