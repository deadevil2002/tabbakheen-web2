---
name: Wathq CR verification (mobile)
description: How optional commercial-registration verification is modeled for Tabbakheen providers, and the privacy/trust decisions behind it.
---

# Optional Wathq verification (providers)

Optional commercial-registration (CR) verification for providers. Surfaces a neutral
blue "verified" badge only; never gates signup/login/publishing/orders/customer/driver.

## Status model
- Public statuses ONLY: `verified | pending_review | unverified`. There is deliberately
  **no public "failed" state** — any inactive/not-found/timeout/error resolves to
  `pending_review` with neutral wording. Active CR = verified; **no business-name matching**.

## Privacy split (important decision)
- **Public** fields on `users/{uid}` (broadly readable, hydrated client-side in
  `firestoreUsers.toUser`): only `verificationStatus`, `verificationSource`, `verifiedAt`.
- **Sensitive** CR data (`crNumber`, legal name, internal error/timestamps) must live in a
  separate owner/admin-only doc `verifications/{uid}` — **never** on the broadly-readable
  `users` doc.
- **Why:** providers are subscribed publicly via `fsSubscribeByRole('provider')`. Firestore
  read rules are document-level, so any field on `users/{uid}` reaches every reader even if
  the UI never renders it. Mapping CR fields into `User` leaked PII to customers/drivers.
- **How to apply:** if you add new verification fields, decide public vs sensitive; only put
  public ones on `users/{uid}` and only those into `toUser`.

## Trust model for the verify call
- App calls the existing Cloudflare Worker `tabbakheen-api` at `POST /verify-cr` (Wathq is
  NEVER called from the app). Sends static `x-api-key` (app identity) **and** a Firebase ID
  token (`Authorization: Bearer`). The Worker must verify the token and derive the UID from
  it, ignoring/validating the client-supplied uid — otherwise a client could submit
  verification for arbitrary accounts.
- **Why:** static app key alone + caller-supplied uid is forgeable/abusable.

## Secrets
- Wathq auth is a **simple `apiKey` header** (confirmed via Swagger; NOT OAuth2). Secret
  `WATHQ_API_KEY` lives ONLY in Cloudflare Worker secrets — never in Expo/app.json/
  EXPO_PUBLIC/Replit/GitHub/client/logs. The app never logs CR number, uid, or raw response.

## Manual review
- This phase: anything not auto-verified stays `pending_review`; an admin flips status in the
  Firebase Console. No admin endpoint in-app.
