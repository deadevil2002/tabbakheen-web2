---
name: Delivery completion + complaints
description: Customer-only finalize; split writes for Firestore rules; complaints go to delivery_complaints; appeal submit now requires Firebase ID token.
---

# Delivery Finalize

- Customer-only action (checkAccountAccess → allowed, then verify customerUid === auth.uid at call site).
- Split writes (order status + deliveryStatus separately) to survive Firestore security rules.
- Delivery fee computed by Worker; app writes via fsUpdateOrder for persistence.

# Complaints

- Collection: `delivery_complaints` (not `complaints`).
- Fields include: customerUid, providerUid, driverUid, orderId, source, complaintStatus, confirmedViolation, confirmedAt, confirmedBy, violationTargetRole, complaintCount, confirmedComplaintCount.
- Admin-compatible field names used throughout.
- `complaintCount` / `confirmedComplaintCount` on user doc are recomputed by Worker on every confirmedViolation resolve (query-based, double-count safe).

# /appeal/submit Security (F-02 — fixed)

- Requires `Authorization: Bearer <Firebase ID token>`.
- Worker verifies token via `verifyFirebaseIdToken(idToken)` → returns `payload.sub` (UID) or throws.
- Returns 401 (Arabic) if token missing or invalid.
- Returns 403 if `body.uid !== verifiedUid`.
- Email and role fetched from `users/{verifiedUid}` Firestore doc (source of truth); body values ignored for these fields.
- Public GET /appeal page is unchanged (no auth required to view form).

**Why:** F-02 audit finding — anyone could POST with a victim UID and inject notifications / create appeals for other users without being authenticated.
