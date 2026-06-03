---
name: Delivery finalize persistence (mobile)
description: Customer delivery selection must be persisted to Firestore by the app, not solely by the external Worker.
---

# Delivery finalize persistence

When a customer chooses delivery (driver) or self-pickup on the order details screen,
`setDeliveryMethod()` (contexts/DataContext.tsx) must write the authoritative fields to
Firestore **from the app itself** via `fsUpdateOrder`:
- driver: `deliveryMethod:'driver'`, `deliveryStatus:'ready_for_driver'`, `driverUid:null` (+ fee/total)
- self-pickup: `deliveryMethod:'self_pickup'`, `deliveryStatus:'self_pickup_selected'`, `driverUid:null`, fee 0

**Why:** Previously the Firebase-mode branch ONLY called the external Cloudflare Worker
(`tabbakheen-api.../finalize-delivery`) and never wrote to Firestore. When the *live* Worker
was stale/unreachable or its write silently failed, the order stayed
`deliveryMethod=null / deliveryStatus=null / driverUid=null`, the customer's choice was lost,
and drivers saw nothing. The Worker is external and can't be assumed up-to-date or even
deployed; the app must not depend on it for persistence.

**How to apply:** Call the Worker best-effort (try/catch) for the fee quote + push
notifications, then ALWAYS do the authoritative `fsUpdateOrder`. The Firestore write is the
success gate — let it throw on failure so the UI shows an error instead of a false success.
Fee falls back to the order's existing fee / base when the Worker is unavailable. Customers
are already allowed to update their own order docs from the client (same pattern as
`submitPaymentProof`/`confirmPayment`), so this needs no Firestore-rule changes.

The live Worker source (read-only local copy) lives at `.local/worker-src/worker.js`; its
`/finalize-delivery` handler does persist correctly when reached — the failure is the live
deployment, not the handler logic.
